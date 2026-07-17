import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import AuthForm from './components/AuthForm';
import './index.css'
import RoundStart from './components/roundStart'
import Leaderboard from './components/Leaderboard.jsx';
import Scorecard from './components/Scorecard.jsx';
import Hole from './components/Hole'; // Import the Hole component
import TripScreen from './components/TripScreen';
import TripList from './components/TripList';
import AddCourse from './components/AddCourse';
import EditPlayerHandicap from './components/EditPlayerHandicap';
import EditTrip from './components/EditTrip';
import { useLogger, useLogLifecycle } from './utils/logger/LoggerContext';
import { LOG_CATEGORIES } from './config/logging';
import { ErrorBoundary } from './utils/errorBoundary';


function App() {
  const logger = useLogger('App');
  useLogLifecycle('App');
  const [view, setView] = useState('round'); // 'round' | 'leaderboard' | 'trip' | 'tripList' | 'addCourse' | 'editHandicaps' | 'editTrip'
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentHole, setCurrentHole] = useState(0);
  const [selectedCourse, setSelectedCourse] = useState(null); // stores selected round index (0-based)
  const [roundStarted, setRoundStarted] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [isRoundFinished, setIsRoundFinished] = useState(false);
  const [user, setUser] = useState(null);
  const [resumeDirectToHole, setResumeDirectToHole] = useState(false);
  const [checkingRound, setCheckingRound] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [roundType, setRoundType] = useState('full');

  // On mount, listen for auth state changes
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        logger.info('User authenticated', {
          userId: firebaseUser.uid,
          email: firebaseUser.email,
          category: LOG_CATEGORIES.AUTH,
        });
        logger.setContext({ userId: firebaseUser.uid });
      } else {
        logger.info('User logged out', {
          category: LOG_CATEGORIES.AUTH,
        });
        logger.clearContext();
      }
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, [logger]);

  // On user load, check for unfinished round where user is scoreKeeper
  useEffect(() => {
    async function checkInProgressRound(userId) {
      setCheckingRound(true);
      logger.info('Checking for in-progress rounds', {
        userId,
        category: LOG_CATEGORIES.ROUND,
      });

      try {
        // Get all active trips
        const tripsQuery = query(
          collection(db, 'trips'),
          where('isActive', '==', true)
        );
        const tripsSnapshot = await getDocs(tripsQuery);
        
        // Check each trip for unfinished scores where user is scorekeeper
        for (const tripDoc of tripsSnapshot.docs) {
          const scoresQuery = query(
            collection(db, 'trips', tripDoc.id, 'scores'),
            where('scoreKeeper', '==', true),
            where('playerId', '==', userId),
            where('isRoundFinished', '==', false)
          );
          
          const scoresSnapshot = await getDocs(scoresQuery);
          if (scoresSnapshot.empty) continue;
          
          // Get the first unfinished score
          const roundDoc = scoresSnapshot.docs[0];
          const roundData = roundDoc.data();
          const groupId = roundData.groupId;
          
          if (!groupId) continue;
          
          // Get all scores with this groupId
          const groupQuery = query(
            collection(db, 'trips', tripDoc.id, 'scores'),
            where('groupId', '==', groupId)
          );
          
          const groupSnapshot = await getDocs(groupQuery);
          const groupRounds = groupSnapshot.docs.map(doc => doc.data());
          
          logger.debug('Found group rounds', {
            groupId,
            roundCount: groupRounds.length,
            category: LOG_CATEGORIES.ROUND,
          });
          
          // Find the first hole index with a zero score in any round
          let firstZeroIdx = null;
          for (const r of groupRounds) {
            if (Array.isArray(r.scores)) {
              const idx = r.scores.findIndex(v => v === 0);
              if (idx !== -1 && (firstZeroIdx === null || idx < firstZeroIdx)) {
                firstZeroIdx = idx;
              }
            }
          }
          
          logger.debug('First incomplete hole found', {
            holeIndex: firstZeroIdx,
            category: LOG_CATEGORIES.ROUND,
          });
          
          if (firstZeroIdx !== null) {
            logger.info('Resuming in-progress round', {
              tripId: tripDoc.id,
              holeNumber: firstZeroIdx + 1,
              playerCount: groupRounds.length,
              roundType: roundData.roundType || 'full',
              category: LOG_CATEGORIES.ROUND,
            });
            
            setCurrentHole(firstZeroIdx);
            setRoundStarted(true);
            setSelectedPlayers(groupRounds.map(r => ({
              ...r,
              name: r.playerName || r.name || 'Unnamed Player',
              playerId: r.playerId,
              scores: r.scores
            })));
            
            // Set the trip
            setSelectedTrip({
              id: tripDoc.id,
              ...tripDoc.data()
            });
            
            // Set the round type
            setRoundType(roundData.roundType || 'full');
            
            // Query the course data from Firestore using courseId
            try {
              const courseDocSnap = await getDocs(query(collection(db, 'courses'), where('__name__', '==', roundData.courseId)));
              let courseObj = null;
              if (!courseDocSnap.empty) {
                const doc = courseDocSnap.docs[0];
                courseObj = { courseId: doc.id, ...doc.data() };
              } else {
                courseObj = { courseId: roundData.courseId, name: roundData.courseName || 'Unnamed Course' };
              }
              setSelectedCourse(courseObj);
            } catch (err) {
              setSelectedCourse({ courseId: roundData.courseId, name: roundData.courseName || 'Unnamed Course' });
            }
            
            setIsRoundFinished(false);
            setResumeDirectToHole(true);
            break;
          }
        }
      } catch (error) {
        logger.error('Error checking for in-progress rounds', {
          error,
          userId,
          category: LOG_CATEGORIES.ROUND,
        });
      }
      
      setCheckingRound(false);
    }
    
    if (user) {
      checkInProgressRound(user.uid);
    } else {
      setCheckingRound(false);
    }
  }, [user, logger]);

  // Fetch most recent trip for user after round check
  useEffect(() => {
    async function fetchMostRecentTrip(userId) {
      try {
        // Get all active trips
        const tripsQuery = query(
          collection(db, 'trips'),
          where('isActive', '==', true)
        );
        const tripsSnapshot = await getDocs(tripsQuery);
        
        const userTrips = [];
        
        // For each trip, check if the user is in the players subcollection
        for (const tripDoc of tripsSnapshot.docs) {
          const playersSnapshot = await getDocs(
            collection(db, 'trips', tripDoc.id, 'players')
          );
          
          const isUserInTrip = playersSnapshot.docs.some(
            playerDoc => playerDoc.data().playerId === userId
          );
          
          if (isUserInTrip) {
            userTrips.push({
              id: tripDoc.id,
              ...tripDoc.data()
            });
          }
        }
        
        // Check if current date falls within any trip's date range
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Reset time to midnight for date-only comparison
        
        const currentTrips = userTrips.filter(trip => {
          const startDate = trip.startDate?.toDate();
          const endDate = trip.endDate?.toDate();
          
          if (startDate && endDate) {
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            return now >= startDate && now <= endDate;
          }
          return false;
        });
        
        let selectedTrip;
        
        if (currentTrips.length > 0) {
          // If there are trips where current date is in range, select the one with earliest start date
          currentTrips.sort((a, b) => {
            const dateA = a.startDate?.toDate() || new Date(0);
            const dateB = b.startDate?.toDate() || new Date(0);
            return dateA - dateB; // Ascending order (earliest first)
          });
          selectedTrip = currentTrips[0];
        } else {
          // If no current trips, sort by end date (most recent first)
          userTrips.sort((a, b) => {
            const dateA = a.endDate?.toDate() || new Date(0);
            const dateB = b.endDate?.toDate() || new Date(0);
            return dateB - dateA; // Descending order (most recent first)
          });
          selectedTrip = userTrips[0];
        }
        
        // Set the selected trip and switch to leaderboard view
        if (selectedTrip && !resumeDirectToHole) {
          logger.info('Selected trip loaded', {
            tripId: selectedTrip.id,
            tripName: selectedTrip.name,
            category: LOG_CATEGORIES.TRIP,
          });
          setSelectedTrip(selectedTrip);
          setView('leaderboard');
        }
      } catch (error) {
        logger.error('Error fetching most recent trip', {
          error,
          userId,
          category: LOG_CATEGORIES.TRIP,
        });
      }
    }

    if (user && !checkingRound) {
      fetchMostRecentTrip(user.uid);
    }
  }, [user, checkingRound, resumeDirectToHole, logger]);

  // Log view changes
  useEffect(() => {
    logger.info('View changed', {
      view,
      category: LOG_CATEGORIES.NAVIGATION,
    });
  }, [view, logger]);

  if (!user) {
    return <AuthForm onAuth={setUser} />;
  }

  if (checkingRound) {
    return <div style={{textAlign: 'center', marginTop: 40}}>Loading...</div>;
  }

  logger.debug('Render state', {
    view,
    roundStarted,
    resumeDirectToHole,
    hasCourse: !!selectedCourse,
    hasTrip: !!selectedTrip,
  });

  return (
    <div className="app-container">
      <header className="header-bar">
        <div className="header-top">
          <h2 className="header-title">ScoreCaddy</h2>
          <div className="header-dropdown">
            <button 
              className="dropdown-toggle"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              ⋮
            </button>
            {dropdownOpen && (
              <div className="dropdown-menu">
                {user?.uid === '0BhToYrQ8ubS910OTUrkAYTXN873' && (
                  <button 
                    className="dropdown-item"
                    onClick={() => {
                      setView('addCourse');
                      setDropdownOpen(false);
                    }}
                  >
                    Add Course
                  </button>
                )}
                <button 
                  className="dropdown-item"
                  onClick={() => {
                    setView('trip');
                    setDropdownOpen(false);
                  }}
                >
                  Create Trip
                </button>
                <button 
                  className="dropdown-item"
                  onClick={() => {
                    setView('tripList');
                    setDropdownOpen(false);
                  }}
                >
                  Select Trip
                </button>
                {selectedTrip && user?.uid === selectedTrip?.organizerId && (
                  <>
                    <button 
                      className="dropdown-item"
                      onClick={() => {
                        setView('editHandicaps');
                        setDropdownOpen(false);
                      }}
                    >
                      Edit Handicaps
                    </button>
                    <button 
                      className="dropdown-item"
                      onClick={() => {
                        setView('editTrip');
                        setDropdownOpen(false);
                      }}
                    >
                      Edit Trip
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <nav className="nav-bar">
          <button
            className={`nav-btn${view === 'leaderboard' ? ' active' : ''}`}
            onClick={() => setView('leaderboard')}
          >
            Leaderboard
          </button>
          <button
            className={`nav-btn${view === 'scorecard' ? ' active' : ''}`}
            onClick={() => setView('scorecard')}
          >
            Scorecard
          </button>
          <button
            className={`nav-btn${view === 'round' ? ' active' : ''}`}
            onClick={() => setView('round')}
          >
            Current Round
          </button>
        </nav>
      </header>

      <main className="main-content">
        {resumeDirectToHole && view === 'round' ? (
          <ErrorBoundary componentName="Hole">
            <Hole
              course={selectedCourse}
              players={selectedPlayers}
              currentHole={currentHole}
              setCurrentHole={setCurrentHole}
              isRoundFinished={isRoundFinished}
              setIsRoundFinished={setIsRoundFinished}
              selectedTrip={selectedTrip}
              roundType={roundType}
              onSubmitRound={() => {
                setCurrentHole(0);
                setSelectedCourse(null);
                setRoundStarted(false);
                setSelectedPlayers([]);
                setIsRoundFinished(false);
                setResumeDirectToHole(false);
                setRoundType('full');
                setView('leaderboard');
              }}
            />
          </ErrorBoundary>
        ) : view === 'round' ? (
          <ErrorBoundary componentName="RoundStart">
            <RoundStart
              currentUserID={user.uid}
              currentHole={currentHole}
              setCurrentHole={setCurrentHole}
              selectedCourse={selectedCourse}
              setSelectedCourse={setSelectedCourse}
              roundStarted={roundStarted}
              setRoundStarted={setRoundStarted}
              selectedPlayers={selectedPlayers}
              setSelectedPlayers={setSelectedPlayers}
              isRoundFinished={isRoundFinished}
              setIsRoundFinished={setIsRoundFinished}
              setView={setView}
              selectedTrip={selectedTrip}
              onSubmitRound={() => {
                setCurrentHole(0);
                setSelectedCourse(null);
                setRoundStarted(false);
                setSelectedPlayers([]);
                setIsRoundFinished(false);
                setView('leaderboard');
              }}
            />
          </ErrorBoundary>
        ) : view === 'scorecard' ? (
          <ErrorBoundary componentName="Scorecard">
            <Scorecard selectedTrip={selectedTrip} />
          </ErrorBoundary>
        ) : view === 'trip' ? (
          <ErrorBoundary componentName="TripScreen">
            <TripScreen currentUser={user} setView={setView} />
          </ErrorBoundary>
        ) : view === 'tripList' ? (
          <ErrorBoundary componentName="TripList">
            <TripList currentUser={user} setView={setView} setSelectedTrip={setSelectedTrip} />
          </ErrorBoundary>
        ) : view === 'addCourse' ? (
          <ErrorBoundary componentName="AddCourse">
            <AddCourse onBack={() => setView('round')} />
          </ErrorBoundary>
        ) : view === 'editHandicaps' ? (
          <ErrorBoundary componentName="EditPlayerHandicap">
            <EditPlayerHandicap 
              tripId={selectedTrip?.id} 
              onBack={() => setView('leaderboard')}
              onSave={() => setView('leaderboard')}
            />
          </ErrorBoundary>
        ) : view === 'editTrip' ? (
          <ErrorBoundary componentName="EditTrip">
            <EditTrip 
              selectedTrip={selectedTrip}
              currentUser={user}
              onBack={() => setView('leaderboard')}
            />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary componentName="Leaderboard">
            <Leaderboard currentUser={user} selectedTrip={selectedTrip} />
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}

export default App