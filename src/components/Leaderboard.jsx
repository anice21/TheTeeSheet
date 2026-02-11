export default Leaderboard;


import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';


function Leaderboard({ currentUser }) {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [allRounds, setAllRounds] = useState([]); // all rounds for tournament view
  // Default sort: Live = by Total (scoreToPar), ascending (lowest first)
  // Tournament = by total, ascending (lowest first)
  const [sortConfig, setSortConfig] = useState({ key: 'scoreToPar', direction: 'asc' });
  // For tournament leaderboard: key can be 'name', 'total', or courseId
  const [mode, setMode] = useState('live'); // 'live' or 'tournament'
  const [scoreType, setScoreType] = useState('gross');
  const [isDefaultingView, setIsDefaultingView] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      const querySnapshot = await getDocs(collection(db, 'courses'));
      const coursesData = querySnapshot.docs
        .map(doc => ({ ...doc.data(), courseId: doc.id }))
        .filter(course => course.isActive === true);
      setCourses(coursesData);
    };
    fetchCourses();
    // Fetch all rounds for tournament leaderboard
    const fetchAllRounds = async () => {
      const querySnapshot = await getDocs(collection(db, 'rounds'));
      const roundsData = querySnapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id }))
        .filter(round => round.isActive === true);
      setAllRounds(roundsData);
    };
    fetchAllRounds();
  }, []);

  const fetchRoundsForCourse = async (courseObj) => {
    if (courseObj) {
      const q = query(collection(db, 'rounds'), where('courseId', '==', courseObj.courseId));
      const querySnapshot = await getDocs(q);
      const roundsData = querySnapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id }))
        .filter(round => round.isActive === true);
      setRounds(roundsData);
    } else {
      setRounds([]);
    }
  };

  const handleSelectedCourse = async (e) => {
    const courseId = e.target.value;
    const courseObj = courses.find(c => String(c.courseId) === String(courseId));
    setSelectedCourse(courseObj || null);
    await fetchRoundsForCourse(courseObj || null);
  };

  useEffect(() => {
    const defaultLeaderboardView = async () => {
      if (!currentUser || courses.length === 0) {
        if (!currentUser) {
          setIsDefaultingView(false);
        }
        return;
      }

      setIsDefaultingView(true);
      const roundsRef = collection(db, 'rounds');
      const primaryQuery = query(
        roundsRef,
        where('playerID', '==', currentUser.uid),
        where('isRoundFinished', '==', false)
      );
      let querySnapshot = await getDocs(primaryQuery);

      if (querySnapshot.empty) {
        const fallbackQuery = query(
          roundsRef,
          where('playerId', '==', currentUser.uid),
          where('isRoundFinished', '==', false)
        );
        querySnapshot = await getDocs(fallbackQuery);
      }

      if (querySnapshot.empty) {
        setMode('tournament');
        setIsDefaultingView(false);
        return;
      }

      const inProgressRound = querySnapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id }))
        .find(round => round.isActive === true) || querySnapshot.docs[0].data();

      const courseObj = courses.find(c => String(c.courseId) === String(inProgressRound.courseId));
      setMode('live');
      setSelectedCourse(courseObj || null);
      await fetchRoundsForCourse(courseObj || null);
      setIsDefaultingView(false);
    };

    defaultLeaderboardView();
  }, [currentUser, courses]);

  const sortedRounds = React.useMemo(() => {
    if (!rounds) return [];
    return [...rounds].sort((a, b) => {
      let aName = a.playerName || a.playerId || '';
      let bName = b.playerName || b.playerId || '';
      // Score to Par: always sum all values in scoreToPar if present, else null
      const aScoreToPar = Array.isArray(a.scoreToPar)
        ? a.scoreToPar.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0)
        : null;
      const bScoreToPar = Array.isArray(b.scoreToPar)
        ? b.scoreToPar.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0)
        : null;
      if (sortConfig.key === 'name') {
        if (aName < bName) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aName > bName) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      } else if (sortConfig.key === 'scoreToPar') {
        // Sort nulls last
        if (aScoreToPar === null && bScoreToPar === null) return 0;
        if (aScoreToPar === null) return 1;
        if (bScoreToPar === null) return -1;
        return sortConfig.direction === 'asc' ? aScoreToPar - bScoreToPar : bScoreToPar - aScoreToPar;
      }
      return 0;
    });
  }, [rounds, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // Tournament leaderboard sorting
  // Only show completed rounds (isRoundFinished === true)
  const completedRounds = allRounds.filter(r => r.isRoundFinished === true);
  // Get unique completed courseIds in order of completion
  const completedCourseIds = Array.from(
    new Set(completedRounds.map(r => r.courseId))
  );
  // Only show courses that have completed rounds
  const completedCourses = courses.filter(c => completedCourseIds.includes(c.courseId));

  const sortedTournamentPlayers = React.useMemo(() => {
    if (!completedRounds || !completedCourses) return [];
    // Get all unique player names/IDs from completed rounds
    const playerMap = {};
    completedRounds.forEach(r => {
      const key = r.playerName || r.playerId;
      if (!playerMap[key]) playerMap[key] = { playerName: r.playerName, playerId: r.playerId };
    });
    const players = Object.values(playerMap);
    // Compute scores for each player per completed course and total
    const playerRows = players.map(player => {
      let totalScore = 0;
      const courseScores = completedCourses.map(course => {
        // Only use finished rounds for this player and course
        const round = completedRounds.find(r => (r.playerId === player.playerId || r.playerName === player.playerName) && r.courseId === course.courseId && r.isRoundFinished === true);
        let score = '-';
        if (round && Array.isArray(round.scores)) {
          if (scoreType === 'gross') {
            score = round.scores.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
            totalScore += typeof score === 'number' ? score : 0;
          } else if (scoreType === 'net') {
            const gross = round.scores.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
            const handicap = typeof round.playerHandicap === 'number' ? round.playerHandicap : 0;
            score = gross - handicap;
            totalScore += typeof score === 'number' ? score : 0;
          }
        }
        return score;
      });
      return {
        playerName: player.playerName,
        playerId: player.playerId,
        courseScores,
        totalScore
      };
    });
    // Sorting logic
    return [...playerRows].sort((a, b) => {
      if (sortConfig.key === 'name') {
        const aName = a.playerName || a.playerId || '';
        const bName = b.playerName || b.playerId || '';
        if (aName < bName) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aName > bName) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      } else if (sortConfig.key === 'total') {
        return sortConfig.direction === 'asc' ? a.totalScore - b.totalScore : b.totalScore - a.totalScore;
      } else {
        // sortConfig.key is a courseId
        const idx = completedCourses.findIndex(c => String(c.courseId) === String(sortConfig.key));
        const aScore = a.courseScores[idx];
        const bScore = b.courseScores[idx];
        // Only sort numbers, keep '-' at the end
        if (aScore === '-' && bScore === '-') return 0;
        if (aScore === '-') return 1;
        if (bScore === '-') return -1;
        return sortConfig.direction === 'asc' ? aScore - bScore : bScore - aScore;
      }
    });
  }, [completedRounds, completedCourses, scoreType, sortConfig]);

  // Tournament leaderboard sort handler
  const handleTournamentSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  if (isDefaultingView) {
    return (
      <div className="leaderboard-container">
        <h1>Mesquite 2026</h1>
        <p className="leaderboard-empty-msg">Loading leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="leaderboard-container">
      <h1>Mesquite 2026</h1>
      <div className="leaderboard-mode-bar">
        <button
          className={`leaderboard-mode-btn nav-btn${mode === 'live' ? ' active' : ''}`}
          type="button"
          onClick={() => setMode('live')}
        >
          Live Leaderboard
        </button>
        <button
          className={`leaderboard-mode-btn nav-btn${mode === 'tournament' ? ' active' : ''}`}
          type="button"
          onClick={() => setMode('tournament')}
        >
          Tournament Leaderboard
        </button>
      </div>
      {mode === 'live' && (
        <label>
          Course:
          <select className="select-dropdown" name="selectedCourse" value={selectedCourse ? selectedCourse.courseId : ''} onChange={handleSelectedCourse}>
            <option value="" disabled>Select a Course</option>
            {[...courses]
              .sort((a, b) => {
                // Sort by tripRoundID numerically, missing/non-numeric last
                const aTrip = Number(a.tripRoundID);
                const bTrip = Number(b.tripRoundID);
                if (isNaN(aTrip) && isNaN(bTrip)) return 0;
                if (isNaN(aTrip)) return 1;
                if (isNaN(bTrip)) return -1;
                return aTrip - bTrip;
              })
              .map((course) => (
                <option key={String(course.courseId)} value={course.courseId}>
                  {course.tripRoundID ? `R${course.tripRoundID}: ` : ''}{course.name}
                </option>
              ))}
          </select>
        </label>
      )}

      {selectedCourse && mode === 'live' && (
        <div className="leaderboard-live-table-wrapper">
          {/* Removed course name header for Live Leaderboard */}
          {rounds.length === 0 ? (
            <p className="leaderboard-empty-msg">No rounds found for this course.</p>
          ) : (
            <table className="leaderboard-table leaderboard-table-live">
              <thead>
                <tr className="leaderboard-header-row">
                  <th className="leaderboard-th leaderboard-th-place leaderboard-th-live-place"></th>
                  <th className="leaderboard-th leaderboard-th-name" onClick={() => handleSort('name')}>
                    <span className="leaderboard-th-label">Name</span>
                    <span className="leaderboard-th-arrow">
                      {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '\u00A0'}
                    </span>
                  </th>
                  <th className="leaderboard-th leaderboard-th-scoretopar" onClick={() => handleSort('scoreToPar')}>Total</th>
                  <th className="leaderboard-th leaderboard-th-hole">Thru</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Calculate places with tie logic and assign T# to all tied players
                  let lastScore = null;
                  let lastPlace = 0;
                  let skip = 1;
                  const places = [];
                  const tieFlags = [];
                  sortedRounds.forEach((round, idx) => {
                    const scoreToPar = Array.isArray(round.scoreToPar)
                      ? round.scoreToPar.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0)
                      : null;
                    let place;
                    let isTied = false;
                    if (idx === 0) {
                      place = 1;
                      skip = 1;
                      isTied = false;
                    } else {
                      const prevScore = Array.isArray(sortedRounds[idx - 1].scoreToPar)
                        ? sortedRounds[idx - 1].scoreToPar.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0)
                        : null;
                      if (scoreToPar === prevScore) {
                        place = lastPlace;
                        skip++;
                        isTied = true;
                        // Mark previous as tied too
                        tieFlags[idx - 1] = true;
                      } else {
                        place = lastPlace + skip;
                        skip = 1;
                        isTied = false;
                      }
                    }
                    lastScore = scoreToPar;
                    lastPlace = place;
                    places.push(place);
                    tieFlags.push(isTied);
                  });
                  return sortedRounds.map((round, idx) => {
                    const scoreToPar = Array.isArray(round.scoreToPar)
                      ? round.scoreToPar.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0)
                      : null;
                    // Hole: display 'F' if all scores are non-zero, else count of non-zero scores
                    let hole = 0;
                    if (Array.isArray(round.scores)) {
                      const nonZeroCount = round.scores.filter(v => typeof v === 'number' && v > 0).length;
                      const hasZero = round.scores.some(v => v === 0);
                      hole = !hasZero ? 'F' : nonZeroCount;
                    }
                    // Use tieFlags to determine if tied
                    let placeLabel = tieFlags[idx] ? `T${places[idx]}` : `${places[idx]}`;
                    return (
                      <tr key={round.id || idx} className={idx % 2 === 0 ? 'leaderboard-row-even' : 'leaderboard-row-odd'}>
                        <td className="leaderboard-td leaderboard-td-place leaderboard-td-live-place">{placeLabel}</td>
                        <td className="leaderboard-td leaderboard-td-name">{round.playerName || round.playerId}</td>
                        <td className="leaderboard-td leaderboard-td-scoretopar" data-score={scoreToPar}>{
                          scoreToPar === 0
                            ? 'E'
                            : (scoreToPar !== null
                                ? (scoreToPar > 0 ? `+${scoreToPar}` : scoreToPar)
                                : 'N/A')
                        }</td>
                        <td className="leaderboard-td leaderboard-td-hole">{hole}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          )}
        </div>
      )}

      {mode === 'tournament' && (
        <div className="leaderboard-tournament-table-wrapper">
          <h3 className="leaderboard-tournament-title">Tournament Leaderboard</h3>
          <div className="leaderboard-tournament-scoretype-bar">
            <select
              className="select-dropdown"
              name="scoreType"
              value={scoreType}
              onChange={e => setScoreType(e.target.value)}
            >
              <option value="gross">Gross</option>
              <option value="net">Net</option>
            </select>
          </div>
          {allRounds.length === 0 ? (
            <p className="leaderboard-empty-msg">No tournament rounds found.</p>
          ) : (
            <div className="leaderboard-tournament-table-scroll">
              <table className="leaderboard-table leaderboard-table-tournament">
                <thead>
                  <tr className="leaderboard-header-row">
                    <th className="leaderboard-th leaderboard-th-place leaderboard-th-tournament-place"></th>
                    <th
                      className="leaderboard-th leaderboard-th-name leaderboard-th-tournament-name"
                      onClick={() => handleTournamentSort('name')}
                    >
                      <span className="leaderboard-th-label">Name</span>
                    </th>
                    {completedCourses.map((course, idx) => (
                      <th
                        key={course.courseId}
                        className="leaderboard-th leaderboard-th-tournament-round"
                        onClick={() => handleTournamentSort(course.courseId)}
                      >
                        <span>{`R${idx + 1}`}</span>
                      </th>
                    ))}
                    <th
                      className="leaderboard-th leaderboard-th-tournament-total"
                      onClick={() => handleTournamentSort('total')}
                    >
                      <span>Total</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTournamentPlayers.map((player, idx) => (
                    <tr key={player.playerId || player.playerName || idx} className={idx % 2 === 0 ? 'leaderboard-row-even' : 'leaderboard-row-odd'}>
                      <td className="leaderboard-td leaderboard-td-place leaderboard-td-tournament-place">{idx + 1}</td>
                      <td className="leaderboard-td leaderboard-td-name leaderboard-td-tournament-name">{player.playerName || player.playerId}</td>
                      {player.courseScores.map((score, i) => (
                        <td
                          key={i}
                          className="leaderboard-td leaderboard-td-tournament-round"
                        >
                          {score}
                        </td>
                      ))}
                      <td className="leaderboard-td leaderboard-td-tournament-total">{player.totalScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}