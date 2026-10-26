# Net Scoring and Hole Handicaps - Implementation Plan

## Overview

Add handicap-aware net scoring to the golf leaderboard. Each course will store a handicap ranking for every hole. When a player enters a gross score, the application will determine whether the player receives a handicap stroke on that hole, calculate the player's net score, and use net scores wherever the user selects Net scoring.

This plan supports:

- Individual gross and net scoring
- Best Ball gross and net scoring
- Full, front 9, and back 9 rounds
- Player handicaps stored at the trip-player level
- Existing courses and scores without the new fields

## Current System Findings

- Courses currently store `pars`, but not per-hole handicap rankings.
- [AddCourse.jsx](src/components/AddCourse.jsx) creates 18-hole courses and defaults every hole to par 4.
- Trip players already have a `handicap` field and can be edited in [EditPlayerHandicap.jsx](src/components/EditPlayerHandicap.jsx).
- Score documents currently store `scores` and `scoreToPar`; score-to-par is calculated as gross score minus par.
- [Hole.jsx](src/components/Hole.jsx) writes scores as players enter them.
- [Leaderboard.jsx](src/components/Leaderboard.jsx) has Gross/Net controls, but its current Net calculation subtracts the player's full handicap from the gross total rather than allocating strokes by hole.
- Best Ball currently selects the lowest gross score per hole. Net Best Ball must select the lowest net score per hole after strokes are allocated to each player.

## Goals and Decisions

### Goals

1. Store a valid handicap ranking for holes 1 through 18 on every new course.
2. Allow course creators to enter or select each hole's handicap ranking.
3. Allocate handicap strokes consistently for each player and hole.
4. Preserve gross scores as the source of truth.
5. Calculate and display net scores without changing existing gross scoring behavior.
6. Make net scoring consistent in Hole, Scorecard, Leaderboard, and Round Summary.
7. Keep old courses and old score documents usable.

### Recommended Decisions

- Store the course field as `holeHandicaps: number[]`, with exactly 18 values.
- Use standard stroke allocation based on handicap ranking values 1 through 18.
- Treat handicap as an integer course handicap for v1. Keep the existing handicap range of -10 through 54 unless the product requirements change.
- Store derived net data on score documents for fast display, but always be able to recalculate it from gross scores, player handicap, and course data.
- Keep `scores` as gross scores. Do not replace them with net scores.

## Data Model

### Course Documents

Current shape:

```javascript
{
  state: "FL",
  name: "Example Golf Club",
  pars: [4, 4, 3, 5, ...],
  isActive: true,
  createdAt: Timestamp
}
```

New shape:

```javascript
{
  state: "FL",
  name: "Example Golf Club",
  pars: [4, 4, 3, 5, ...],
  holeHandicaps: [7, 15, 3, 1, ...],
  isActive: true,
  createdAt: Timestamp
}
```

`holeHandicaps[0]` is the handicap ranking for Hole 1. Every value must be an integer from 1 through 18, and the array must contain each ranking exactly once.

### Score Documents

Keep the existing fields and add derived net fields:

```javascript
{
  scores: [5, 4, 3, ...],
  scoreToPar: [1, 0, 0, ...],
  playerHandicap: 12,
  netScores: [4, 4, 3, ...],
  netScoreToPar: [0, 0, 0, ...],
  strokesReceived: [1, 0, 0, ...]
}
```

Recommended semantics:

- `scores`: gross score entered by the player.
- `scoreToPar`: gross score minus hole par.
- `netScores`: gross score minus strokes received on each hole.
- `netScoreToPar`: net score minus hole par.
- `strokesReceived`: number of handicap strokes applied on each hole.

Derived fields should be refreshed whenever a score, handicap, or course handicap ranking changes. The UI should also calculate them defensively when fields are missing.

## Handicap Stroke Allocation

### Standard Handicap Rules

For a non-negative handicap `H`:

- Base strokes per hole: `floor(H / 18)`.
- Extra strokes: `H % 18`.
- Add one extra stroke on holes whose handicap ranking is less than or equal to the extra-stroke count.

Examples:

