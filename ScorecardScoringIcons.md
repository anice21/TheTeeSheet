# Scorecard Scoring Icons

## Icon Legend

| Visual | Name | Meaning |
|---|---|---|
| — | Par | No symbol |
| ○ | Birdie | Circle |
| ● | Eagle | Solid circle |
| ◎ | Albatross or better | Solid circle with frame |
| □ | Bogey | Square |
| ■ | Double bogey | Solid square |
| ▣ | Triple bogey or worse | Solid square with frame |

## Usage Notes

- Icons are drawn **over the score number** (e.g., a “3” appears inside the circle).
- When the score is in a solid circle or solid square the score should change color should change to white.
- This changes would be made to the Scorecard screen.

## Implementation steps

1. Locate the Scorecard UI component that renders per-hole scores: `src/components/Scorecard.jsx` (per-hole scores are rendered in `round.scores.map(...)` inside the table body).
2. Identify the score cell markup where the number is shown.
3. Wrap the score number in a relative container that can host the overlay.
4. Render the icon as an absolutely positioned overlay based on score-to-par.
5. Center the number inside the icon shape.
6. Apply white text color when the icon is solid (● or ■).
7. Add accessible text (e.g., `aria-label="Birdie"`).
8. Verify visuals for all scoring outcomes on the Scorecard screen.