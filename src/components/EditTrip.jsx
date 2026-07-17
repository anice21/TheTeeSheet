import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';

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

function EditTrip({ selectedTrip, currentUser, onBack }) {
  const [rounds, setRounds] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // State for editing existing rounds
  const [editingRoundId, setEditingRoundId] = useState(null);
  const [editState, setEditState] = useState('');
  const [editCourseId, setEditCourseId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTeeTime, setEditTeeTime] = useState('');
  const [editNotes, setEditNotes] = useState('');
  
  // State for adding new rounds
  const [newRounds, setNewRounds] = useState([]);

  // Fetch rounds and courses
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedTrip?.id) return;
      
      setLoading(true);
      try {
        // Fetch rounds for this trip
        const roundsSnapshot = await getDocs(collection(db, 'trips', selectedTrip.id, 'rounds'));
        const roundsData = await Promise.all(roundsSnapshot.docs.map(async (roundDoc) => {
          const roundData = roundDoc.data();
          
          // Check if any scores exist for this round
          const scoresQuery = query(
            collection(db, 'trips', selectedTrip.id, 'scores'),
            where('tripRoundID', '==', roundData.tripRoundID),
            where('courseId', '==', roundData.courseId)
          );
          const scoresSnapshot = await getDocs(scoresQuery);
          
          const hasScores = !scoresSnapshot.empty;
          const isFinished = scoresSnapshot.docs.some(doc => doc.data().isRoundFinished === true);
          const hasStarted = scoresSnapshot.docs.some(doc => {
            const scores = doc.data().scores || [];
            return scores.some(score => score > 0);
          });
          
          return {
            id: roundDoc.id,
            ...roundData,
            hasScores,
            isFinished,
            hasStarted,
            scoreCount: scoresSnapshot.size
          };
        }));
        
        // Sort by tripRoundID
        roundsData.sort((a, b) => (a.tripRoundID || 0) - (b.tripRoundID || 0));
        setRounds(roundsData);
        
        // Fetch all available courses
        const coursesSnapshot = await getDocs(collection(db, 'courses'));
        const coursesData = coursesSnapshot.docs
          .map(doc => ({
            id: doc.id,
            courseId: doc.id,
            ...doc.data()
          }))
          .filter(course => course.isActive === true);
        setCourses(coursesData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load trip data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [selectedTrip]);

  // Add a new round slot
  const addRound = () => {
    setNewRounds(prev => [...prev, {
      state: '',
      course: null,
      date: '',
      teeTime: '',
      notes: ''
    }]);
  };

  // Remove a new round slot
  const removeNewRound = (index) => {
    setNewRounds(prev => prev.filter((_, i) => i !== index));
  };

  // Select state for new round
  const selectState = (index, e) => {
    const stateAbbr = e.target.value;
    setNewRounds(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        state: stateAbbr,
        course: null // Reset course when state changes
      };
      return next;
    });
  };

  // Select course for new round
  const selectCourse = (index, e) => {
    const courseId = e.target.value;
    const courseObj = courses.find(c => String(c.courseId) === String(courseId)) || null;
    setNewRounds(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        course: courseObj
      };
      return next;
    });
  };

  // Update round detail for new round
  const updateRoundDetail = (index, field, value) => {
    setNewRounds(prev => 
      prev.map((round, i) => 
        i === index 
          ? { ...round, [field]: value }
          : round
      )
    );
  };

  // Get available courses filtered by state
  const getAvailableCourses = (stateAbbr) => {
    return courses.filter(course => {
      const matchesState = !stateAbbr || course.state?.toUpperCase() === stateAbbr?.toUpperCase();
      return matchesState;
    });
  };

  // Save new rounds
  const saveNewRounds = async () => {
    if (newRounds.length === 0) {
      setError('Please add at least one round');
      return;
    }

    const hasEmptyCourses = newRounds.some(r => !r.course);
    if (hasEmptyCourses) {
      setError('Please select a course for all rounds');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      // Get next available round numbers
      const maxRoundNumber = rounds.length > 0 
        ? Math.max(...rounds.map(r => r.tripRoundID || 0))
        : 0;
      
      // Add all new rounds
      const promises = newRounds.map((round, index) => {
        const roundData = {
          tripRoundID: maxRoundNumber + index + 1,
          courseId: round.course.courseId,
          courseName: round.course.name,
          order: maxRoundNumber + index + 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        // Add optional fields if provided
        if (round.date) {
          roundData.date = round.date;
        }
        if (round.teeTime) {
          roundData.teeTime = round.teeTime;
        }
        if (round.notes) {
          roundData.notes = round.notes;
        }
        
        return addDoc(collection(db, 'trips', selectedTrip.id, 'rounds'), roundData);
      });
      
      await Promise.all(promises);
      
      // Update local state
      const addedRounds = newRounds.map((round, index) => ({
        id: `temp-${index}`,
        tripRoundID: maxRoundNumber + index + 1,
        courseId: round.course.courseId,
        courseName: round.course.name,
        hasScores: false,
        isFinished: false,
        hasStarted: false,
        scoreCount: 0
      }));
      
      setRounds(prev => [...prev, ...addedRounds].sort((a, b) => (a.tripRoundID || 0) - (b.tripRoundID || 0)));
      setNewRounds([]);
      setSuccessMessage(`${newRounds.length} round${newRounds.length !== 1 ? 's' : ''} added successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error adding rounds:', err);
      setError('Failed to add rounds. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Start editing a round
  const startEditingRound = (round) => {
    const course = courses.find(c => c.courseId === round.courseId);
    setEditingRoundId(round.id);
    setEditState(course?.state || '');
    setEditCourseId(round.courseId);
    setEditDate(round.date || '');
    setEditTeeTime(round.teeTime || '');
    setEditNotes(round.notes || '');
    setError(null);
    setSuccessMessage(null);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingRoundId(null);
    setEditState('');
    setEditCourseId('');
    setEditDate('');
    setEditTeeTime('');
    setEditNotes('');
    setError(null);
  };

  // Save edited round
  const saveEditedRound = async (round) => {
    if (!editCourseId) {
      setError('Please select a course');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const newCourse = courses.find(c => c.courseId === editCourseId);
      
      const updateData = {
        courseId: editCourseId,
        courseName: newCourse.name,
        updatedAt: serverTimestamp()
      };
      
      // Add optional fields
      if (editDate) {
        updateData.date = editDate;
      }
      if (editTeeTime) {
        updateData.teeTime = editTeeTime;
      }
      if (editNotes) {
        updateData.notes = editNotes;
      }
      
      // Update the round document
      await updateDoc(doc(db, 'trips', selectedTrip.id, 'rounds', round.id), updateData);

      // Update local state
      setRounds(prev => prev.map(r => 
        r.id === round.id 
          ? { ...r, courseId: editCourseId, courseName: newCourse.name, date: editDate, teeTime: editTeeTime, notes: editNotes }
          : r
      ));

      setEditingRoundId(null);
      setEditState('');
      setEditCourseId('');
      setEditDate('');
      setEditTeeTime('');
      setEditNotes('');
      setSuccessMessage('Round updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error updating round:', err);
      setError('Failed to update round. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Delete a round
  const deleteRound = async (round) => {
    const confirmMessage = round.hasScores
      ? `This round has ${round.scoreCount} score(s) recorded. Are you sure you want to delete this round and all associated scores?`
      : `Are you sure you want to delete Round ${round.tripRoundID}?`;
    
    if (!window.confirm(confirmMessage)) return;
    
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const batch = writeBatch(db);
      
      // Delete the round document
      batch.delete(doc(db, 'trips', selectedTrip.id, 'rounds', round.id));
      
      // Delete associated scores
      if (round.hasScores) {
        const scoresQuery = query(
          collection(db, 'trips', selectedTrip.id, 'scores'),
          where('tripRoundID', '==', round.tripRoundID),
          where('courseId', '==', round.courseId)
        );
        const scoresSnapshot = await getDocs(scoresQuery);
        scoresSnapshot.docs.forEach(scoreDoc => {
          batch.delete(scoreDoc.ref);
        });
      }
      
      await batch.commit();
      
      // Update local state
      setRounds(prev => prev.filter(r => r.id !== round.id));
      
      setSuccessMessage('Round deleted successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error deleting round:', err);
      setError('Failed to delete round. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Show add round form
  const startAddingRound = () => {
    setSelectedCourses([]);
    setShowAddForm(true);
    setError(null);
    setSuccessMessage(null);
  };

  // Cancel adding round
  const cancelAddingRound = () => {
    setShowAddForm(false);
    setSelectedCourses([]);
    setError(null);
  };

  // Toggle course selection
  const toggleCourseSelection = (courseId) => {
    setSelectedCourses(prev => 
      prev.includes(courseId) 
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  // Add new rounds
  const addNewRounds = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      if (selectedCourses.length === 0) {
        setError('Please select at least one course');
        setSaving(false);
        return;
      }
      
      // Get next available round numbers
      const maxRoundNumber = rounds.length > 0 
        ? Math.max(...rounds.map(r => r.tripRoundID || 0))
        : 0;
      
      // Add all selected courses
      const promises = selectedCourses.map((courseId, index) => {
        const course = availableCourses.find(c => c.id === courseId);
        return addDoc(collection(db, 'trips', selectedTrip.id, 'rounds'), {
          tripRoundID: maxRoundNumber + index + 1,
          courseId: courseId,
          courseName: course.name,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      
      await Promise.all(promises);
      
      // Update local state
      const newRounds = selectedCourses.map((courseId, index) => {
        const course = availableCourses.find(c => c.id === courseId);
        return {
          id: `temp-${index}`, // This will be replaced on refresh
          tripRoundID: maxRoundNumber + index + 1,
          courseId: courseId,
          courseName: course.name,
          hasScores: false,
          isFinished: false,
          hasStarted: false,
          scoreCount: 0
        };
      });
      
      setRounds(prev => [...prev, ...newRounds].sort((a, b) => (a.tripRoundID || 0) - (b.tripRoundID || 0)));
      
      // Update available courses
      setAvailableCourses(prev => prev.filter(c => !selectedCourses.includes(c.id)));
      
      setShowAddForm(false);
      setSelectedCourses([]);
      setSuccessMessage(`${selectedCourses.length} round${selectedCourses.length !== 1 ? 's' : ''} added successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error adding rounds:', err);
      setError('Failed to add rounds. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Get round status
  const getRoundStatus = (round) => {
    if (round.isFinished) return { text: 'Finished', color: '#ef4444' };
    if (round.hasStarted) return { text: 'In Progress', color: '#f59e0b' };
    return { text: 'Not Started', color: '#10b981' };
  };

  // Check if user is organizer
  if (currentUser?.uid !== selectedTrip?.organizerId) {
    return (
      <div className="round-selection">
        <button onClick={onBack} className="back-btn">← Back</button>
        <h2>Edit Trip</h2>
        <p style={{ color: '#ef4444', marginTop: 16 }}>
          Only the trip organizer can edit trip rounds.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="round-selection">
        Loading...
      </div>
    );
  }

  return (
    <div className="round-selection">
      <h2>Edit Rounds for {selectedTrip?.name}</h2>
      <p className="round-selection-subtitle">Manage the golf courses for this trip</p>

      {/* Success Message */}
      {successMessage && (
        <div style={{ 
          padding: '12px', 
          backgroundColor: '#d1fae5', 
          color: '#065f46',
          borderRadius: '4px',
          marginTop: 16,
          marginBottom: 16
        }}>
          {successMessage}
        </div>
      )}

      
      {/* Error Message */}
      {error && (
        <div style={{ 
          padding: '12px', 
          backgroundColor: '#fee2e2', 
          color: '#991b1b',
          borderRadius: '4px',
          marginTop: 16,
          marginBottom: 16
        }}>
          {error}
        </div>
      )}

      {/* Existing Rounds */}
      <div className="round-list">
        {rounds.map(round => {
          const status = getRoundStatus(round);
          const canEdit = !round.isFinished;
          const isEditing = editingRoundId === round.id;
          
          return (
            <div key={round.id} className="round-item">
              <div className="round-item-header">
                <h3>Round {round.tripRoundID}</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {isEditing ? (
                    <>
                      <button 
                        className="btn-save"
                        onClick={() => saveEditedRound(round)}
                        disabled={saving}
                      >
                        Save
                      </button>
                      <button 
                        className="btn-edit"
                        onClick={cancelEditing}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {canEdit && (
                        <>
                          <button 
                            className="btn-edit"
                            onClick={() => startEditingRound(round)}
                            disabled={saving}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn-remove"
                            onClick={() => deleteRound(round)}
                            disabled={saving}
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              <span 
                style={{ 
                  padding: '4px 8px', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  backgroundColor: status.color + '20',
                  color: status.color,
                  display: 'inline-block',
                  marginTop: '4px',
                  marginBottom: '12px'
                }}
              >
                {status.text}
              </span>

              {isEditing ? (
                <>
                  <div className="form-group">
                    <label>State</label>
                    <select 
                      value={editState}
                      onChange={(e) => {
                        setEditState(e.target.value);
                        setEditCourseId(''); // Reset course when state changes
                      }}
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
                      value={editCourseId}
                      onChange={(e) => setEditCourseId(e.target.value)}
                      disabled={!editState}
                    >
                      <option value="">Select a course</option>
                      {courses
                        .filter(c => !editState || c.state?.toUpperCase() === editState?.toUpperCase())
                        .map(course => (
                          <option key={course.courseId} value={course.courseId}>
                            {course.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Date</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      min={selectedTrip?.startDate?.toDate().toISOString().split('T')[0]}
                      max={selectedTrip?.endDate?.toDate().toISOString().split('T')[0]}
                    />
                  </div>

                  <div className="form-group">
                    <label>Tee Time</label>
                    <input
                      type="time"
                      value={editTeeTime}
                      onChange={(e) => setEditTeeTime(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Notes (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g., Shotgun start, Scramble format"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>Course</label>
                    <div style={{ fontSize: '16px', padding: '8px 0' }}>
                      {round.courseName}
                    </div>
                  </div>
                  
                  {round.date && (
                    <div className="form-group">
                      <label>Date</label>
                      <div style={{ fontSize: '16px', padding: '8px 0' }}>
                        {new Date(round.date).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                  
                  {round.teeTime && (
                    <div className="form-group">
                      <label>Tee Time</label>
                      <div style={{ fontSize: '16px', padding: '8px 0' }}>
                        {round.teeTime}
                      </div>
                    </div>
                  )}
                  
                  {round.notes && (
                    <div className="form-group">
                      <label>Notes</label>
                      <div style={{ fontSize: '16px', padding: '8px 0' }}>
                        {round.notes}
                      </div>
                    </div>
                  )}
                </>
              )}

              {round.hasScores && (
                <div style={{ fontSize: '14px', color: '#6b7280', marginTop: 8 }}>
                  {round.scoreCount} score{round.scoreCount !== 1 ? 's' : ''} recorded
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New Rounds */}
      {newRounds.map((round, index) => (
        <div key={`new-${index}`} className="round-item">
          <div className="round-item-header">
            <h3>New Round {rounds.length + index + 1}</h3>
            <button 
              className="btn-remove"
              onClick={() => removeNewRound(index)}
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
              {getAvailableCourses(round.state).map(course => (
                <option key={course.courseId} value={course.courseId}>
                  {course.name}
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
              min={selectedTrip?.startDate?.toDate().toISOString().split('T')[0]}
              max={selectedTrip?.endDate?.toDate().toISOString().split('T')[0]}
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

      <div className="round-selection-actions">
        <button 
          className="btn-secondary"
          onClick={addRound}
          disabled={courses.length === 0}
        >
          Add Round
        </button>
        
        {newRounds.length > 0 && (
          <div className="action-buttons">
            <button 
              onClick={saveNewRounds} 
              className="save-rounds-btn"
              disabled={saving}
            >
              {saving ? 'Saving...' : `Save ${newRounds.length} New Round${newRounds.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default EditTrip;
