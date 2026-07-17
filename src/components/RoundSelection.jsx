import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, query, where, Timestamp } from 'firebase/firestore';

const US_STATES = [
  { name: 'Alabama', abbr: 'AL' },
  { name: 'Alaska', abbr: 'AK' },
  { name: 'Arizona', abbr: 'AZ' },
  { name: 'Arkansas', abbr: 'AR' },
  { name: 'California', abbr: 'CA' },
  { name: 'Colorado', abbr: 'CO' },
  { name: 'Connecticut', abbr: 'CT' },
  { name: 'Delaware', abbr: 'DE' },
  { name: 'Florida', abbr: 'FL' },
  { name: 'Georgia', abbr: 'GA' },
  { name: 'Hawaii', abbr: 'HI' },
  { name: 'Idaho', abbr: 'ID' },
  { name: 'Illinois', abbr: 'IL' },
  { name: 'Indiana', abbr: 'IN' },
  { name: 'Iowa', abbr: 'IA' },
  { name: 'Kansas', abbr: 'KS' },
  { name: 'Kentucky', abbr: 'KY' },
  { name: 'Louisiana', abbr: 'LA' },
  { name: 'Maine', abbr: 'ME' },
  { name: 'Maryland', abbr: 'MD' },
  { name: 'Massachusetts', abbr: 'MA' },
  { name: 'Michigan', abbr: 'MI' },
  { name: 'Minnesota', abbr: 'MN' },
  { name: 'Mississippi', abbr: 'MS' },
  { name: 'Missouri', abbr: 'MO' },
  { name: 'Montana', abbr: 'MT' },
  { name: 'Nebraska', abbr: 'NE' },
  { name: 'Nevada', abbr: 'NV' },
  { name: 'New Hampshire', abbr: 'NH' },
  { name: 'New Jersey', abbr: 'NJ' },
  { name: 'New Mexico', abbr: 'NM' },
  { name: 'New York', abbr: 'NY' },
  { name: 'North Carolina', abbr: 'NC' },
  { name: 'North Dakota', abbr: 'ND' },
  { name: 'Ohio', abbr: 'OH' },
  { name: 'Oklahoma', abbr: 'OK' },
  { name: 'Oregon', abbr: 'OR' },
  { name: 'Pennsylvania', abbr: 'PA' },
  { name: 'Rhode Island', abbr: 'RI' },
  { name: 'South Carolina', abbr: 'SC' },
  { name: 'South Dakota', abbr: 'SD' },
  { name: 'Tennessee', abbr: 'TN' },
  { name: 'Texas', abbr: 'TX' },
  { name: 'Utah', abbr: 'UT' },
  { name: 'Vermont', abbr: 'VT' },
  { name: 'Virginia', abbr: 'VA' },
  { name: 'Washington', abbr: 'WA' },
  { name: 'West Virginia', abbr: 'WV' },
  { name: 'Wisconsin', abbr: 'WI' },
  { name: 'Wyoming', abbr: 'WY' }
];

