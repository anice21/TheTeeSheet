import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const Scorecard = ({ selectedTrip }) => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [groups, setGroups] = useState([]); // [{ groupId, playerNames: [] }]
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [scorecardData, setScorecardData] = useState(null);
  const [loadingScorecard, setLoadingScorecard] = useState(false);
  const [defaultCourseId, setDefaultCourseId] = useState(null);
  const [defaultGroupId, setDefaultGroupId] = useState(null);
  const [fullCourseData, setFullCourseData] = useState(null);

  useEffect(() => {
    async function fetchCourses() {
      if (!selectedTrip) {
        setCourses([]);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        // Get all rounds for this trip
        const tripRoundsSnapshot = await getDocs(collection(db, 'trips', selectedTrip.id, 'rounds'));
        const tripRounds = tripRoundsSnapshot.docs.map(doc => ({ 
          ...doc.data(), 
          id: doc.id,
          name: doc.data().courseName // Use courseName as name for consistency
        }));
        
        setCourses(tripRounds);
      } catch (error) {
        console.error('Error fetching courses:', error);
      }
      setLoading(false);
    }
    fetchCourses();
  }, [selectedTrip]);

  useEffect(() => {
    async function fetchInProgressRound() {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser || !selectedTrip) return;

      try {
        const scoresRef = collection(db, 'trips', selectedTrip.id, 'scores');
        const primaryQuery = query(
          scoresRef,
          where('playerID', '==', currentUser.uid),
          where('isRoundFinished', '==', false)
        );

        let querySnapshot = await getDocs(primaryQuery);
        if (querySnapshot.empty) {
          const fallbackQuery = query(
            scoresRef,
            where('playerId', '==', currentUser.uid),
            where('isRoundFinished', '==', false)
          );
          querySnapshot = await getDocs(fallbackQuery);
        }

        if (querySnapshot.empty) return;

        const roundData = querySnapshot.docs[0].data();
        setDefaultCourseId(roundData.courseId || null);
        setDefaultGroupId(roundData.groupId || null);
      } catch (error) {
        console.error('Error fetching in-progress round for scorecard:', error);
      }
    }

    fetchInProgressRound();
  }, [selectedTrip]);

  useEffect(() => {
    if (!defaultCourseId || selectedCourse) return;
    const courseMatch = courses.find(course => course.id === defaultCourseId || course.courseId === defaultCourseId);
    if (courseMatch) {
      setSelectedCourse(courseMatch.id);
    }
  }, [courses, defaultCourseId, selectedCourse]);

  // Fetch groups when a course is selected
  useEffect(() => {
    async function fetchGroups() {
      if (!selectedCourse || !selectedTrip) {
        setGroups([]);
        setSelectedGroup('');
        return;
      }
      setLoadingGroups(true);
      try {
        // Fetch scores for the selected course from trip scores subcollection
        const querySnapshot = await getDocs(collection(db, 'trips', selectedTrip.id, 'scores'));
        const groupMap = new Map();
        const courseMatch = courses.find(course => course.id === selectedCourse) || null;
        const selectedTripRoundID = courseMatch?.tripRoundID;

        querySnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.tripRoundID === selectedTripRoundID && data.groupId && data.isActive) {
            if (!groupMap.has(data.groupId)) {
              groupMap.set(data.groupId, []);
            }
            // Add player name if available
            if (data.playerName) {
              groupMap.get(data.groupId).push(data.playerName);
            } else if (data.playerId) {
              groupMap.get(data.groupId).push(data.playerId);
            }
          }
        });
        // Convert to array of { groupId, playerNames }
        const groupArr = Array.from(groupMap.entries()).map(([groupId, playerNames]) => ({ groupId, playerNames }));
        setGroups(groupArr);
      } catch (error) {
        console.error('Error fetching groups:', error);
        setGroups([]);
      }
      setLoadingGroups(false);
    }
    fetchGroups();
  }, [selectedCourse, courses, selectedTrip]);

  useEffect(() => {
    if (!defaultGroupId || !groups.length) return;
    if (selectedGroup) return;
    const isDefaultCourse = courses.some(course =>
      (course.id === selectedCourse || course.courseId === selectedCourse) &&
      (course.id === defaultCourseId || course.courseId === defaultCourseId)
    );
    if (!isDefaultCourse) return;
    const groupExists = groups.some(group => group.groupId === defaultGroupId);
    if (groupExists) {
      setSelectedGroup(defaultGroupId);
    }
  }, [groups, defaultGroupId, selectedGroup, courses, selectedCourse, defaultCourseId]);

  // Fetch full course data when a round is selected
  useEffect(() => {
    async function fetchFullCourseData() {
      if (!selectedCourse) {
        setFullCourseData(null);
        return;
      }
      
      try {
        const roundData = courses.find(c => c.id === selectedCourse);
        if (!roundData || !roundData.courseId) {
          setFullCourseData(null);
          return;
        }
        
        // Fetch full course details from courses collection
        const coursesSnapshot = await getDocs(collection(db, 'courses'));
        const fullCourse = coursesSnapshot.docs
          .map(doc => ({ ...doc.data(), id: doc.id }))
          .find(course => course.id === roundData.courseId || course.courseId === roundData.courseId);
        
        setFullCourseData(fullCourse || null);
      } catch (error) {
        console.error('Error fetching full course data:', error);
        setFullCourseData(null);
      }
    }
    
    fetchFullCourseData();
  }, [selectedCourse, courses]);

  // Fetch scorecard data when both course and group are selected
  useEffect(() => {
    async function fetchScorecard() {
      if (!selectedCourse || !selectedGroup || !selectedTrip) {
        setScorecardData(null);
        return;
      }
      setLoadingScorecard(true);
      try {
        // Fetch all scores for the selected group and round from trip scores subcollection
        const querySnapshot = await getDocs(collection(db, 'trips', selectedTrip.id, 'scores'));
        const courseMatch = courses.find(course => course.id === selectedCourse) || null;
        const selectedTripRoundID = courseMatch?.tripRoundID;
        const rounds = querySnapshot.docs
          .map(doc => doc.data())
          .filter(r => r.tripRoundID === selectedTripRoundID && r.groupId === selectedGroup && r.isActive);
        setScorecardData(rounds);
      } catch (error) {
        console.error('Error fetching scorecard:', error);
        setScorecardData(null);
      }
      setLoadingScorecard(false);
    }
    fetchScorecard();
  }, [selectedCourse, selectedGroup, courses, selectedTrip]);

  const selectedCourseData = fullCourseData;

  const getHolePar = (course, holeIndex) => {
    if (!course) return null;
    return (
      course.pars?.[holeIndex] ??
      course.holes?.[holeIndex]?.par ??
      course.courseHoles?.[holeIndex]?.par ??
      null
    );
  };

  const getIconType = (score, par) => {
    if (!score || !par) return 'none';
    const delta = score - par;
    if (delta <= -3) return 'albatross';
    if (delta === -2) return 'eagle';
    if (delta === -1) return 'birdie';
    if (delta === 0) return 'par';
    if (delta === 1) return 'bogey';
    if (delta === 2) return 'double';
    return 'triple';
  };

  const getIconLabel = (type) => {
    switch (type) {
      case 'albatross':
        return 'Albatross or better';
      case 'eagle':
        return 'Eagle';
      case 'birdie':
        return 'Birdie';
      case 'par':
        return 'Par';
      case 'bogey':
        return 'Bogey';
      case 'double':
        return 'Double bogey';
      case 'triple':
        return 'Triple bogey or worse';
      default:
        return '';
    }
  };

  const isSolidIcon = (type) =>
    type === 'eagle' || type === 'double' || type === 'albatross' || type === 'triple';

  const ICON_SIZE = 20;
  const ICON_BORDER = 1.5;
  const SQUARE_RADIUS = 0;

  const getIconStyle = (type) => {
    if (type === 'none' || type === 'par') return null;

    const base = {
      position: 'absolute',
      inset: 0,
      border: `${ICON_BORDER}px solid #000`,
      borderRadius: '50%',
      boxSizing: 'border-box',
    };

    if (type === 'birdie') {
      return { ...base, borderRadius: '50%' };
    }

    if (type === 'eagle') {
      return { ...base, borderRadius: '50%', backgroundColor: '#000' };
    }

    if (type === 'albatross') {
      return {
        ...base,
        borderRadius: '50%',
        backgroundColor: '#000',
        boxShadow: `0 0 0 ${ICON_BORDER}px #fff, 0 0 0 ${ICON_BORDER * 2}px #000`,
      };
    }

    if (type === 'bogey') {
      return { ...base, borderRadius: `${SQUARE_RADIUS}px` };
    }

    if (type === 'double') {
      return { ...base, borderRadius: `${SQUARE_RADIUS}px`, backgroundColor: '#000' };
    }

    if (type === 'triple') {
      return {
        ...base,
        borderRadius: `${SQUARE_RADIUS}px`,
        backgroundColor: '#000',
        boxShadow: `0 0 0 ${ICON_BORDER}px #fff, 0 0 0 ${ICON_BORDER * 2}px #000`,
      };
    }

    return null;
  };

  const sortedCourses = [...courses].sort((a, b) => {
    const aId = a.tripRoundID ?? '';
    const bId = b.tripRoundID ?? '';
    if (aId === bId) {
      return (a.name || '').localeCompare(b.name || '');
    }
    if (aId === '') return 1;
    if (bId === '') return -1;
    const aNum = Number(aId);
    const bNum = Number(bId);
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
      return aNum - bNum;
    }
    return String(aId).localeCompare(String(bId));
  });

  return (
    <div className="scorecard-container">
      <h1>{selectedTrip?.name || 'No Trip Selected'}</h1>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="course-select">Select Course:</label>
        <select
          className="select-dropdown"
          name="selectedCourse"
          id="course-select"
          value={selectedCourse}
          onChange={e => {
            setSelectedCourse(e.target.value);
            setSelectedGroup('');
          }}
          disabled={loading || courses.length === 0}
        >
          <option value="" disabled>Select a Course</option>
          {sortedCourses.map(course => (
            <option key={course.id} value={course.id}>
              {course.tripRoundID ? `R${course.tripRoundID}: ` : ''}{course.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="group-select">Select Group:</label>
        <select
          className="select-dropdown"
          name="selectedGroup"
          id="group-select"
          value={selectedGroup}
          onChange={e => setSelectedGroup(e.target.value)}
          disabled={!selectedCourse || loadingGroups || groups.length === 0}
        >
          <option value="" disabled>Select a Group</option>
          {groups.map(group => (
            <option key={group.groupId} value={group.groupId}>
              {group.playerNames && group.playerNames.length > 0
                ? group.playerNames.join(', ')
                : group.groupId}
            </option>
          ))}
        </select>
      </div>

      {/* Scorecard content: only show if both selected */}
      {selectedCourse && selectedGroup ? (
        loadingScorecard ? (
          <p>Loading scorecard...</p>
        ) : scorecardData && scorecardData.length > 0 ? (
          <div className="leaderboard-tournament-table-wrapper">
            <h3 className="leaderboard-tournament-title">Scorecard</h3>
            <div className="leaderboard-tournament-table-scroll">
              {(() => {
                // Get roundType from first score record
                const roundType = scorecardData[0]?.roundType || 'full';
                
                // Determine which holes to display
                let holesToDisplay;
                let startHole;
                let endHole;
                
                switch (roundType) {
                  case 'front9':
                    startHole = 0;
                    endHole = 8;
                    holesToDisplay = Array.from({ length: 9 }, (_, i) => i);
                    break;
                  case 'back9':
                    startHole = 9;
                    endHole = 17;
                    holesToDisplay = Array.from({ length: 9 }, (_, i) => i + 9);
                    break;
                  case 'full':
                  default:
                    startHole = 0;
                    endHole = 17;
                    holesToDisplay = Array.from({ length: 18 }, (_, i) => i);
                    break;
                }
                
                return (
              <table className="leaderboard-table leaderboard-table-tournament">
                <thead>
                  <tr className="leaderboard-header-row" style={{ borderBottom: 'none', borderBottomWidth: 0, fontSize: '12px', height: '24px' }}>
                    {/* Removed position column */}
                    <th className="leaderboard-th leaderboard-th-name leaderboard-th-tournament-name" style={{paddingLeft: '18px'}}>Hole</th>
                    {holesToDisplay.map((holeIndex, displayIdx) => (
                      <React.Fragment key={holeIndex}>
                        <th className="leaderboard-th leaderboard-th-tournament-round">{holeIndex + 1}</th>
                        {roundType === 'full' && holeIndex === 8 && (
                          <th className="leaderboard-th leaderboard-th-tournament-total" style={{ borderRadius: 0 }}>Out</th>
                        )}
                        {roundType === 'full' && holeIndex === 17 && (
                          <th className="leaderboard-th leaderboard-th-tournament-total" style={{ borderRadius: 0 }}>In</th>
                        )}
                      </React.Fragment>
                    ))}
                    <th className="leaderboard-th leaderboard-th-tournament-total">Total</th>
                  </tr>
                  <tr className="leaderboard-header-row" style={{ borderTop: 'none', fontSize: '12px', height: '24px' }}>
                    <th className="leaderboard-th leaderboard-th-name leaderboard-th-tournament-name" style={{paddingLeft: '18px'}}>Par</th>
                    {holesToDisplay.map((holeIndex, displayIdx) => {
                      const par = getHolePar(selectedCourseData, holeIndex);
                      const frontTotal = roundType === 'full'
                        ? holesToDisplay
                          .slice(0, 9)
                          .reduce((sum, i) => sum + (getHolePar(selectedCourseData, i) || 0), 0)
                        : null;
                      const backTotal = roundType === 'full'
                        ? holesToDisplay
                          .slice(9, 18)
                          .reduce((sum, i) => sum + (getHolePar(selectedCourseData, i) || 0), 0)
                        : null;

                      return (
                        <React.Fragment key={holeIndex}>
                          <th className="leaderboard-th leaderboard-th-tournament-round">{par ?? ''}</th>
                          {roundType === 'full' && holeIndex === 8 && (
                            <th className="leaderboard-th leaderboard-th-tournament-total" style={{ borderRadius: 0 }}>{frontTotal}</th>
                          )}
                          {roundType === 'full' && holeIndex === 17 && (
                            <th className="leaderboard-th leaderboard-th-tournament-total" style={{ borderRadius: 0 }}>{backTotal}</th>
                          )}
                        </React.Fragment>
                      );
                    })}
                    <th className="leaderboard-th leaderboard-th-tournament-total" style={{ borderRadius: 0 }}>{
                      holesToDisplay.reduce((sum, i) => sum + (getHolePar(selectedCourseData, i) || 0), 0)
                    }</th>
                  </tr>
                </thead>
                <tbody>
                  {scorecardData.map((round, idx) => {
                    // Calculate totals based on displayed holes
                    const outTotal = roundType === 'full' && Array.isArray(round.scores)
                      ? round.scores.slice(0, 9).reduce((a, b) => a + b, 0)
                      : null;
                    const inTotal = roundType === 'full' && Array.isArray(round.scores)
                      ? round.scores.slice(9, 18).reduce((a, b) => a + b, 0)
                      : null;
                    const displayTotal = Array.isArray(round.scores)
                      ? holesToDisplay.reduce((sum, i) => sum + (round.scores[i] || 0), 0)
                      : '';
                    
                    return (
                    <tr key={idx} className={idx % 2 === 0 ? 'leaderboard-row-even' : 'leaderboard-row-odd'}>
                      {/* Removed position cell */}
                      <td className="leaderboard-td leaderboard-td-name leaderboard-td-tournament-name" style={{paddingLeft: '18px'}}>{round.playerName || round.playerId}</td>
                      {holesToDisplay.map((holeIndex, displayIdx) => {
                        const score = round.scores?.[holeIndex] || 0;
                        const par = getHolePar(selectedCourseData, holeIndex);
                        const iconType = getIconType(score, par);
                        const iconLabel = getIconLabel(iconType);
                        const solid = isSolidIcon(iconType);
                        const iconStyle = getIconStyle(iconType);

                        return (
                          <React.Fragment key={holeIndex}>
                            <td className="leaderboard-td leaderboard-td-tournament-round">
                              {score === 0 ? '' : (
                                <span
                                  style={{
                                    position: 'relative',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: `${ICON_SIZE}px`,
                                    height: `${ICON_SIZE}px`,
                                    lineHeight: `${ICON_SIZE}px`,
                                    fontWeight: 600,
                                    fontSize: '14px',
                                    color: solid ? '#fff' : 'inherit',
                                  }}
                                  aria-label={iconLabel ? `${iconLabel}: ${score}` : `Score: ${score}`}
                                >
                                  <span style={{ position: 'relative', zIndex: 1 }}>{score}</span>
                                  {iconStyle && (
                                    <span aria-hidden="true" style={iconStyle} />
                                  )}
                                </span>
                              )}
                            </td>
                            {roundType === 'full' && holeIndex === 8 && (
                              <td className="leaderboard-td leaderboard-td-tournament-total">{outTotal}</td>
                            )}
                            {roundType === 'full' && holeIndex === 17 && (
                              <td className="leaderboard-td leaderboard-td-tournament-total">{inTotal}</td>
                            )}
                          </React.Fragment>
                        );
                      })}
                      <td className="leaderboard-td leaderboard-td-tournament-total">{displayTotal}</td>
                    </tr>
                  )})}
                </tbody>
              </table>
                );
              })()}
            </div>
          </div>
        ) : (
          <p>No scorecard data found for this group and course.</p>
        )
      ) : (
        <p>Select a course and group to view the scorecard.</p>
      )}
    </div>
  );
};

export default Scorecard;
