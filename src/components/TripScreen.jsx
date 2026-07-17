import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore';
import TripDetails from './TripDetails';
import RoundSelection from './RoundSelection';
import { useLogger, useLogLifecycle } from '../utils/logger/LoggerContext';
import { LOG_CATEGORIES } from '../config/logging';

function TripScreen({ currentUser, setView }) {
  const logger = useLogger('TripScreen');
  useLogLifecycle('TripScreen');
  
  const [tripName, setTripName] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [currentTripId, setCurrentTripId] = useState(null);
  const [currentView, setCurrentView] = useState('create'); // 'create' | 'selectRounds' | 'details'
  const [currentTripData, setCurrentTripData] = useState(null);

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    logger.info('Creating trip', {
      tripName,
      location,
      category: LOG_CATEGORIES.TRIP,
    });

    try {
      const tripData = {
        name: tripName,
        location: location,
        startDate: Timestamp.fromDate(new Date(startDate)),
        endDate: Timestamp.fromDate(new Date(endDate)),
        description: description,
        organizerId: currentUser?.uid || '',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        isActive: true
      };

      const docRef = await addDoc(collection(db, 'trips'), tripData);
      
      logger.info('Trip created successfully', {
        tripId: docRef.id,
        tripName,
        category: LOG_CATEGORIES.TRIP,
      });
      
      setMessage('Trip created successfully!');
      // Store trip data and navigate to round selection
      setCurrentTripId(docRef.id);
      setCurrentTripData(tripData);
      setCurrentView('selectRounds');
      // Reset form
      setTripName('');
      setLocation('');
      setStartDate('');
      setEndDate('');
      setDescription('');
    } catch (error) {
      logger.error('Error creating trip', {
        error,
        tripName,
        category: LOG_CATEGORIES.TRIP,
      });
      setMessage('Error creating trip. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleBackToCreate = () => {
    setCurrentTripId(null);
    setCurrentTripData(null);
    setCurrentView('create');
    setMessage('');
  };

  const handleBackToRoundSelection = () => {
    setCurrentView('selectRounds');
  };

  const handleRoundSelectionComplete = () => {
    setCurrentView('details');
  };

  if (currentView === 'selectRounds' && currentTripId) {
    return (
      <RoundSelection 
        tripId={currentTripId}
        tripData={currentTripData}
        onComplete={handleRoundSelectionComplete}
        onBack={handleBackToCreate}
      />
    );
  }

  if (currentView === 'details' && currentTripId) {
    return (
      <TripDetails 
        tripId={currentTripId} 
        onBack={handleBackToRoundSelection}
        onGoToLeaderboard={() => setView('leaderboard')}
      />
    );
  }

  return (
    <div className="trip-screen">
      <h2>Create a Trip</h2>
      {message && (
        <div className={`trip-message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}
      <form onSubmit={handleCreateTrip} className="trip-form">
        <div className="form-group">
          <label htmlFor="tripName">Trip Name</label>
          <input
            type="text"
            id="tripName"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
            placeholder="e.g., Weekend Golf Getaway"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="location">Location</label>
          <input
            type="text"
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g., Pebble Beach, CA"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="startDate">Start Date</label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="endDate">End Date</label>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details about the trip..."
            rows="4"
          />
        </div>

        <button type="submit" className="trip-submit-btn" disabled={saving}>
          {saving ? 'Creating...' : 'Create Trip'}
        </button>
      </form>
    </div>
  );
}

export default TripScreen;
