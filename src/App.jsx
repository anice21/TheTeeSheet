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


function App() {
  const [view, setView] = useState('round'); // 'round' | 'leaderboard' | 'trip' | 'tripList' | 'addCourse'
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

  // On mount, listen for auth state changes
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  // On user load, check for unfinished round where user is scoreKeeper
  useEffect(() => {
    async function checkInProgressRound(userId) {
      setCheckingRound(true);
      // Step 1: Find the user's in-progress round where they are scoreKeeper

      console.log("Checking for in-progress rounds for user:", userId);

      const q = query(
        collection(db, 'rounds'),
        where('scoreKeeper', '==', true),
        where('playerId', '==', userId),
        where('isRoundFinished', '==', false)
      );

      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setCheckingRound(false);
        return;
      }
      // Get the groupId from the first matching round
      const roundDoc = querySnapshot.docs[0];
      const roundData = roundDoc.data();
      const groupId = roundData.groupId;
      if (!groupId) {
        setCheckingRound(false);
        return;
      }


      // Step 2: Get all rounds with this groupId
      const groupQ = query(
        collection(db, 'rounds'),
        where('groupId', '==', groupId)
      )

      const groupSnapshot = await getDocs(groupQ);
      const groupRounds = groupSnapshot.docs.map(doc => doc.data());

      console.log("Found group rounds for groupId", groupId, ":", groupRounds);

      // Step 3: Find the first hole index with a zero score in any round
      let firstZeroIdx = null;
      for (const r of groupRounds) {
        if (Array.isArray(r.scores)) {
          const idx = r.scores.findIndex(v => v === 0);
          if (idx !== -1 && (firstZeroIdx === null || idx < firstZeroIdx)) {
            firstZeroIdx = idx;
          }
        }
      }

      console.log("First zero score index found at hole:", firstZeroIdx);

      if (firstZeroIdx !== null) {
        setCurrentHole(firstZeroIdx); 
        setRoundStarted(true);
        setSelectedPlayers(groupRounds.map(r => ({
          ...r,
          name: r.playerName || r.name || 'Unnamed Player',
          playerId: r.playerId
        })));
        // Query the course data from Firestore using courseId
        try {
          const courseDocSnap = await getDocs(query(collection(db, 'courses'), where('__name__', '==', roundData.courseId)));
          let courseObj = null;
          if (!courseDocSnap.empty) {
            const doc = courseDocSnap.docs[0];
            courseObj = { courseId: doc.id, ...doc.data() };
          } else {
            // fallback if not found
            courseObj = { courseId: roundData.courseId, name: roundData.courseName || 'Unnamed Course' };
          }
          setSelectedCourse(courseObj);
        } catch (err) {
          setSelectedCourse({ courseId: roundData.courseId, name: roundData.courseName || 'Unnamed Course' });
        }
        setIsRoundFinished(false);
        setResumeDirectToHole(true);
        console.log("Resuming group round at hole", firstZeroIdx + 1);
        console.log("Group round data:", groupRounds);
      }
      setCheckingRound(false);
    }
    if (user) {
      checkInProgressRound(user.uid);
    } else {
      setCheckingRound(false);
    }
  }, [user]);

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
        
        // Sort trips by start date (most recent first)
        userTrips.sort((a, b) => {
          const dateA = a.startDate?.toDate() || new Date(0);
          const dateB = b.startDate?.toDate() || new Date(0);
          return dateB - dateA;
        });
        
        // Set the most recent trip and switch to leaderboard view
        if (userTrips.length > 0 && !resumeDirectToHole) {
          setSelectedTrip(userTrips[0]);
          setView('leaderboard');
        }
      } catch (error) {
        console.error('Error fetching most recent trip:', error);
      }
    }

    if (user && !checkingRound) {
      fetchMostRecentTrip(user.uid);
    }
  }, [user, checkingRound, resumeDirectToHole]);

  if (!user) {
    return <AuthForm onAuth={setUser} />;
  }

  if (checkingRound) {
    return <div style={{textAlign: 'center', marginTop: 40}}>Loading...</div>;
  }

  console.log("Resume direct to hole:", resumeDirectToHole);

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
          <Hole
            course={selectedCourse}
            players={selectedPlayers}
            currentHole={currentHole}
            setCurrentHole={setCurrentHole}
            isRoundFinished={isRoundFinished}
            setIsRoundFinished={setIsRoundFinished}
            onSubmitRound={() => {
              setCurrentHole(0);
              setSelectedCourse(null);
              setRoundStarted(false);
              setSelectedPlayers([]);
              setIsRoundFinished(false);
              setResumeDirectToHole(false);
              setView('leaderboard');
            }}
          />
        ) : view === 'round' ? (
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
              setSelectedCourse(null); // Don't clear selectedCourse so it can be passed to Leaderboard
              setRoundStarted(false);
              setSelectedPlayers([]);
              setIsRoundFinished(false);
              setView('leaderboard');
            }}
          />
        ) : view === 'scorecard' ? (
          <Scorecard selectedTrip={selectedTrip} />
        ) : view === 'trip' ? (
          <TripScreen currentUser={user} setView={setView} />
        ) : view === 'tripList' ? (
          <TripList currentUser={user} setView={setView} setSelectedTrip={setSelectedTrip} />
        ) : view === 'addCourse' ? (
          <AddCourse onBack={() => setView('round')} />
        ) : (
          <Leaderboard currentUser={user} selectedTrip={selectedTrip} />
        )}
      </main>
    </div>
  );
}

export default App