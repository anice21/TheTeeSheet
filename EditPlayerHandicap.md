# Edit Player Handicap Feature

## Overview
Allow users to view and edit player handicaps for their golf trips. This feature displays all players from the current trip with their handicaps in an editable list. Users can update multiple handicaps and save all changes at once with a single save button. Updated handicaps will be used for all future rounds in the trip.

## User Story
As a trip organizer, I want to see all players and their current handicaps on one screen, update any handicaps that have changed, and save all updates at once so that the next round uses the correct handicaps.

## Component: EditPlayerHandicap.jsx

### Location
`src/components/EditPlayerHandicap.jsx`

### Props
- `tripId` (string): The ID of the current trip
- `onBack` (function): Callback function to navigate back to leaderboard screen
- `onSave` (function): Optional callback after successful save

### State Management
```javascript
{
  players: [],              // Array of player objects with original handicaps
  editedHandicaps: {},      // Map of playerId -> edited handicap value
  loading: true,
  saving: false,
  error: null,
  hasChanges: false         // Track if any handicaps have been modified
}
```

### Data Structure
Players are fetched from the current trip's subcollection:
```javascript
// From Firebase: trips/{tripId}/players/{playerId}
{
  id: "abc123",              // Document ID
  playerId: "user123",       // Reference to main player
  name: "John Doe",
  handicap: 12,              // Current handicap from Firebase
  email: "john@example.com",
  invitationStatus: "accepted",
  invitedAt: timestamp,
  handicapUpdated: timestamp // Last time handicap was updated
}
```

### UI Layout
1. **Header Section**
   - Back button (← arrow) to return to leaderboard screen
   - Title: "Edit Player Handicaps"
   - Subtitle: "Changes will apply to future rounds"

2. **Player List**
   - Scrollable list/table view with:
     - Player Name (left-aligned)
     - Handicap dropdown select (right-aligned)
   - Dropdown options: handicaps from -10 to 54 (or configurable range)
   - Display format: whole numbers only (e.g., -10, -9, -8, ..., 0, 1, 2, ..., 54)
   - Visual indication (e.g., highlight or different background) when value is modified from original
   - Show all players at once (no pagination needed for typical group sizes)

3. **Footer Section**
   - Fixed position at bottom of screen
   - "Save Changes" button (primary action)
     - Disabled when no changes or validation errors
     - Shows loading state while saving
   - "Cancel" button to discard changes and return to leaderboard

### Firebase Structure
```
trips/{tripId}/players/{docId}
  - playerId: string         // Reference to main player document
  - name: string            // Player name
  - email: string           // Player email
  - handicap: number        // Current handicap (this is what we edit)
  - handicapUpdated: timestamp  // Last update time
  - invitationStatus: string
  - invitedAt: timestamp
```
Note: This component reads the current `handicap` value and updates it when saving.

### Key Functionality

#### 1. Generate Handicap Options
```javascript
const generateHandicapOptions = () => {
  const options = [];
  // Generate from -10 to 54 in full increments
  for (let i = -10; i <= 54; i++) {
    options.push(i);
  }
  return options;
};

const handicapOptions = useMemo(() => generateHandicapOptions(), []);
```

#### 2. Fetch Players
```javascript
useEffect(() => {
  const fetchPlayers = async () => {
    // Fetch players from current trip's subcollection
    const playersRef = collection(db, `trips/${tripId}/players`);
    const snapshot = await getDocs(playersRef);
    const playersList = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setPlayers(playersList);
    setLoading(false);
  };
  fetchPlayers();
}, [tripId]);
```
Note: Each player's current `handicap` value from Firebase will be used as the initial value in the dropdown.

#### 3. Handle Dropdown Change
```javascript
const handleHandicapChange = (playerId, value) => {
  setEditedHandicaps(prev => ({
    ...prev,
    [playerId]: parseFloat(value)
  }));
  setHasChanges(true);
};

// Render dropdown for each player
<select 
  value={editedHandicaps[player.id] ?? player.handicap} // Use current handicap from Firebase as default
  onChange={(e) => handleHandicapChange(player.id, e.target.value)}
  className={editedHandicaps[player.id] !== undefined ? 'modified' : ''}
>
  {handicapOptions.map(option => (
    <option key={option} value={option}>
      {option}
    </option>
  ))}
</select>
```
The dropdown is pre-populated with the player's current handicap value from Firebase (`player.handicap`). If the user hasn't made changes yet, it shows the value from Firebase. Once edited, it shows the edited value.

