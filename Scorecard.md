
# Scorecard Feature

## Overview
The Scorecard feature allows users to view their scores for each hole during a round of golf. This screen is strictly view-only; users cannot edit or input scores from this screen. It provides a clear, read-only interface for reviewing scores and monitoring performance throughout the game.

## Goals
- Add a "Scorecard" button to the top navigation bar, alongside "Leaderboard" and "Current Round"
- Display a scorecard for the current round
- Allow users to view scores for each hole
- On the Scorecard screen, provide two dropdowns: one for selecting the course and one for selecting the group id
- Only display the scorecard after both course and group are selected

## User Stories
- As a user, I want to access the Scorecard screen from the top navigation bar, which includes "Leaderboard", "Scorecard", and "Current Round" options.
- As a user, I want to see a scorecard with all holes listed so I can track my progress.
- As a user, I want to view my score for each hole as I play.
- As a user, I want to select a course and then a group from dropdowns on the Scorecard screen, so I can view the scorecard for that group on that course.

## Acceptance Criteria
- [ ] The top navigation bar includes buttons for "Leaderboard", "Scorecard", and "Current Round"
- [ ] Pressing the "Scorecard" button navigates to the Scorecard screen
- [ ] Scorecard displays all holes for the round
- [ ] Users cannot input or edit scores from this screen
- [ ] Scorecard screen has a course dropdown and a group id dropdown
- [ ] User must select a course before selecting a group
- [ ] Scorecard is only displayed after both course and group are selected

## UI Mockup (optional)
_Add a wireframe or screenshot here if available._

## Technical Notes
- Add a "Scorecard" button to the top navigation bar, alongside existing navigation options
- Component: `Scorecard.jsx`
- On the Scorecard screen, add a dropdown for course selection
- After a course is selected, populate and enable a dropdown for group selection
- Only display the scorecard after both course and group are selected
- State management for scores (consider context or Redux if needed)
- Ensure all score data is read-only on this screen
- Support for team or group scorecards
- Export or share scorecard



---

# Implementation Task List

1. **Create Scorecard Screen Component**
	- Create `Scorecard.jsx` if it does not exist.
	- Set up the basic layout for the Scorecard screen.

2. **Update Navigation Bar**
	- Add a "Scorecard" button to the top navigation bar, alongside "Leaderboard" and "Current Round".
	- Ensure navigation works and routes to the Scorecard screen.

3. **Add Course Dropdown**
	- Fetch and display a list of available courses in a dropdown.
	- Handle course selection and store the selected course in state.

4. **Add Group Dropdown**
	- After a course is selected, fetch and display the groups for that course in a second dropdown.
	- Handle group selection and store the selected group in state.

5. **Display Scorecard**
	- Only display the scorecard after both course and group are selected.
	- Fetch and display the scorecard data for the selected course and group.
	- Ensure the scorecard is view-only (no editing).

6. **Integrate with Leaderboard and Round Data**
	- Ensure the scorecard data updates in real-time as scores are updated elsewhere.
	- Integrate with existing state management or backend as needed.

7. **UI/UX Enhancements**
	- Ensure the UI is clear, accessible, and matches the rest of the app.
	- Optionally add loading indicators, error handling, and empty states.

8. **Testing**
	- Test navigation, dropdowns, and scorecard display for various scenarios.
	- Ensure the view-only restriction is enforced.