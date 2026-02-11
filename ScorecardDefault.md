# Scorecard Default Load — Implementation Plan

## Goal
When the user clicks the Scorecard button, check for an in-progress round. If one exists, load its scorecard. If not, keep the current Scorecard flow unchanged.

## Current Behavior (Baseline)
- Clicking Scorecard shows the default scorecard flow (no resume logic).

## Proposed Behavior
1. On Scorecard button click, check for an in-progress round.
2. If found, load the Scorecard for that round.
3. If not found, continue with the existing behavior.

## Implementation Steps
1. **Identify entry point**
	- Use [src/components/Scorecard.jsx](src/components/Scorecard.jsx) as the entry point for the in-progress lookup.
	- The lookup should run when the Scorecard view loads.

2. **Define “in-progress” round criteria**
	- Query Firebase `rounds` where `playerID == currentUser.uid` and `isRoundFinished == false`.
	- Return the `groupId` and `courseId` from the in-progress round; these will be defaulted and displayed on the scorecard.
	- If needed, add/confirm an index for querying by `playerID` and `isRoundFinished`.

3. **Set defaults from returned IDs (inside Scorecard)**
	- In [src/components/Scorecard.jsx](src/components/Scorecard.jsx), check for the user’s in-progress round on load.
	- Use the returned `courseId` to set the default value in the course dropdown.
	- After courses load, select the matching course if it exists.
	- Then use the returned `groupId` to set the default value in the group dropdown.
	- After groups load for that course, select the matching group if it exists.

4. **Scorecard load path adjustments**
	- Ensure Scorecard accepts defaults (e.g., props or state) for `courseId` and `groupId`.
	- Apply the defaults after the respective lists are loaded to avoid race conditions.

5. **UI state and UX**
	- Add a brief loading state when checking for in-progress rounds.
	- If lookup fails (network error), fallback to existing flow with a toast or silent fallback (choose consistent pattern).

6. **Testing**
	- No in-progress round → current flow unchanged.
	- In-progress round exists → loads saved round.
	- Multiple rounds in-progress (if possible) → select most recent or first by timestamp.
	- Logged out user → existing behavior or sign-in flow unchanged.

## Files Likely Involved
- [src/components/RoundStart.jsx](src/components/RoundStart.jsx)
- [src/components/Leaderboard.jsx](src/components/Leaderboard.jsx)
- [src/components/Scorecard.jsx](src/components/Scorecard.jsx)
- [src/firebase.js](src/firebase.js)

## Acceptance Criteria
- Clicking Scorecard resumes an in-progress round if it exists.
- Clicking Scorecard with no active round behaves exactly as before.
- No regressions in current Scorecard creation flow.
