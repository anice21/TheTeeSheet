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


function App() {
  const [view, setView] = useState('round'); // 'round' | 'leaderboard'
  const [currentHole, setCurrentHole] = useState(0);
  const [selectedCourse, setSelectedCourse] = useState(null); // stores selected round index (0-based)
  const [roundStarted, setRoundStarted] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [isRoundFinished, setIsRoundFinished] = useState(false);
  const [user, setUser] = useState(null);
  const [resumeDirectToHole, setResumeDirectToHole] = useState(false);
  const [checkingRound, setCheckingRound] = useState(true);

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
          <Scorecard />
        ) : (
          <Leaderboard currentUser={user} />
        )}
      </main>
    </div>
  );
}

export default App