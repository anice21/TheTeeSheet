# Feature: Default to Live Leaderboard for In-Progress Round

## Requirement
When a user navigates to the leaderboard screen, if they already have a round **in progress**, the view should automatically default to the **live leaderboard** for that round.

## Implementation Plan
1. **Identify current user + active round source**
	- Confirm how authentication is provided (likely `firebase.js` + `AuthForm.jsx`).
	- Locate where a user’s active round is stored (Firestore collection or local state).

2. **Find leaderboard entry point**
	- Inspect `Leaderboard.jsx` and any routing or parent component (likely `App.jsx`) to see how the leaderboard screen is rendered.

3. **Add “in-progress round” lookup**
	- On leaderboard screen mount, query Firebase `rounds` where `playerID == currentUser.uid` and `isRoundFinished == false`.
	- If found, set the leaderboard context/view to that round’s live leaderboard.

4. **Default behavior fallback**
	- If no in-progress round exists, default to the tournament leaderboard.

5. **UI state update**
	- Ensure any view toggle or filter is updated to “Live” automatically.
	- Avoid flicker by showing a loading state until the active round lookup completes.

6. **Testing**
	- Verify navigation with: (a) in-progress round, (b) no active round, (c) multiple rounds (ensure only active one is selected).

## Notes / Open Questions
- Define where “in progress” is stored (status field, endTime missing, etc.).
- Confirm whether leaderboard has a dedicated route or tab for “Live”.
