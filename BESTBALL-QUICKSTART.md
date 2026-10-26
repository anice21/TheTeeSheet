# Best Ball Implementation - Quick Start Guide

This guide helps developers get started implementing the Best Ball format feature.

## Prerequisites

1. Read [BESTBALL-IMPLEMENTATION-PLAN.md](./BESTBALL-IMPLEMENTATION-PLAN.md) for full details
2. Ensure you have a dev/staging Firebase environment for testing
3. Back up your database before running any migrations

## Quick Setup (5 minutes)

### Step 1: Run Migration Script (Dry Run First)

```bash
# Install firebase-admin if not already installed
npm install firebase-admin

# Download your Firebase service account key
# 1. Go to Firebase Console > Project Settings > Service Accounts
# 2. Click "Generate New Private Key"
# 3. Save as scripts/serviceAccountKey.json

# Run dry run to see what would change
node scripts/addFormatField.js

# If everything looks good, execute the migration
node scripts/addFormatField.js --execute
```

### Step 2: Understanding the Data Model

**Before Best Ball:**
```javascript
{
  courseId: "abc123",
  playerId: "player1",
  groupId: "group789",
  roundType: "full",        // full, front9, back9
  scores: [4, 3, 5, ...],
  // ... other fields
}
```

**After Best Ball:**
```javascript
{
  courseId: "abc123",
  playerId: "player1",
  groupId: "group789",      // Players playing together
  roundType: "full",        // full, front9, back9
  format: "bestball",       // NEW: individual or bestball
  teamId: "team-aaa",       // NEW: scoring team (may differ from groupId)
  teamName: "Eagles",       // NEW: optional team name
  scores: [4, 3, 5, ...],
  // ... other fields
}
```

