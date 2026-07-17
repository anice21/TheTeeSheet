# Edit Trip Feature

## Overview
The Edit Trip feature allows trip organizers to modify trip rounds after creation. This includes updating course selections, adding new rounds, and canceling/removing rounds from a trip.

## Purpose
Golf trips may need adjustments after creation due to:
- Weather conditions requiring course changes
- Availability changes at golf courses
- Player preferences or scheduling conflicts
- Addition of extra rounds during the trip
- Cancellation of planned rounds

This feature provides flexibility to manage trip logistics without recreating the entire trip.

## User Flow

### Accessing Edit Trip
1. User must be the trip organizer (organizerId matches user.uid)
2. Navigate to menu dropdown → "Edit Trip" (new menu option)
3. Select which trip to edit (if multiple active trips)
4. View current rounds list with edit options

### Editing a Round
1. Click "Edit" button next to a round
2. System validates that no scores have been entered for this round
3. If round has been started or finished, show error message and disable editing
4. Select a different course from dropdown (populated from courses collection)
5. Save changes - updates `trips/{tripId}/rounds/{roundId}`

### Adding a Round
1. Click "Add Round" button
2. Enter round number (tripRoundID)
3. Select course from dropdown
4. Save - creates new document in `trips/{tripId}/rounds`
5. System auto-increments tripRoundID if not specified

### Canceling a Round
1. Click "Delete/Cancel" button next to a round
2. System checks if any scores exist for this round
3. If scores exist: Show warning with confirmation dialog
4. If confirmed or no scores: Delete round document and associated scores

## Components Involved

### New Components
- **EditTrip.jsx** - Main component for editing trip rounds
  - Displays list of current rounds
  - Provides add/edit/delete functionality
  - Handles validation and confirmations

### Modified Components
- **App.jsx** - Add route and menu item for Edit Trip
- **TripScreen.jsx** - Potentially add "Edit" button after trip creation

## Data Structure

### Firestore Collections
```
trips/{tripId}
  - name: string
  - organizerId: string
  - isActive: boolean
  - startDate: timestamp
  - endDate: timestamp
  
  /rounds/{roundId}
    - tripRoundID: number (1, 2, 3, etc.)
    - courseId: string (reference to courses collection)
    - courseName: string
    - createdAt: timestamp
    - updatedAt: timestamp
  
  /scores/{scoreId}
    - tripRoundID: number
    - courseId: string
    - playerId: string
    - scores: array[18]
    - ... other score fields
  
  /players/{playerId}
    - playerId: string
    - name: string
    - handicap: number
```

## Implementation Details

### Phase 1: UI Component
1. Create `EditTrip.jsx` component
2. Fetch and display rounds for selected trip
3. Add basic UI for list of rounds with action buttons

### Phase 2: Edit Round Functionality
1. Implement course dropdown populated from courses collection
2. Update round document with new courseId and courseName
3. Validation: Check if any scores exist for this round (tripRoundID + courseId)
4. Check if any scores have isRoundFinished=true
5. If round has been started or finished, disable edit button and show message
6. Only allow editing for rounds with no score entries

### Phase 3: Add Round Functionality
1. Create form with course selection and optional round number
2. Auto-generate tripRoundID (max existing + 1)
3. Add new document to `trips/{tripId}/rounds`
4. Update UI to reflect new round

### Phase 4: Delete Round Functionality
1. Check for existing scores with this tripRoundID
2. Show confirmation dialog with count of affected scores
3. Delete round document
4. Optionally: Delete associated scores (or mark as inactive)
5. Update UI to reflect deletion

### Phase 5: Access Control
1. Verify user.uid === trip.organizerId before allowing edits
2. Show "Edit Trip" menu item only for trip organizer
3. Handle unauthorized access attempts gracefully

## Validation Rules
1. **Edit Round**: Cannot change course if any scores have been entered (round has started) or if round has been finished
2. **Delete Round**: Warn user if scores exist, require confirmation
3. **Add Round**: tripRoundID must be unique within trip
4. **All Operations**: Only trip organizer can make changes
5. **Round State**: Rounds with isRoundFinished=true cannot be edited, only deleted with confirmation

## UI/UX Considerations
- Show round numbers prominently (R1, R2, etc.)
- Display course names clearly
- Use color coding for round states:
  - Green: No scores (can edit)
  - Yellow: In progress (cannot edit, can delete with warning)
  - Red: Finished (cannot edit, can delete with confirmation)
- Disable edit button for started/finished rounds
- Show round status badge (Not Started, In Progress, Finished)
- Confirmation dialogs for destructive actions
- Success/error messages for all operations
- Loading states during async operations

## Database Operations

### Update Round Course
```javascript
const roundRef = doc(db, 'trips', tripId, 'rounds', roundId);
await updateDoc(roundRef, {
  courseId: newCourseId,
  courseName: newCourseName,
  updatedAt: serverTimestamp()
});
```

### Add New Round
```javascript
await addDoc(collection(db, 'trips', tripId, 'rounds'), {
  tripRoundID: nextRoundNumber,
  courseId: selectedCourseId,
  courseName: selectedCourseName,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
});
```

### Delete Round
```javascript
// Check for scores first
const scoresQuery = query(
  collection(db, 'trips', tripId, 'scores'),
  where('tripRoundID', '==', roundNumber)
);
const scoresSnapshot = await getDocs(scoresQuery);

// If confirmed, delete round and scores
const batch = writeBatch(db);
batch.delete(doc(db, 'trips', tripId, 'rounds', roundId));
scoresSnapshot.docs.forEach(scoreDoc => {
  batch.delete(scoreDoc.ref);
});
await batch.commit();
```

## Error Handling
- Network errors during save/delete
- Permission denied (non-organizer attempts)
- Concurrent edits by multiple users
- Missing or invalid course selections
- Database constraint violations

## Future Enhancements
- Edit trip name, dates, and other metadata
- Reorder rounds (change tripRoundID sequence)
- Bulk operations (add multiple rounds at once)
- Duplicate a round
- Archive rounds instead of deleting
- Email notifications to players when rounds change
- Ability to transfer organizer role
- Version history/audit log of trip changes
- Mobile-optimized edit interface