- Handicap 0: no strokes.
- Handicap 12: one stroke on hole rankings 1 through 12.
- Handicap 18: one stroke on every hole.
- Handicap 24: two strokes on every hole, plus one additional stroke on rankings 1 through 6.
- Handicap 36: two strokes on every hole.
- Handicap 54: three strokes on every hole.

For a plus handicap, such as `-2`, use the same ranking order to give strokes back: subtract one stroke on the two lowest handicap-ranking holes. This should be isolated in the scoring helper so the rule can be revised without changing components.

### Recommended Shared Utility

Create a utility such as `src/utils/scoring/handicap.js` with pure functions:

```javascript
getStrokesReceived(playerHandicap, holeHandicap)
calculateNetScore(grossScore, playerHandicap, holeHandicap)
calculateNetScoreToPar(grossScore, par, playerHandicap, holeHandicap)
calculateHoleScores(grossScores, pars, holeHandicaps, playerHandicap)
```

The helper must handle:

- Missing or invalid handicap rankings
- Missing handicap values
- Zero or unplayed scores
- Front 9 and back 9 ranges
- Negative handicaps
- Handicaps above 18

## Implementation Phases

### Phase 1: Finalize the Net Scoring Contract

- Confirm the meaning of the existing player handicap field: course handicap for the selected round, not handicap index.
- Confirm whether decimal handicaps are out of scope for v1.
- Confirm the plus-handicap convention.
- Confirm whether Best Ball Net uses lowest net score per hole. Recommended: yes.
- Document the scoring examples and expected outputs before editing components.

### Phase 2: Course Data and Add Course UI

**File:** [src/components/AddCourse.jsx](src/components/AddCourse.jsx)

Changes:

1. Add `holeHandicaps` state initialized to a valid default, preferably `[1, 2, ..., 18]`.
2. Add one handicap-ranking control next to each hole's par control.
3. Display the hole number, par, and handicap ranking together.
4. Validate that all rankings are present, numeric, within 1 through 18, and unique.
5. Prevent saving until the rankings form a complete permutation.
6. Save `holeHandicaps` with the course document.
7. Reset both pars and hole handicaps after a successful save.
8. Keep the form usable on mobile; use a compact two-column hole editor or a responsive row layout.

Suggested UI concept:

```text
Hole 1    Par [4]    Handicap [7]
Hole 2    Par [4]    Handicap [15]
...
```

The form should explain that a lower handicap ranking means the hole receives strokes first. Avoid silently creating invalid courses with duplicate rankings.

### Phase 3: Course Loading and Legacy Courses

**Files:** [src/components/RoundStart.jsx](src/components/RoundStart.jsx), [src/components/Hole.jsx](src/components/Hole.jsx), [src/components/Scorecard.jsx](src/components/Scorecard.jsx), [src/components/Leaderboard.jsx](src/components/Leaderboard.jsx)

- Load `holeHandicaps` with the rest of the course data.
- Add a compatibility helper for courses without the field.
- Recommended legacy behavior: use `[1, 2, ..., 18]` as a temporary fallback and mark net scores as unavailable or provisional until the course is updated.
- Do not silently claim that a legacy course's net score is official unless its hole rankings are known.
- Add an admin/data migration path to populate existing courses with verified rankings.

### Phase 4: Persist Player Handicap Snapshot

**File:** [src/components/RoundStart.jsx](src/components/RoundStart.jsx)

- Continue reading the trip-specific player handicap.
- Store `playerHandicap` on every new score document as a snapshot for the round.
- Decide whether editing a player's handicap after a round starts is allowed. Recommended: no; the round snapshot remains stable.
- For rounds already in progress without `playerHandicap`, use the current trip-player handicap when recalculating and optionally backfill the snapshot.

### Phase 5: Implement Shared Handicap Calculations

**New file:** `src/utils/scoring/handicap.js`

Implement and unit test:

1. `getStrokesReceived(handicap, holeHandicap)`.
2. `calculateNetScore(grossScore, handicap, holeHandicap)`.
3. `calculateNetScoreToPar(grossScore, par, handicap, holeHandicap)`.
4. A full-round helper returning `netScores`, `netScoreToPar`, and `strokesReceived`.

