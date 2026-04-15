import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, addDoc, deleteDoc, Timestamp } from 'firebase/firestore';

function TripDetails({ tripId, onBack, onGoToLeaderboard }) {
  const [trip, setTrip] = useState(null);
  const [invitedPlayers, setInvitedPlayers] = useState([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTripData();
  }, [tripId]);

  const fetchTripData = async () => {
    setLoading(true);
    try {
      // Fetch trip details
      const tripDoc = await getDoc(doc(db, 'trips', tripId));
      if (tripDoc.exists()) {
        setTrip({ id: tripDoc.id, ...tripDoc.data() });
      }

      // Fetch invited players
      const playersSnapshot = await getDocs(collection(db, 'trips', tripId, 'players'));
      const playersList = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInvitedPlayers(playersList);

      // Fetch all available players
      const allPlayersSnapshot = await getDocs(collection(db, 'players'));
      const allPlayers = allPlayersSnapshot.docs
        .map(doc => ({ playerId: doc.id, ...doc.data() }))
        .filter(player => player.isActive === true);
      
      // Filter out already invited players
      const invitedPlayerIds = playersList.map(p => p.playerId);
      const available = allPlayers.filter(p => !invitedPlayerIds.includes(p.playerId));
      setAvailablePlayers(available);
    } catch (error) {
      console.error('Error fetching trip data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvitePlayers = async () => {
    try {
      const promises = selectedPlayers.map(playerId => {
        const player = availablePlayers.find(p => p.playerId === playerId);
        return addDoc(collection(db, 'trips', tripId, 'players'), {
          playerId: player.playerId,
          name: player.name,
          email: player.email || '',
          handicap: player.handicap || 0,
          invitationStatus: 'accepted', // Simple approach - auto-accepted
          invitedAt: Timestamp.now()
        });
      });

      await Promise.all(promises);
      setSelectedPlayers([]);
      setShowInviteForm(false);
      fetchTripData(); // Refresh the list
    } catch (error) {
      console.error('Error inviting players:', error);
    }
  };

  const handleRemovePlayer = async (playerId) => {
    if (window.confirm('Are you sure you want to remove this player from the trip?')) {
      try {
        await deleteDoc(doc(db, 'trips', tripId, 'players', playerId));
        fetchTripData(); // Refresh the list
      } catch (error) {
        console.error('Error removing player:', error);
      }
    }
  };

  const togglePlayerSelection = (playerId) => {
    setSelectedPlayers(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  if (loading) {
    return <div className="trip-details">Loading...</div>;
  }

  if (!trip) {
    return <div className="trip-details">Trip not found</div>;
  }

  return (
    <div className="trip-details">
      <button onClick={onBack} className="back-btn">← Back to Create Trip</button>
      
      <div className="trip-info">
        <h2>{trip.name}</h2>
        <div className="trip-info-row">
          <strong>Location:</strong> {trip.location}
        </div>
        <div className="trip-info-row">
          <strong>Dates:</strong> {trip.startDate?.toDate().toLocaleDateString()} - {trip.endDate?.toDate().toLocaleDateString()}
        </div>
        {trip.description && (
          <div className="trip-info-row">
            <strong>Description:</strong> {trip.description}
          </div>
        )}
      </div>

      <div className="players-section">
        <div className="section-header">
          <h3>Players ({invitedPlayers.length})</h3>
          <button 
            onClick={() => setShowInviteForm(!showInviteForm)} 
            className="invite-btn"
          >
            {showInviteForm ? 'Cancel' : '+ Invite Players'}
          </button>
        </div>

        {showInviteForm && (
          <div className="invite-form">
            <h4>Select Players to Invite</h4>
            {availablePlayers.length === 0 ? (
              <p className="no-players">All players have been invited</p>
            ) : (
              <>
                <div className="players-list">
                  {availablePlayers.map(player => (
                    <label key={player.playerId} className="player-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedPlayers.includes(player.playerId)}
                        onChange={() => togglePlayerSelection(player.playerId)}
                      />
                      <span>{player.name}</span>
                    </label>
                  ))}
                </div>
                <button 
                  onClick={handleInvitePlayers} 
                  className="add-players-btn"
                  disabled={selectedPlayers.length === 0}
                >
                  Add {selectedPlayers.length} Player{selectedPlayers.length !== 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>
        )}

        <div className="invited-players-list">
          {invitedPlayers.length === 0 ? (
            <p className="no-players">No players invited yet</p>
          ) : (
            invitedPlayers.map(player => (
              <div key={player.id} className="player-item">
                <div className="player-info">
                  <span className="player-name">{player.name}</span>
                  {player.email && <span className="player-email">{player.email}</span>}
                </div>
                <button 
                  onClick={() => handleRemovePlayer(player.id)} 
                  className="remove-btn"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <button onClick={onGoToLeaderboard} className="go-to-trip-btn">
        Go To Trip
      </button>
    </div>
  );
}

export default TripDetails;
