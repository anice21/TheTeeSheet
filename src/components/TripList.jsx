import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

function TripList({ currentUser, setView, setSelectedTrip }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserTrips();
  }, [currentUser]);

  const fetchUserTrips = async () => {
    setLoading(true);
    try {
      // Get all active trips
      const tripsQuery = query(
        collection(db, 'trips'),
        where('isActive', '==', true)
      );
      const tripsSnapshot = await getDocs(tripsQuery);
      
      const userTrips = [];
      
      // For each trip, check if the user is in the players subcollection
      for (const tripDoc of tripsSnapshot.docs) {
        const playersSnapshot = await getDocs(
          collection(db, 'trips', tripDoc.id, 'players')
        );
        
        const isUserInTrip = playersSnapshot.docs.some(
          playerDoc => playerDoc.data().playerId === currentUser.uid
        );
        
        if (isUserInTrip) {
          userTrips.push({
            id: tripDoc.id,
            ...tripDoc.data()
          });
        }
      }
      
      // Sort trips by start date (most recent first)
      userTrips.sort((a, b) => {
        const dateA = a.startDate?.toDate() || new Date(0);
        const dateB = b.startDate?.toDate() || new Date(0);
        return dateB - dateA;
      });
      
      setTrips(userTrips);
    } catch (error) {
      console.error('Error fetching user trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTrip = (trip) => {
    setSelectedTrip(trip);
    setView('leaderboard');
  };

  if (loading) {
    return <div className="trip-list">Loading...</div>;
  }

  return (
    <div className="trip-list">
      <h2>My Trips</h2>
      
      {trips.length === 0 ? (
        <div className="no-trips">
          <p>You haven't been added to any trips yet.</p>
        </div>
      ) : (
        <div className="trips-grid">
          {trips.map(trip => (
            <div 
              key={trip.id} 
              className="trip-card"
              onClick={() => handleSelectTrip(trip)}
            >
              <h3>{trip.name}</h3>
              <div className="trip-card-info">
                <div className="trip-card-row">
                  <strong>Location:</strong> {trip.location}
                </div>
                <div className="trip-card-row">
                  <strong>Dates:</strong> {trip.startDate?.toDate().toLocaleDateString()} - {trip.endDate?.toDate().toLocaleDateString()}
                </div>
                {trip.description && (
                  <div className="trip-card-description">
                    {trip.description}
                  </div>
                )}
              </div>
              <div className="trip-card-arrow">→</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TripList;
