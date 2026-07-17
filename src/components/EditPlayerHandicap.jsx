import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore';

function EditPlayerHandicap({ tripId, onBack, onSave }) {
  const [players, setPlayers] = useState([]);
  const [editedHandicaps, setEditedHandicaps] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Generate handicap options from -10 to 54
  const handicapOptions = useMemo(() => {
    const options = [];
    for (let i = -10; i <= 54; i++) {
      options.push(i);
    }
    return options;
  }, []);

  // Fetch players from current trip
  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      try {
        const playersRef = collection(db, `trips/${tripId}/players`);
        const snapshot = await getDocs(playersRef);
        const playersList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPlayers(playersList);
      } catch (error) {
        console.error('Error fetching players:', error);
        setError('Failed to load players. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (tripId) {
      fetchPlayers();
    }
  }, [tripId]);

  
  // Handle handicap change
  const handleHandicapChange = (playerId, value) => {
    const numValue = parseInt(value);
    setEditedHandicaps(prev => ({
      ...prev,
      [playerId]: numValue
    }));
    setHasChanges(true);
  };

  // Save all changes
  const saveAllChanges = async () => {
    setSaving(true);
    setError(null);

    try {
      const batch = writeBatch(db);

      // Add all updates to batch
      Object.entries(editedHandicaps).forEach(([playerId, handicap]) => {
        const playerRef = doc(db, `trips/${tripId}/players/${playerId}`);
        batch.update(playerRef, {
          handicap: handicap,
          handicapUpdated: serverTimestamp()
        });
      });

      // Commit all updates at once
      await batch.commit();

      // Success - navigate back
      setHasChanges(false);
      if (onSave) {
        onSave();
      } else if (onBack) {
        onBack();
      }
    } catch (error) {
      console.error('Error saving handicaps:', error);
      setError('Failed to save handicaps. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        onBack();
      }
    } else {
      onBack();
    }
  };

  if (loading) {
    return (
      <div className="edit-handicap-screen">
        <div className="loading">Loading players...</div>
      </div>
    );
  }

  return (
    <div className="edit-handicap-screen">
      {/* Header */}
      <div className="edit-handicap-header">
        <h2>Edit Player Handicaps</h2>
        <p className="subtitle">Changes will apply to future rounds</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Player List */}
      <div className="players-handicap-list">
        {players.length === 0 ? (
          <p className="no-players">No players found for this trip</p>
        ) : (
          players.map(player => {
            const currentValue = editedHandicaps[player.id] ?? player.handicap ?? 0;
            const isModified = editedHandicaps[player.id] !== undefined;

            return (
              <div 
                key={player.id} 
                className={`player-handicap-item ${isModified ? 'modified' : ''}`}
              >
                <div className="player-name">{player.name}</div>
                <select
                  value={currentValue}
                  onChange={(e) => handleHandicapChange(player.id, e.target.value)}
                  className="handicap-select"
                >
                  {handicapOptions.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="edit-handicap-footer">
        <button 
          onClick={handleCancel} 
          className="cancel-btn"
          disabled={saving}
        >
          Cancel
        </button>
        <button 
          onClick={saveAllChanges} 
          className="save-btn"
          disabled={!hasChanges || saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

export default EditPlayerHandicap;
