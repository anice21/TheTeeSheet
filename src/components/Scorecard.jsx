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
                  <tr className="leaderboard-header-row">
                    {/* Removed position column */}
                    <th className="leaderboard-th leaderboard-th-name leaderboard-th-tournament-name" style={{paddingLeft: '18px'}}>Player</th>
                    {scorecardData[0].scores && scorecardData[0].scores.map((_, idx) => (
                      <th className="leaderboard-th leaderboard-th-tournament-round" key={idx}>{idx + 1}</th>
                    ))}
                    <th className="leaderboard-th leaderboard-th-tournament-total">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {scorecardData.map((round, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'leaderboard-row-even' : 'leaderboard-row-odd'}>
                      {/* Removed position cell */}
                      <td className="leaderboard-td leaderboard-td-name leaderboard-td-tournament-name" style={{paddingLeft: '18px'}}>{round.playerName || round.playerId}</td>
                      {round.scores && round.scores.map((score, i) => (
                        <td className="leaderboard-td leaderboard-td-tournament-round" key={i}>{score === 0 ? '' : score}</td>
                      ))}
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
