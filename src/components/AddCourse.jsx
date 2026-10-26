import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { isValidHoleHandicaps } from '../utils/scoring/handicap';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

function AddCourse({ onBack }) {
  const [state, setState] = useState('');
  const [courseName, setCourseName] = useState('');
  const [pars, setPars] = useState(Array(18).fill(4));
  const [holeHandicaps, setHoleHandicaps] = useState(
    Array.from({ length: 18 }, (_, index) => index + 1)
  );
  const [saving, setSaving] = useState(false);

  const handleParChange = (holeIndex, value) => {
    const parValue = parseInt(value);
    if (parValue >= 3 && parValue <= 5) {
      const newPars = [...pars];
      newPars[holeIndex] = parValue;
      setPars(newPars);
    }
  };

  const handleHoleHandicapChange = (holeIndex, value) => {
    const handicapValue = parseInt(value, 10);
    const newHoleHandicaps = [...holeHandicaps];
    newHoleHandicaps[holeIndex] = handicapValue;
    setHoleHandicaps(newHoleHandicaps);
  };

  const handleSaveCourse = async () => {
    if (!state) {
      alert('Please select a state');
      return;
    }
    if (!courseName.trim()) {
      alert('Please enter a course name');
      return;
    }
    if (!isValidHoleHandicaps(holeHandicaps)) {
      alert('Please assign each hole a unique handicap ranking from 1 through 18');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'courses'), {
        state: state,
        name: courseName.trim(),
        pars: pars,
        holeHandicaps: holeHandicaps,
        isActive: true,
        createdAt: Timestamp.now()
      });
      alert('Course added successfully!');
      // Reset form
      setState('');
      setCourseName('');
      setPars(Array(18).fill(4));
      setHoleHandicaps(Array.from({ length: 18 }, (_, index) => index + 1));
      if (onBack) onBack();
    } catch (error) {
      console.error('Error adding course:', error);
      alert('Failed to add course. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const totalPar = pars.reduce((sum, par) => sum + par, 0);

  return (
    <div className="add-course-container">
      <div className="add-course-header">
        <h2>Add New Course</h2>
      </div>

      <div className="add-course-form">
        <div className="form-group">
          <label htmlFor="state-select">State</label>
          <select
            id="state-select"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="state-select"
          >
            <option value="">Select State</option>
            {US_STATES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="course-name">Course Name</label>
          <input
            id="course-name"
            type="text"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            placeholder="Enter course name"
            className="course-name-input"
          />
        </div>

        <div className="form-group">
          <p className="course-help-text">Handicap rankings determine the order in which strokes are received. Use each number from 1 through 18 exactly once.</p>
          <div className="pars-grid">
            {pars.map((par, index) => (
              <div key={index} className="par-item">
                <label htmlFor={`hole-${index + 1}`}>Hole {index + 1}</label>
                <select
                  id={`hole-${index + 1}`}
                  value={par}
                  onChange={(e) => handleParChange(index, e.target.value)}
                  className="par-select"
                >
                  <option value="3">Par 3</option>
                  <option value="4">Par 4</option>
                  <option value="5">Par 5</option>
                </select>
                <label htmlFor={`hole-handicap-${index + 1}`}>HCP</label>
                <select
                  id={`hole-handicap-${index + 1}`}
                  value={holeHandicaps[index]}
                  onChange={(e) => handleHoleHandicapChange(index, e.target.value)}
                  className="par-select"
                >
                  {Array.from({ length: 18 }, (_, handicapIndex) => (
                    <option key={handicapIndex + 1} value={handicapIndex + 1}>{handicapIndex + 1}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="pars-total">Total: {totalPar}</div>
        </div>

        <div className="form-actions">
          <button
            className="save-course-btn"
            onClick={handleSaveCourse}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Course'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .add-course-container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .add-course-header {
          margin-bottom: 30px;
        }

        .add-course-header h2 {
          margin: 0;
          font-size: 24px;
        }

        .add-course-form {
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .form-group {
          margin-bottom: 25px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #333;
        }

        .state-select,
        .course-name-input {
          width: 100%;
          max-width: 400px;
          padding: 10px;
          font-size: 16px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .course-name-input {
          max-width: 600px;
        }

        .pars-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 15px;
        }

        .course-help-text {
          margin: 0 0 12px;
          color: #666;
          font-size: 14px;
        }

        .par-item {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 15px;
        }

        .par-item label {
          font-size: 14px;
          font-weight: 500;
          color: #666;
          min-width: 60px;
        }

        .par-item label:nth-of-type(2) {
          min-width: auto;
        }

        .par-select {
          padding: 8px;
          font-size: 14px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
        }

        .pars-total {
          margin-top: 15px;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .form-actions {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }

        .save-course-btn {
          padding: 12px 30px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .save-course-btn:hover:not(:disabled) {
          background: #218838;
        }

        .save-course-btn:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .add-course-form {
            padding: 20px;
          }
        }
      `}</style>
    </div>
  );
}

export default AddCourse;
