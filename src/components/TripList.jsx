import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

function TripList({ currentUser, isSuperUser = false, setView, setSelectedTrip }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserTrips();
  }, [currentUser, isSuperUser]);

  const fetchUserTrips = async () => {
    setLoading(true);
    try {
      // Get all trips (not filtering by isActive so all trips are visible)
      const tripsSnapshot = await getDocs(collection(db, 'trips'));
      
      console.log('TripList - Total active trips found:', tripsSnapshot.docs.length);
      console.log('TripList - Current user ID:', currentUser.uid);
      
      const userTrips = [];
      
      // Super users can see every trip; regular users must be trip members.
      for (const tripDoc of tripsSnapshot.docs) {
        const tripData = tripDoc.data();
        if (isSuperUser) {
          userTrips.push({ id: tripDoc.id, ...tripData });
          continue;
        }
        // Public trips (isPrivate === false) are visible to any logged-in user.
        if (tripData.isPrivate === false) {
          userTrips.push({ id: tripDoc.id, ...tripData });
          continue;
        }
        const playersSnapshot = await getDocs(
          collection(db, 'trips', tripDoc.id, 'players')
        );
        
        console.log(`TripList - Trip "${tripData.name}" has ${playersSnapshot.docs.length} players`);
        
        const isUserInTrip = playersSnapshot.docs.some(
          playerDoc => {
            const playerId = playerDoc.data().playerId;
            const match = playerId === currentUser.uid;
            console.log(`  Player ID: ${playerId}, Match: ${match}`);
            return match;
          }
        );
        
        console.log(`TripList - User is in trip "${tripData.name}": ${isUserInTrip}`);
        
        if (isUserInTrip) {
          userTrips.push({
            id: tripDoc.id,
            ...tripData
          });
        }
      }
      
      console.log('TripList - Total trips user is in:', userTrips.length);
      
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
                <div className="trip-card-row">
                  <strong>Visibility:</strong> {trip.isPrivate === false ? 'Public' : 'Private'}
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