Use one helper everywhere. Do not duplicate stroke allocation in Hole, Leaderboard, Scorecard, and Round Summary.

### Phase 6: Update Hole Entry and Firestore Writes

**File:** [src/components/Hole.jsx](src/components/Hole.jsx)

- Keep the entered value as gross score.
- When saving a hole, calculate and persist:
  - gross score
  - gross score-to-par
  - strokes received
  - net score
  - net score-to-par
- Apply the same logic in both `saveHoleScore` and `nextHole`; currently both write score data and must not diverge.
- Display the player's gross score during entry. Add a compact net indicator only if the product wants live net feedback.
- If a player receives a stroke on the current hole, show the net result clearly without changing the input value.
- For Best Ball, calculate both gross and net team values using the team members' hole scores. Net Best Ball must use the lowest net score for the hole, not the lowest gross score followed by a team handicap.
- Ensure the team calculation is restricted to members of the same `teamId` when multiple teams share a group.

### Phase 7: Scorecard Net Display

**File:** [src/components/Scorecard.jsx](src/components/Scorecard.jsx)

- Add a Gross/Net selection or display mode consistent with the rest of the application.
- Show per-hole net scores when Net is selected.
- Show the strokes received for transparency, either in a secondary row or tooltip/detail view.
- For Best Ball:
  - Gross team row uses the lowest gross score per hole.
  - Net team row uses the lowest net score per hole.
- Keep the individual gross view available so users can audit the result.
- Handle front 9, back 9, and full rounds using the same hole indexes and selected range.

### Phase 8: Live Leaderboard

**File:** [src/components/Leaderboard.jsx](src/components/Leaderboard.jsx)

- Replace the current Net behavior that subtracts the full handicap from a total.
- Individual Net rows should sum each player's hole net scores for the selected round.
- Best Ball Net rows should sum the lowest net score per hole for each team.
- Preserve the current live display convention for score-to-par: `E`, `+N`, or `-N`.
- Keep gross and net sorting consistent with the displayed value.
- Ensure unfinished holes do not contribute a fabricated score. A hole with no valid score should remain unplayed.
- For multiple teams in one group, group by `teamId`, not `groupId`.

### Phase 9: Tournament Leaderboard

**File:** [src/components/Leaderboard.jsx](src/components/Leaderboard.jsx)

- Update tournament Gross/Net controls to use hole-level calculations.
- Individual Gross: sum gross scores.
- Individual Net: sum net scores after stroke allocation.
- Best Ball Gross: sum lowest gross score per hole for each team and round.
- Best Ball Net: sum lowest net score per hole for each team and round.
- Preserve team membership across rounds using a stable team identity. Do not assume a generated `teamId` is stable between rounds unless that is guaranteed by the data model.
- Recommended team identity for tournament aggregation: sorted member player IDs, scoped to the trip and format.
- Define how mixed individual and Best Ball tournament rounds are displayed. Recommended: show separate format sections or explicitly label unsupported mixed totals rather than silently combining incomparable rows.

### Phase 10: Round Summary

**File:** [src/components/RoundSummary.jsx](src/components/RoundSummary.jsx)

- Show gross total, net total, and score-to-par for individual rounds.
- Show the player's handicap and strokes received by hole when useful.
- For Best Ball, show gross and net team totals separately.
- For Best Ball Net, show each player's net contribution and which net score counted per hole.
- Use the shared helper and the round's handicap snapshot rather than subtracting handicap from the final total.
- Keep existing round completion and deletion behavior unchanged.

### Phase 11: Migration and Backward Compatibility

**New migration scripts:**

- `scripts/addHoleHandicapsToCourses.js`
- `scripts/backfillNetScoreFields.js`

Migration behavior:

1. Identify courses missing `holeHandicaps`.
2. Do not invent official rankings in production. Support a dry-run report and an explicit input/configuration step for verified rankings.
3. Add `playerHandicap` snapshots to score documents when safely available.
4. Backfill net fields only when the course has valid hole rankings and a known handicap.
5. Leave legacy gross-only documents readable.
6. Make migrations idempotent and batch writes at Firestore's batch limit.
7. Log skipped documents and reasons.

