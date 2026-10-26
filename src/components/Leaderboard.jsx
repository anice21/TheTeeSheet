export default Leaderboard;


import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { calculateHoleScores, getFallbackHoleHandicaps } from '../utils/scoring/handicap';


function Leaderboard({ currentUser, selectedTrip }) {
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
      if (!selectedTrip) {
        setCourses([]);
        return;
      }
      
      // Get all rounds for this trip
      const tripRoundsSnapshot = await getDocs(collection(db, 'trips', selectedTrip.id, 'rounds'));
      const tripRounds = tripRoundsSnapshot.docs.map(doc => ({ 
        ...doc.data(), 
        id: doc.id,
        name: doc.data().courseName // Use courseName as name for consistency
      }));
      
      setCourses(tripRounds);
    };
    fetchCourses();
    // Fetch all rounds for tournament leaderboard
    const fetchAllRounds = async () => {
      if (!selectedTrip) {
        setAllRounds([]);
        return;
      }
      const querySnapshot = await getDocs(collection(db, 'trips', selectedTrip.id, 'scores'));
      const roundsData = querySnapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id }))
        .filter(round => round.isActive === true);
      setAllRounds(roundsData);
    };
    fetchAllRounds();
  }, [selectedTrip]);

  const fetchRoundsForCourse = async (courseObj) => {
    if (courseObj && selectedTrip) {
      const q = query(
        collection(db, 'trips', selectedTrip.id, 'scores'),
        where('tripRoundID', '==', courseObj.tripRoundID)
      );
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
    const roundId = e.target.value;
    const courseObj = courses.find(c => c.id === roundId);
    if (courseObj?.courseId) {
      const courseSnapshot = await getDoc(doc(db, 'courses', String(courseObj.courseId)));
      setSelectedCourse(courseSnapshot.exists()
        ? { ...courseObj, ...courseSnapshot.data(), id: courseObj.id, courseId: courseSnapshot.id }
        : courseObj);
    } else {
      setSelectedCourse(courseObj || null);
    }
    await fetchRoundsForCourse(courseObj || null);
  };

  useEffect(() => {
    const defaultLeaderboardView = async () => {
      if (!currentUser || courses.length === 0 || !selectedTrip) {
        setIsDefaultingView(false);
        return;
      }

      setIsDefaultingView(true);
      const roundsRef = collection(db, 'trips', selectedTrip.id, 'scores');
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

      // Sort by tripRoundID descending to get the most recent round
      const rounds = querySnapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id }))
        .sort((a, b) => Number(b.tripRoundID || 0) - Number(a.tripRoundID || 0));
      
      console.log('Leaderboard - Unfinished rounds:', rounds.map(r => ({ tripRoundID: r.tripRoundID, isActive: r.isActive })));
      
      const inProgressRound = rounds.find(round => round.isActive === true) || rounds[0];
      console.log('Leaderboard - Selected round:', { tripRoundID: inProgressRound.tripRoundID });

      const courseObj = courses.find(c => c.tripRoundID === inProgressRound.tripRoundID);
      setMode('live');
      if (courseObj?.courseId) {
        const courseSnapshot = await getDoc(doc(db, 'courses', String(courseObj.courseId)));
        setSelectedCourse(courseSnapshot.exists()
          ? { ...courseObj, ...courseSnapshot.data(), id: courseObj.id, courseId: courseSnapshot.id }
          : courseObj);
      } else {
        setSelectedCourse(courseObj || null);
      }
      await fetchRoundsForCourse(courseObj || null);
      setIsDefaultingView(false);
    };

    defaultLeaderboardView();
  }, [currentUser, courses, selectedTrip]);

  useEffect(() => {
    if (mode === 'tournament') {
      setSortConfig({ key: 'total', direction: 'asc' });
    } else if (mode === 'live') {
      setSortConfig({ key: 'scoreToPar', direction: 'asc' });
    }
  }, [mode]);

  // Calculate team leaderboard
  const calculateTeamLeaderboard = React.useMemo(() => {
    if (!rounds || rounds.length === 0) return [];
    
    const bestBallRounds = rounds.filter(r => r.format === 'bestball');
    if (bestBallRounds.length === 0) return [];
    
    // Group by teamId
    const teams = {};
    bestBallRounds.forEach(round => {
      const teamId = round.teamId;
      if (!teamId) return;
      
      if (!teams[teamId]) {
        teams[teamId] = {
          teamId,
          teamName: round.teamName || `Team ${teamId.substring(0, 6)}`,
          groupId: round.groupId,
          players: [],
          teamScores: Array(18).fill(null),
          teamScoreToPar: 0
        };
      }
      
      teams[teamId].players.push({
        playerId: round.playerId,
        playerName: round.playerName,
        scores: round.scores,
        netScores: scoreType === 'net'
          ? (Array.isArray(round.netScores)
            ? round.netScores
            : calculateHoleScores(
                round.scores,
                selectedCourse?.pars,
                selectedCourse?.holeHandicaps || getFallbackHoleHandicaps(),
                round.playerHandicap
              ).netScores)
          : null,
        scoreToPar: round.scoreToPar
      });
    });
    
    // Calculate best ball scores for each team
    Object.values(teams).forEach(team => {
      for (let hole = 0; hole < 18; hole++) {
        const holeScores = team.players
          .map(p => scoreType === 'net' ? p.netScores?.[hole] : p.scores?.[hole])
          .filter(s => typeof s === 'number' && s > 0);
        
        if (holeScores.length > 0) {
          team.teamScores[hole] = Math.min(...holeScores);
        }
      }
      
      // Calculate the team's score relative to par using its best score on each hole.
      if (Array.isArray(selectedCourse?.pars)) {
        team.teamScoreToPar = team.teamScores.reduce((sum, score, idx) => {
          if (score === null) return sum;
          return sum + (score - (selectedCourse.pars[idx] ?? 0));
        }, 0);
      } else {
        team.teamScoreToPar = Array.from({ length: 18 }, (_, hole) => {
          const holeScoresToPar = team.players
            .map(player => ({ score: player.scores?.[hole], toPar: player.scoreToPar?.[hole] }))
            .filter(({ score, toPar }) => score > 0 && typeof toPar === 'number')
            .map(({ toPar }) => toPar);

          return holeScoresToPar.length > 0 ? Math.min(...holeScoresToPar) : 0;
        }).reduce((sum, scoreToPar) => sum + scoreToPar, 0);
      }
    });
    
    return Object.values(teams).sort((a, b) => a.teamScoreToPar - b.teamScoreToPar);
  }, [rounds, selectedCourse, scoreType]);
  
  const hasBestBallRounds = rounds && rounds.some(r => r.format === 'bestball');
  
  const sortedRounds = React.useMemo(() => {
    if (!rounds) return [];
    return [...rounds].sort((a, b) => {
      let aName = a.playerName || a.playerId || '';
      let bName = b.playerName || b.playerId || '';
      // Score to Par: always sum all values in scoreToPar if present, else null
      const aScoreToPar = Array.isArray(scoreType === 'net' ? a.netScoreToPar : a.scoreToPar)
        ? (scoreType === 'net' ? a.netScoreToPar : a.scoreToPar).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0)
        : null;
      const bScoreToPar = Array.isArray(scoreType === 'net' ? b.netScoreToPar : b.scoreToPar)
        ? (scoreType === 'net' ? b.netScoreToPar : b.scoreToPar).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0)
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
  }, [rounds, sortConfig, scoreType]);

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
  // Get unique completed tripRoundIDs
  const completedTripRoundIDs = Array.from(
    new Set(completedRounds.map(r => r.tripRoundID))
  );
  // Only show rounds that have completed scores, sorted by tripRoundID asc
  const completedCourses = courses
    .filter(c => completedTripRoundIDs.includes(c.tripRoundID))
    .sort((a, b) => {
      const aTrip = Number(a.tripRoundID);
      const bTrip = Number(b.tripRoundID);
      if (Number.isNaN(aTrip) && Number.isNaN(bTrip)) return 0;
      if (Number.isNaN(aTrip)) return 1;
      if (Number.isNaN(bTrip)) return -1;
      return aTrip - bTrip;
    });

  const sortedTournamentPlayers = React.useMemo(() => {
    if (!completedRounds || !completedCourses) return [];
    // Get all unique player names/IDs from completed rounds
    const playerMap = {};
    completedRounds.forEach(r => {
      const key = r.playerName || r.playerId;
      if (!playerMap[key]) playerMap[key] = { playerName: r.playerName, playerId: r.playerId };
    });
    const players = Object.values(playerMap);
    // Compute scores for each player per completed round and total
    const playerRows = players.map(player => {
      let totalScore = 0;
      const courseScores = completedCourses.map(course => {
        // Only use finished rounds for this player and tripRoundID
        const round = completedRounds.find(r => (r.playerId === player.playerId || r.playerName === player.playerName) && r.tripRoundID === course.tripRoundID && r.isRoundFinished === true);
        let score = '-';
        if (round && Array.isArray(round.scores)) {
          if (scoreType === 'gross') {
            score = round.scores.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
            totalScore += typeof score === 'number' ? score : 0;
          } else if (scoreType === 'net') {
            const netScores = Array.isArray(round.netScores)
              ? round.netScores
              : calculateHoleScores(
                  round.scores,
                  courses.find(course => course.tripRoundID === round.tripRoundID)?.pars,
                  courses.find(course => course.tripRoundID === round.tripRoundID)?.holeHandicaps || getFallbackHoleHandicaps(),
                  round.playerHandicap
                ).netScores;
            score = netScores.reduce((sum, v) => sum + (typeof v === 'number' && v > 0 ? v : 0), 0);
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
        // sortConfig.key is a round id
        const idx = completedCourses.findIndex(c => c.id === sortConfig.key);
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

  const sortedTournamentTeams = React.useMemo(() => {
    if (!completedRounds || !completedCourses) return [];

    const teamMap = {};
    completedRounds
      .filter(round => round.format === 'bestball' && round.teamId)
      .forEach(round => {
        const teamMembers = completedRounds
          .filter(candidate => (
            candidate.format === 'bestball' &&
            candidate.tripRoundID === round.tripRoundID &&
            candidate.teamId === round.teamId
          ))
          .map(candidate => candidate.playerId || candidate.playerName)
          .sort()
          .join('|');
        const teamKey = teamMembers || round.teamId;

        if (!teamMap[teamKey]) {
          teamMap[teamKey] = {
            teamKey,
            teamName: round.teamName || 'Team',
            players: [],
            courseScores: [],
            totalScore: 0
          };
        }

        const playerName = round.playerName || round.playerId;
        if (!teamMap[teamKey].players.includes(playerName)) {
          teamMap[teamKey].players.push(playerName);
        }
      });

    Object.values(teamMap).forEach(team => {
      team.courseScores = completedCourses.map(course => {
        const teamRounds = completedRounds.filter(round => {
          if (round.format !== 'bestball' || round.tripRoundID !== course.tripRoundID) return false;
          const members = completedRounds
            .filter(candidate => (
              candidate.format === 'bestball' &&
              candidate.tripRoundID === round.tripRoundID &&
              candidate.teamId === round.teamId
            ))
            .map(candidate => candidate.playerId || candidate.playerName)
            .sort()
            .join('|');
          return members === team.teamKey;
        });

        if (teamRounds.length === 0) return '-';

        const teamScores = Array.from({ length: 18 }, (_, hole) => {
          const holeScores = teamRounds
            .map(round => scoreType === 'net' ? round.netScores?.[hole] : round.scores?.[hole])
            .filter(score => typeof score === 'number' && score > 0);
          return holeScores.length > 0 ? Math.min(...holeScores) : null;
        });

        return teamScores.reduce((sum, score) => sum + (score || 0), 0);
      });

      team.totalScore = team.courseScores.reduce(
        (sum, score) => sum + (typeof score === 'number' ? score : 0),
        0
      );
    });

    return Object.values(teamMap).sort((a, b) => {
      if (sortConfig.key === 'name') {
        return sortConfig.direction === 'asc'
          ? a.teamName.localeCompare(b.teamName)
          : b.teamName.localeCompare(a.teamName);
      }
      if (sortConfig.key === 'total') {
        return sortConfig.direction === 'asc' ? a.totalScore - b.totalScore : b.totalScore - a.totalScore;
      }
      const index = completedCourses.findIndex(course => course.id === sortConfig.key);
      const aScore = a.courseScores[index];
      const bScore = b.courseScores[index];
      if (aScore === '-' && bScore === '-') return 0;
      if (aScore === '-') return 1;
      if (bScore === '-') return -1;
      return sortConfig.direction === 'asc' ? aScore - bScore : bScore - aScore;
    });
  }, [completedRounds, completedCourses, scoreType, sortConfig]);

  const hasCompletedBestBallRounds = completedRounds.some(round => round.format === 'bestball');

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
        <h1>{selectedTrip?.name || 'No Trip Selected'}</h1>
        <p className="leaderboard-empty-msg">Loading leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="leaderboard-container">
      <h1>{selectedTrip?.name || 'No Trip Selected'}</h1>
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
          <select className="select-dropdown" name="selectedCourse" value={selectedCourse ? selectedCourse.id : ''} onChange={handleSelectedCourse}>
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
                <option key={course.id} value={course.id}>
                  {course.tripRoundID ? `R${course.tripRoundID}: ` : ''}{course.name}
                </option>
              ))}
          </select>
        </label>
      )}

      {mode === 'live' && selectedCourse && (
        <div className="leaderboard-tournament-scoretype-bar" style={{ marginTop: '1rem' }}>
          <select
            className="select-dropdown"
            name="liveScoreType"
            value={scoreType}
            onChange={e => setScoreType(e.target.value)}
          >
            <option value="gross">Gross</option>
            <option value="net">Net</option>
          </select>
        </div>
      )}

      {selectedCourse && mode === 'live' && (
        <div className="leaderboard-live-table-wrapper">
          {/* Removed course name header for Live Leaderboard */}
          {rounds.length === 0 ? (
            <p className="leaderboard-empty-msg">No rounds found for this course.</p>
          ) : hasBestBallRounds ? (
            <table className="leaderboard-table leaderboard-table-live">
              <thead>
                <tr className="leaderboard-header-row">
                  <th className="leaderboard-th leaderboard-th-place leaderboard-th-live-place"></th>
                  <th className="leaderboard-th leaderboard-th-name">Players</th>
                  <th className="leaderboard-th leaderboard-th-scoretopar">Total</th>
                  <th className="leaderboard-th leaderboard-th-hole">Thru</th>
                </tr>
              </thead>
              <tbody>
                {calculateTeamLeaderboard.map((team, idx) => {
                  // Calculate holes completed (thru)
                  const holesCompleted = team.teamScores.filter(s => s !== null).length;
                  const thru = holesCompleted === 18 ? 'F' : holesCompleted;
                  
                  return (
                    <tr key={team.teamId} className={idx % 2 === 0 ? 'leaderboard-row-even' : 'leaderboard-row-odd'}>
                      <td className="leaderboard-td leaderboard-td-place leaderboard-td-live-place">{idx + 1}</td>
                      <td className="leaderboard-td leaderboard-td-name">{team.players.map(p => p.playerName).join(', ')}</td>
                      <td className="leaderboard-td leaderboard-td-scoretopar" data-score={team.teamScoreToPar}>{
                        team.teamScoreToPar === 0
                          ? 'E'
                          : (team.teamScoreToPar > 0 ? `+${team.teamScoreToPar}` : team.teamScoreToPar)
                      }</td>
                      <td className="leaderboard-td leaderboard-td-hole">{thru}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
                    const roundScoreToPar = scoreType === 'net' ? round.netScoreToPar : round.scoreToPar;
                    const scoreToPar = Array.isArray(roundScoreToPar)
                      ? roundScoreToPar.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0)
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
                    const roundScoreToPar = scoreType === 'net' ? round.netScoreToPar : round.scoreToPar;
                    const scoreToPar = Array.isArray(roundScoreToPar)
                      ? roundScoreToPar.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0)
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
                      <span className="leaderboard-th-label">{hasCompletedBestBallRounds ? 'Players' : 'Name'}</span>
                    </th>
                    {completedCourses.map((course, idx) => (
                      <th
                        key={course.id}
                        className="leaderboard-th leaderboard-th-tournament-round"
                        onClick={() => handleTournamentSort(course.id)}
                      >
                        <span>{course.tripRoundID ? `R${course.tripRoundID}` : `R${idx + 1}`}</span>
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
                  {hasCompletedBestBallRounds
                    ? sortedTournamentTeams.map((team, idx) => (
                        <tr key={team.teamKey} className={idx % 2 === 0 ? 'leaderboard-row-even' : 'leaderboard-row-odd'}>
                          <td className="leaderboard-td leaderboard-td-place leaderboard-td-tournament-place">{idx + 1}</td>
                          <td className="leaderboard-td leaderboard-td-name leaderboard-td-tournament-name">
                            {team.players.join(', ')}
                          </td>
                          {team.courseScores.map((score, i) => (
                            <td key={i} className="leaderboard-td leaderboard-td-tournament-round">{score}</td>
                          ))}
                          <td className="leaderboard-td leaderboard-td-tournament-total">{team.totalScore}</td>
                        </tr>
                      ))
                    : sortedTournamentPlayers.map((player, idx) => (
                        <tr key={player.playerId || player.playerName || idx} className={idx % 2 === 0 ? 'leaderboard-row-even' : 'leaderboard-row-odd'}>
                          <td className="leaderboard-td leaderboard-td-place leaderboard-td-tournament-place">{idx + 1}</td>
                          <td className="leaderboard-td leaderboard-td-name leaderboard-td-tournament-name">{player.playerName || player.playerId}</td>
                          {player.courseScores.map((score, i) => (
                            <td key={i} className="leaderboard-td leaderboard-td-tournament-round">{score}</td>
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