#### 4. Save All Changes
```javascript
const saveAllChanges = async () => {
  setSaving(true);
  setError(null);
  
  try {
    const batch = writeBatch(db);
    
    // Add all updates to batch
    Object.entries(editedHandicaps).forEach(([playerId, handicap]) => {
      const playerRef = doc(db, `trips/${tripId}/players/${playerId}`);
      batch.update(playerRef, {
        handicap: parseFloat(handicap),
        handicapUpdated: serverTimestamp()
      });
    });
    
    // Commit all updates at once
    await batch.commit();
    
    // Success - navigate back or show confirmation
    setHasChanges(false);
    if (onSave) onSave();
    
  } catch (error) {
    setError('Failed to save handicaps. Please try again.');
  } finally {
    setSaving(false);
  }
};
```

#### 5. Validation
- Dropdown ensures all values are valid (no manual input validation needed)
- No validation errors possible since values are constrained
- Save button only disabled when there are no changes
- Optional: detect if a player has no handicap set and highlight in UI

### Integration Points

#### 1. Leaderboard.jsx
Add navigation to the EditPlayerHandicap screen from leaderboard:
```javascript
<button onClick={() => navigate(`/trips/${tripId}/edit-handicaps`)}>
  Edit Handicaps
</button>
```

Or if using component-based navigation:
```javascript
{currentView === 'editHandicaps' ? (
  <EditPlayerHandicap
    tripId={tripId}
    onBack={() => setCurrentView('leaderboard')}
    onSave={() => {
      // Refresh leaderboard data
      setCurrentView('leaderboard');
    }}
  />
) : (
  // Leaderboard view
)}
```

#### 2. App.jsx / Routing
Add route for the edit handicaps screen if using routing:
```javascript
<Route path="/trips/:tripId/edit-handicaps" element={<EditPlayerHandicap />} />
```

Ensure navigation back goes to leaderboard:
```javascript
const handleBack = () => {
  navigate(`/trips/${tripId}/leaderboard`);
};
```

#### 3. Next Round Creation
- Ensure new rounds fetch the latest handicap values
- Updated handicaps automatically apply to any rounds created after save
- No changes to historical/completed rounds
- Leaderboard should refresh/refetch data after handicaps are updated

### Styling Guidelines
- Use consistent styling with existing components
- Full screen layout (not modal)
- Fixed header with back button and title
- Scrollable middle section for player list
- Fixed footer with action buttons
- Responsive design for mobile and desktop
- Style dropdowns for easy mobile selection (larger touch targets)
- Clear visual feedback for modified values (e.g., blue highlight or background color)
- Disable save button when no changes
- Loading spinner in save button while saving
- Success message or auto-navigation after successful save

### Security Considerations
- Verify user has permission to edit trip data
- Only trip creator or authorized users can edit handicaps
- Validate all inputs on both client and server
- Consider Firebase Security Rules:
```javascript
match /trips/{tripId}/players/{playerId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && 
    get(/databases/$(database)/documents/trips/$(tripId)).data.createdBy == request.auth.uid;
}
```

### Testing Checklist
- [ ] Load all players successfully
- [ ] Dropdown displays all handicap options (-10 to 54)
- [ ] Current handicap is pre-selected in dropdown
- [ ] Edit single player handicap via dropdown
- [ ] Edit multiple player handicaps before saving
- [ ] Save button disabled when no changes
- [ ] Save button shows loading state while saving
- [ ] All changes saved correctly in single batch operation
- [ ] Visual feedback for modified values
- [ ] Dropdown works well on mobile (easy to select)
- [ ] Error handling for network failures
- [ ] Updated handicaps used in next round creation
- [ ] Historical rounds unaffected by handicap changes
- [ ] Mobile responsive layout
- [ ] Cancel/back without saving discards changes
- [ ] Confirmation prompt if leaving with unsaved changes
- [ ] Permission checks work correctly

### Future Enhancements
- Handicap history tracking
- Import handicaps from GHIN or other systems
- Bulk edit functionality
- Automatic handicap calculation from previous rounds
- Handicap index vs course handicap conversion
- Email notifications when handicaps are changed

## Implementation Steps

1. Create `EditPlayerHandicap.jsx` component file
2. Implement full screen layout (header, scrollable list, fixed footer)
3. Generate handicap options array (-10 to 54 in full increments)
4. Add Firebase data fetching logic for players
5. Implement dropdown select components for each player
6. Implement dropdown change handlers and state management
7. Implement batch save functionality using Firestore batch writes
8. Add visual feedback for modified values (highlight changed dropdowns)
9. Style dropdowns for mobile-friendly selection
10. Integrate navigation from TripScreen component
11. Add unsaved changes warning when leaving screen
12. Update Firebase security rules if needed
13. Test thoroughly (especially batch save and mobile dropdown UX)
14. Verify next round uses updated handicaps

## Dependencies
- Firebase Firestore (already in project)
- React hooks (useState, useEffect)
- Existing styling system
- Authentication context for permissions

## Estimated Effort
- Component development: 3-4 hours
- Integration and testing: 1-2 hours
- Documentation: 30 minutes
- **Total: 4-6 hours**