**Important:** `groupId` ≠ `teamId`
- **groupId**: Physical playing group (who's on the course together)
- **teamId**: Scoring team (who's competing together)
- Example: 4 players in one group can form 2 teams of 2

### Step 3: Key Concepts

**Format vs Round Type:**
- `roundType`: Controls which holes are played (full/front9/back9)
- `format`: Controls scoring method (individual/bestball)
- These are independent - you can play front9 in bestball format

**Common Scenarios:**

1. **Single Team (4 players, 1 team):**
   - All players: same `groupId`, same `teamId`
   - Team score = best of all 4 players on each hole
   
2. **Multiple Teams (4 players, 2 teams of 2):**
   - All players: same `groupId`
   - Team A players: `teamId = "team-aaa"`
   - Team B players: `teamId = "team-bbb"`
   - Team A score = best of Team A players
   - Team B score = best of Team B players

**Team Score Calculation:**
```javascript
// For each hole, team score = minimum of all team members' scores
// Single team example:
const teamScore = Math.min(
  player1.scores[holeIndex],
  player2.scores[holeIndex],
  player3.scores[holeIndex],
  player4.scores[holeIndex]
);

// Multiple teams example (Team A):
const teamAScore = Math.min(
  player1.scores[holeIndex],  // Team A
  player2.scores[holeIndex]   // Team A
);

const teamBScore = Math.min(
  player3.scores[holeIndex],  // Team B
  player4.scores[holeIndex]   // Team B
);
```

## Implementation Phases

### Phase 1: Add Format Field (1-2 hours)

**File:** `src/components/RoundStart.jsx`

```javascript
// Add state
const [format, setFormat] = useState('individual');
const [teams, setTeams] = useState([]);  // [{ id, name, players: [] }]

// Add UI (after Round Type selector)
<label>
  Format:
  <select 
    value={format}
    onChange={(e) => setFormat(e.target.value)}
  >
    <option value="individual">Individual</option>
    <option value="bestball">Best Ball</option>
  </select>
</label>

{/* Team Management for Best Ball */}
{format === 'bestball' && (
  <div className="team-management">
    <h3>Team Setup</h3>
    {teams.map((team) => (
      <div key={team.id} className="team-card">
        <input 
          placeholder="Team name"
          value={team.name}
          onChange={(e) => updateTeamName(team.id, e.target.value)}
        />
        {/* Players in this team */}
        {team.players.map(p => (
          <div key={p.playerId}>
            {p.name}
            <button onClick={() => removePlayerFromTeam(team.id, p.playerId)}>
              Remove
            </button>
          </div>
        ))}
        {/* Add player to this team */}
        <select onChange={(e) => addPlayerToTeam(team.id, e.target.value)}>
          <option value="">+ Add player</option>
          {getAvailablePlayers().map(p => (
            <option key={p.playerId} value={p.playerId}>{p.name}</option>
          ))}
        </select>
        <button onClick={() => removeTeam(team.id)}>Remove Team</button>
      </div>
    ))}
    <button onClick={addNewTeam}>+ Add Team</button>
  </div>
)}

// Helper functions
const addNewTeam = () => {
  const id = `team-${Date.now()}`;
  setTeams([...teams, { id, name: '', players: [] }]);
};

const addPlayerToTeam = (teamId, playerId) => {
  if (!playerId) return;
  const player = selectedPlayers.find(p => p.playerId === playerId);
  setTeams(teams.map(t => 
    t.id === teamId ? { ...t, players: [...t.players, player] } : t
  ));
};

const getAvailablePlayers = () => {
  const assigned = teams.flatMap(t => t.players.map(p => p.playerId));
  return selectedPlayers.filter(p => !assigned.includes(p.playerId));
};

// Update handleStartRound to include format and team info
await Promise.all(selectedPlayers.map(player => {
  // Find which team this player belongs to
  const team = teams.find(t => t.players.some(p => p.playerId === player.playerId));
  
  return addDoc(collection(db, "trips", selectedTrip.id, "scores"), {
    // ... existing fields ...
    format: format,
    teamId: team?.id || null,
    teamName: team?.name || `Team ${teams.indexOf(team) + 1}`,
  });
}));
```

**Test:** Start a round and verify `format`, `teamId`, and `teamName` fields are saved to Firestore

---

### Phase 2: Score Entry Display (2-3 hours)

**File:** `src/components/Hole.jsx`

```javascript
// Add helper function
const calculateTeamScore = (holeIndex) => {
  if (format !== 'bestball') return null;
  
  const scores = allScores
    .map(playerScores => playerScores[holeIndex])
    .filter(s => s > 0);
  
  return scores.length > 0 ? Math.min(...scores) : null;
};

// Add visual indicator
{format === 'bestball' && (
  <div className="team-score-display">
    <strong>Team Score: {calculateTeamScore(currentHole)}</strong>
  </div>
)}
```

**Test:** Play a best ball round and verify team score shows correctly

---

### Phase 3: Scorecard Display (3-4 hours)

**File:** `src/components/Scorecard.jsx`

```javascript
// Detect format from first score
const format = scorecardData[0]?.format || 'individual';

// Calculate team scores
const calculateTeamScores = (rounds) => {
  const teamScores = Array(18).fill(null);
  
  for (let hole = 0; hole < 18; hole++) {
    const holeScores = rounds
      .map(r => r.scores?.[hole])
      .filter(s => typeof s === 'number' && s > 0);
    
    if (holeScores.length > 0) {
      teamScores[hole] = Math.min(...holeScores);
    }
  }
  
  return teamScores;
};

// Add team row to table (after player rows)
{format === 'bestball' && (
  <tr className="team-row">
    <td><strong>Team</strong></td>
    {teamScores.map((score, idx) => (
      <td key={idx}>{score || '-'}</td>
    ))}
  </tr>
)}
```

**Test:** View scorecard for a completed best ball round

---

### Phase 4: Leaderboard (4-6 hours)

**File:** `src/components/Leaderboard.jsx`

This is the most complex phase. Key tasks:

1. Detect if any rounds are best ball format
2. Group players by teamId
3. Calculate team scores
4. Display team leaderboard
5. Add toggle between team/individual view

```javascript
// Group by teams
const calculateTeamLeaderboard = (rounds) => {
  const teams = {};
  
  rounds.forEach(round => {
    if (round.format !== 'bestball') return;
    
    const teamId = round.teamId || round.groupId;
    if (!teams[teamId]) {
      teams[teamId] = {
        teamId,
        teamName: round.teamName || `Team ${teamId.substring(0, 6)}`,
        players: [],
        teamScores: Array(18).fill(null)
      };
    }
    
    teams[teamId].players.push({
      playerId: round.playerId,
      playerName: round.playerName,
      scores: round.scores
    });
  });
  
  // Calculate best ball for each team
  Object.values(teams).forEach(team => {
    for (let hole = 0; hole < 18; hole++) {
      const holeScores = team.players
        .map(p => p.scores?.[hole])
        .filter(s => s > 0);
      
      if (holeScores.length > 0) {
        team.teamScores[hole] = Math.min(...holeScores);
      }
    }
  });
  
  return Object.values(teams);
};
```

**Test:** View leaderboard with best ball teams

---

## Common Patterns

### Safely Check Format
```javascript
const format = scoreDocument.format || 'individual';

if (format === 'bestball') {
  // Best ball specific logic
} else {
  // Individual logic (default)
}
```

### Calculate Team Score for Hole
```javascript
const getTeamScoreForHole = (teamPlayers, holeIndex) => {
  const scores = teamPlayers
    .map(player => player.scores?.[holeIndex])
    .filter(score => typeof score === 'number' && score > 0);
  
  return scores.length > 0 ? Math.min(...scores) : null;
};
```

### Identify Best Scorer
```javascript
const getBestScorer = (teamPlayers, holeIndex) => {
  const teamScore = getTeamScoreForHole(teamPlayers, holeIndex);
  if (!teamScore) return null;
  
  return teamPlayers.find(
    player => player.scores?.[holeIndex] === teamScore
  );
};
```

## Testing Checklist

### Unit Tests
- [ ] Team score calculation with 1 player (solo team)
- [ ] Team score calculation with 2 players (single team)
- [ ] Team score calculation with 4 players (single team)
- [ ] Multiple teams: 2 teams of 2 in same group
- [ ] Multiple teams: 2 teams of 1 in same group (solo teams)
- [ ] Team score with missing scores (one player has 0)
- [ ] Team leaderboard sorting with multiple teams
- [ ] Correct grouping by teamId (not groupId)
- [ ] Dynamic team addition/removal
- [ ] Player assignment validation (all players must be assigned)

### Integration Tests
- [ ] Start best ball round
- [ ] Enter scores for all players
- [ ] View scorecard
- [ ] View leaderboard
- [ ] Complete round and view summary

### Manual Tests
1. **Create Test Trip:**
   - Trip name: "Best Ball Test"
   - Add 4 players
   - Add 1 course (9 holes is fine for testing)

2. **Test Individual Round:**
   - Start individual round with 2 players
   - Complete all holes
   - Verify leaderboard shows individual scores

3. **Test Best Ball Round (Single Team):**
   - Start best ball round with 1 team
   - Add 2+ players to the team
   - Enter different scores for each player
   - Verify team score shows minimum
   - Complete round
   - Check scorecard shows team row
   - Check leaderboard shows team

4. **Test Best Ball Round (Multiple Teams):**
   - Start best ball round
   - Add Team 1, assign 2 players
   - Add Team 2, assign 2 players
   - Enter different scores for each player
   - Verify both team scores calculate correctly
   - Check scorecard shows both teams
   - Check leaderboard shows both teams ranked

5. **Test Best Ball Round (Solo Teams):**
   - Start best ball round
   - Add Team 1, assign 1 player
   - Add Team 2, assign 1 player
   - Each player is their own "team"
   - Useful for Nassau or match play variants

6. **Test Mixed Formats:**
   - Play 1 individual round
   - Play 1 best ball round
   - Verify leaderboard handles both
   - Check tournament view

## Debugging Tips

### Issue: Format field not saving
```javascript
// Check in handleStartRound
console.log('Saving with format:', format);

// Verify in Firestore console
// trips/{tripId}/scores/{scoreId}
// Should have format field
```

### Issue: Team score not calculating
```javascript
// Add logging to calculateTeamScore
const calculateTeamScore = (holeIndex) => {
  const scores = allScores.map(s => s[holeIndex]);
  console.log('Hole', holeIndex, 'scores:', scores);
  
  const validScores = scores.filter(s => s > 0);
  console.log('Valid scores:', validScores);
  
  const teamScore = Math.min(...validScores);
  console.log('Team score:', teamScore);
  
  return teamScore;
};
```

### Issue: Leaderboard not showing teams
```javascript
// Check if rounds have format field
console.log('Rounds:', rounds.map(r => ({
  player: r.playerName,
  format: r.format,
  teamId: r.teamId
})));

// Verify team grouping
console.log('Teams:', calculateTeamLeaderboard(rounds));
```

## CSS Quick Reference

Add these to `src/index.css`:

```css
/* Team score display during play */
.team-score-display {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 4px;
  text-align: center;
}

/* Best score indicator */
.best-score-indicator {
  color: #28a745;
  font-weight: bold;
}

/* Team row in scorecard */
.team-row {
  background: #e3f2fd;
  font-weight: bold;
  border-top: 2px solid #333;
}

/* Format toggle buttons */
.format-toggle button {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  background: white;
}

.format-toggle button.active {
  background: #007bff;
  color: white;
}
```

## Need Help?

1. **Read Full Plan:** [BESTBALL-IMPLEMENTATION-PLAN.md](./BESTBALL-IMPLEMENTATION-PLAN.md)
2. **Check Examples:** Look at how `roundType` is implemented (similar pattern)
3. **Test on Dev:** Always test on development environment first
4. **Backup Data:** Run migration script with dry run first

## Quick Commands

```bash
# Dry run migration
node scripts/addFormatField.js

# Execute migration
node scripts/addFormatField.js --execute

# Start dev server
npm run dev

# Check for errors
# Open browser console during testing
```

## Next Steps

After completing MVP implementation:

1. ✅ All 4 phases complete
2. ✅ All tests passing  
3. ✅ Documentation updated
4. 🚀 Deploy to staging
5. 🚀 User acceptance testing
6. 🚀 Deploy to production

---

**Questions?** Review the full implementation plan or check existing code patterns for `roundType` which follows similar architecture.
