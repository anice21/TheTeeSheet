import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

const Scorecard = () => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [groups, setGroups] = useState([]); // [{ groupId, playerNames: [] }]
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [scorecardData, setScorecardData] = useState(null);
  const [loadingScorecard, setLoadingScorecard] = useState(false);

  useEffect(() => {
    async function fetchCourses() {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'courses'));
        const courseList = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(course => course.isActive);
        setCourses(courseList);
      } catch (error) {
        console.error('Error fetching courses:', error);
      }
      setLoading(false);
    }
    fetchCourses();
  }, []);

  // Fetch groups when a course is selected
  useEffect(() => {
    async function fetchGroups() {
      if (!selectedCourse) {
        setGroups([]);
        setSelectedGroup('');
        return;
      }
      setLoadingGroups(true);
      try {
        // Fetch rounds for the selected course
        const querySnapshot = await getDocs(collection(db, 'rounds'));
        const groupMap = new Map();
        querySnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.courseId === selectedCourse && data.groupId && data.isActive) {
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
  }, [selectedCourse]);

  // Fetch scorecard data when both course and group are selected
  useEffect(() => {
    async function fetchScorecard() {
      if (!selectedCourse || !selectedGroup) {
        setScorecardData(null);
        return;
      }
      setLoadingScorecard(true);
      try {
        // Fetch all rounds for the selected group and course
        const querySnapshot = await getDocs(collection(db, 'rounds'));
        const rounds = querySnapshot.docs
          .map(doc => doc.data())
          .filter(r => r.courseId === selectedCourse && r.groupId === selectedGroup);
        setScorecardData(rounds);
      } catch (error) {
        console.error('Error fetching scorecard:', error);
        setScorecardData(null);
      }
      setLoadingScorecard(false);
    }
    fetchScorecard();
  }, [selectedCourse, selectedGroup]);

  const selectedCourseData =
    courses.find(c => c.id === selectedCourse || c.courseId === selectedCourse) || null;

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

  return (
    <div className="scorecard-container">
      <h1>Mesquite 2026</h1>
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
          {courses.map(course => (
            <option key={course.id} value={course.id}>
              {course.name || course.id}
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
              <table className="leaderboard-table leaderboard-table-tournament">
                <thead>
                  <tr className="leaderboard-header-row" style={{ borderBottom: 'none', borderBottomWidth: 0, fontSize: '12px', height: '24px' }}>
                    {/* Removed position column */}
                    <th className="leaderboard-th leaderboard-th-name leaderboard-th-tournament-name" style={{paddingLeft: '18px'}}>Hole</th>
                    {scorecardData[0].scores && scorecardData[0].scores.map((_, idx) => (
                      <React.Fragment key={idx}>
                        <th className="leaderboard-th leaderboard-th-tournament-round">{idx + 1}</th>
                        {idx === 8 && (
                          <th className="leaderboard-th leaderboard-th-tournament-total" style={{ borderRadius: 0 }}>Out</th>
                        )}
                        {idx === 17 && (
                          <th className="leaderboard-th leaderboard-th-tournament-total" style={{ borderRadius: 0 }}>In</th>
                        )}
                      </React.Fragment>
                    ))}
                    <th className="leaderboard-th leaderboard-th-tournament-total">Total</th>
                  </tr>
                  <tr className="leaderboard-header-row" style={{ borderTop: 'none', fontSize: '12px', height: '24px' }}>
                    <th className="leaderboard-th leaderboard-th-name leaderboard-th-tournament-name" style={{paddingLeft: '18px'}}>Par</th>
                    {scorecardData[0].scores && scorecardData[0].scores.map((_, idx) => {
                      const par = getHolePar(selectedCourseData, idx);
                      const frontTotal = scorecardData[0].scores
                        ? scorecardData[0].scores
                          .slice(0, 9)
                          .reduce((sum, __, i) => sum + (getHolePar(selectedCourseData, i) || 0), 0)
                        : '';
                      const backTotal = scorecardData[0].scores
                        ? scorecardData[0].scores
                          .slice(9, 18)
                          .reduce((sum, __, i) => sum + (getHolePar(selectedCourseData, i + 9) || 0), 0)
                        : '';
                      const totalPar = scorecardData[0].scores
                        ? scorecardData[0].scores
                          .slice(0, 18)
                          .reduce((sum, __, i) => sum + (getHolePar(selectedCourseData, i) || 0), 0)
                        : '';

                      return (
                        <React.Fragment key={idx}>
                          <th className="leaderboard-th leaderboard-th-tournament-round">{par ?? ''}</th>
                          {idx === 8 && (
                            <th className="leaderboard-th leaderboard-th-tournament-total" style={{ borderRadius: 0 }}>{frontTotal}</th>
                          )}
                          {idx === 17 && (
                            <th className="leaderboard-th leaderboard-th-tournament-total" style={{ borderRadius: 0 }}>{backTotal}</th>
                          )}
                        </React.Fragment>
                      );
                    })}
                    <th className="leaderboard-th leaderboard-th-tournament-total" style={{ borderRadius: 0 }}>{
                      scorecardData[0].scores
                        ? scorecardData[0].scores
                          .slice(0, 18)
                          .reduce((sum, __, i) => sum + (getHolePar(selectedCourseData, i) || 0), 0)
                        : ''
                    }</th>
                  </tr>
                </thead>
                <tbody>
                  {scorecardData.map((round, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'leaderboard-row-even' : 'leaderboard-row-odd'}>
                      {/* Removed position cell */}
                      <td className="leaderboard-td leaderboard-td-name leaderboard-td-tournament-name" style={{paddingLeft: '18px'}}>{round.playerName || round.playerId}</td>
                      {round.scores && round.scores.map((score, i) => {
                        const par = getHolePar(selectedCourseData, i);
                        const iconType = getIconType(score, par);
                        const iconLabel = getIconLabel(iconType);
                        const solid = isSolidIcon(iconType);
                        const iconStyle = getIconStyle(iconType);
                        const outTotal = Array.isArray(round.scores)
                          ? round.scores.slice(0, 9).reduce((a, b) => a + b, 0)
                          : '';
                        const inTotal = Array.isArray(round.scores)
                          ? round.scores.slice(9, 18).reduce((a, b) => a + b, 0)
                          : '';

                        return (
                          <React.Fragment key={i}>
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
                            {i === 8 && (
                              <td className="leaderboard-td leaderboard-td-tournament-total">{outTotal}</td>
                            )}
                            {i === 17 && (
                              <td className="leaderboard-td leaderboard-td-tournament-total">{inTotal}</td>
                            )}
                          </React.Fragment>
                        );
                      })}
                      <td className="leaderboard-td leaderboard-td-tournament-total">{Array.isArray(round.scores) ? round.scores.reduce((a, b) => a + b, 0) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