### Phase 12: Validation and Testing

#### Unit Tests

- Handicap 0 receives zero strokes.
- Handicap 12 receives one stroke on rankings 1 through 12.
- Handicap 18 receives one stroke on every hole.
- Handicap 24 receives two strokes on every hole and a third on rankings 1 through 6.
- Plus handicap behavior is correct and documented.
- Invalid or missing hole rankings fail safely.
- Unplayed scores do not produce net scores.
- Net score-to-par equals net score minus par.

#### Component and Integration Tests

- Add Course saves valid hole rankings.
- Add Course rejects duplicate or missing rankings.
- Existing courses without rankings remain usable for gross scoring.
- New rounds snapshot the player's handicap.
- Entering a score writes gross and net fields consistently.
- Editing a score recalculates both gross and net fields.
- Front 9 and back 9 use the correct hole rankings.
- Individual live leaderboard Gross and Net values are correct.
- Best Ball live leaderboard Gross and Net values are correct.
- Multiple teams in one group do not share scores or handicaps.
- Tournament Gross and Net values match the live round calculations.
- Round Summary displays the same values as the leaderboard.
- Changing a player's handicap after a round starts does not mutate the round snapshot.

#### Example Acceptance Case

Course pars: `[4, 4, 3, 5]` with hole handicaps `[1, 2, 3, 4]`.

Player handicap: `2`.

Gross scores: `[5, 5, 4, 5]`.

Strokes received: `[1, 1, 0, 0]`.

Net scores: `[4, 4, 4, 5]`.

Gross score-to-par: `[1, 1, 1, 0]`.

Net score-to-par: `[0, 0, 1, 0]`.

The implementation should produce these values in the score document and every view that displays Net scoring.

## Documentation Updates

After implementation:

- Update [BESTBALL-USER-GUIDE.md](BESTBALL-USER-GUIDE.md) with Gross vs Net scoring and stroke examples.
- Update [BESTBALL-IMPLEMENTATION-PLAN.md](BESTBALL-IMPLEMENTATION-PLAN.md) if Best Ball behavior changes.
- Update [README.md](README.md) with course handicap-ranking requirements and net-scoring behavior.
- Add a short administrator note describing how to verify hole handicap rankings.

## Risks and Mitigations

### Incorrect course rankings

Mitigation: validate rankings as a complete 1-18 permutation and require verified values during migration.

### Handicap changes altering historical rounds

Mitigation: snapshot `playerHandicap` on score documents and treat completed rounds as immutable.

### Gross and net logic diverging across views

Mitigation: centralize calculations in a pure utility and test against shared fixtures.

### Best Ball ambiguity

Mitigation: explicitly define Gross Best Ball as lowest gross per hole and Net Best Ball as lowest net per hole.

### Mixed tournament formats

Mitigation: show separate standings or label format-specific totals; do not silently add individual and team scores together.

## Suggested Delivery Order

1. Approve the scoring contract and plus-handicap decision.
2. Add and validate course hole handicap rankings.
3. Add the shared handicap utility and unit tests.
4. Snapshot player handicaps when rounds start.
5. Update Hole writes and verify persisted net fields.
6. Update Scorecard and Round Summary.
7. Update live leaderboard.
8. Update tournament leaderboard.
9. Run migrations in development with dry-run output.
10. Complete manual testing, then deploy.

## Success Criteria

- Every new course has valid hole handicap rankings.
- A player's stroke allocation is correct for every supported handicap.
- Gross scores remain unchanged and auditable.
- Net scores are consistent across Hole, Scorecard, Leaderboard, and Round Summary.
- Individual and Best Ball Net scoring use hole-level stroke allocation.
- Existing gross-only courses and rounds continue to work.
- Historical completed rounds do not change unexpectedly after handicap edits.

---

*Document Version: 1.0*  
*Created: 2026-08-18*  
*Status: Draft for review*