function RoundSelection({ tripId, tripData, onComplete, onBack }) {
  const [courses, setCourses] = useState([]);
  const [selectedRounds, setSelectedRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'courses'));
      const coursesData = querySnapshot.docs
        .map(doc => ({ courseId: doc.id, ...doc.data() }))
        .filter(course => course.isActive === true)
        .sort((a, b) => {
          const aTrip = Number(a.tripRoundID);
          const bTrip = Number(b.tripRoundID);
          if (Number.isNaN(aTrip) && Number.isNaN(bTrip)) return 0;
          if (Number.isNaN(aTrip)) return 1;
          if (Number.isNaN(bTrip)) return -1;
          return aTrip - bTrip;
        });
      setCourses(coursesData);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const addRound = () => {
    setSelectedRounds(prev => [...prev, {
      state: '',
      course: null,
      date: '',
      teeTime: '',
      notes: ''
    }]);
  };

  const removeRound = (index) => {
    setSelectedRounds(prev => prev.filter((_, i) => i !== index));
  };

  const selectState = (index, e) => {
    const stateAbbr = e.target.value;
    setSelectedRounds(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        state: stateAbbr,
        course: null // Reset course when state changes
      };
      return next;
    });
  };

  const selectCourse = (index, e) => {
    const courseId = e.target.value;
    const courseObj = courses.find(c => String(c.courseId) === String(courseId)) || null;
    setSelectedRounds(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        course: courseObj
      };
      return next;
    });
  };

  const updateRoundDetail = (index, field, value) => {
    setSelectedRounds(prev => 
      prev.map((round, i) => 
        i === index 
          ? { ...round, [field]: value }
          : round
      )
    );
  };

  const handleSaveRounds = async () => {
    if (selectedRounds.length === 0) {
      alert('Please add at least one round');
      return;
    }

    const hasEmptyCourses = selectedRounds.some(r => !r.course);
    if (hasEmptyCourses) {
      alert('Please select a course for all rounds');
      return;
    }

    setSaving(true);
    try {
      const promises = selectedRounds.map((round, index) => {
        return addDoc(collection(db, 'trips', tripId, 'rounds'), {
          courseId: round.course.courseId,
          courseName: round.course.name,
          tripRoundID: index + 1,
          date: round.date ? Timestamp.fromDate(new Date(round.date)) : null,
          teeTime: round.teeTime || '',
          notes: round.notes || '',
          order: index + 1,
          createdAt: Timestamp.now()
        });
      });

      await Promise.all(promises);
      onComplete();
    } catch (error) {
      console.error('Error saving rounds:', error);
      alert('Error saving rounds. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Get available courses for a specific slot filtered by state
  const getAvailableCourses = (currentIndex, stateAbbr) => {
    return courses.filter(course => {
      // Filter by state if one is selected
      const matchesState = !stateAbbr || course.state === stateAbbr;
      return matchesState;
    });
  };

  if (loading) {
    return <div className="round-selection">Loading courses...</div>;
  }

  return (
    <div className="round-selection">
      <button onClick={onBack} className="back-btn">← Back to Trip Info</button>
      
      <h2>Select Rounds for {tripData?.name}</h2>
      <p className="round-selection-subtitle">Add the golf courses that will be played during this trip</p>

      <div className="round-list">
        {selectedRounds.map((round, index) => (
          <div key={index} className="round-item">
            <div className="round-item-header">
              <h3>Round {index + 1}</h3>
              <button 
                className="btn-remove"
                onClick={() => removeRound(index)}
              >
                Remove
              </button>
            </div>

            <div className="form-group">
              <label>State</label>
              <select 
                value={round.state}
                onChange={(e) => selectState(index, e)}
              >
                <option value="">Select a state</option>
                {US_STATES.map(state => (
                  <option key={state.abbr} value={state.abbr}>
                    {state.abbr}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Course</label>
              <select 
                value={round.course ? round.course.courseId : ''}
                onChange={(e) => selectCourse(index, e)}
                disabled={!round.state}
              >
                <option value="">Select a course</option>
                {getAvailableCourses(index, round.state).map(course => (
                  <option key={course.courseId} value={course.courseId}>
                    {course.name} {course.tripRoundID ? `(Round ${course.tripRoundID})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={round.date}
                onChange={(e) => updateRoundDetail(index, 'date', e.target.value)}
                min={tripData?.startDate?.toDate().toISOString().split('T')[0]}
                max={tripData?.endDate?.toDate().toISOString().split('T')[0]}
              />
            </div>

            <div className="form-group">
              <label>Tee Time</label>
              <input
                type="time"
                value={round.teeTime}
                onChange={(e) => updateRoundDetail(index, 'teeTime', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g., Shotgun start, Scramble format"
                value={round.notes}
                onChange={(e) => updateRoundDetail(index, 'notes', e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="round-selection-actions">
        <button 
          className="btn-secondary"
          onClick={addRound}
          disabled={courses.length === 0}
        >
          Add Round
        </button>
        
        <div className="action-buttons">
          <button 
            onClick={handleSaveRounds} 
            className="save-rounds-btn"
            disabled={saving || selectedRounds.length === 0}
          >
            {saving ? 'Saving...' : 'Continue to Invite Players'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RoundSelection;
