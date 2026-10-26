# Best Ball Format - Implementation Plan

## Overview
This document outlines the implementation plan for adding **Best Ball** (also known as "Better Ball") format to the golf leaderboard application. Best Ball is a team format where 2 or more players play as a team, and on each hole, the team's score is the lowest score among all team members.

### Example
- Player A scores 4 on Hole 1
- Player B scores 5 on Hole 1  
- Player C scores 6 on Hole 1
- **Team Score = 4** (best score)

---

## Current System Architecture

### Data Structure (Firestore)
```
trips/{tripId}/
  └── scores/{scoreId}
      ├── courseId: string
      ├── courseName: string
      ├── playerId: string
      ├── playerName: string
      ├── playerHandicap: number
      ├── groupId: string           // Players who play together
      ├── tripRoundID: number        // Round number in trip
      ├── roundType: string          // 'full', 'front9', 'back9'
      ├── scores: number[]           // 18 holes
      ├── scoreToPar: number[]       // Score relative to par
      ├── isRoundFinished: boolean
      └── isActive: boolean
```

### Key Components
- **RoundStart.jsx** - Round setup and player selection
- **Hole.jsx** - Score entry during play
- **Scorecard.jsx** - View completed/in-progress scorecards
- **Leaderboard.jsx** - Display standings (live and tournament modes)
- **RoundSummary.jsx** - Show final round results

---

## Implementation Plan

### Phase 1: Data Model Updates

#### 1.1 Add Format Field to Score Documents
**Location:** `RoundStart.jsx` (handleStartRound function)

**Changes:**
- Add new field `format: string` to score documents
- Values: `'individual'` (default) or `'bestball'`
- This is separate from `roundType` (which controls full/front9/back9)

```javascript
// In handleStartRound function
const groupId = Math.random().toString(36).substring(2, 12) + Date.now().toString(36);

// For best ball, build team assignments from teams state
let teamAssignments = {};
if (format === 'bestball') {
  teams.forEach(team => {
    const teamId = team.id;
    const teamName = team.name || `Team ${teams.indexOf(team) + 1}`;
    
    team.players.forEach(player => {
      teamAssignments[player.playerId] = {
        teamId: teamId,
        teamName: teamName
      };
    });
  });
}

await Promise.all(selectedPlayers.map(player => {
  if (!player || !player.playerId) return null;
  
  const teamInfo = format === 'bestball' ? teamAssignments[player.playerId] : {};
  
  return addDoc(collection(db, "trips", selectedTrip.id, "scores"), {
    // ... existing fields ...
    groupId: groupId,
    format: format, // 'individual' or 'bestball'
    teamId: teamInfo.teamId || null,
    teamName: teamInfo.teamName || null,
    // ... existing fields ...
  });
}));
```

#### 1.2 Add Team Information
**Location:** Score documents

**New Fields:**
- `teamId: string` - Unique identifier for the team (required for bestball)
- `teamName: string` - Human-readable team name (optional, only for bestball)

**Important Distinction:**
- **`groupId`**: Identifies players who are playing together physically on the course (e.g., a foursome)
- **`teamId`**: Identifies players who are on the same team for scoring purposes

**Common Scenarios:**
1. **Single team per group** (e.g., 4 players, 1 team):
   - All 4 players have the same `groupId` and same `teamId`
   
2. **Multiple teams per group** (e.g., 4 players, 2 teams of 2):
   - All 4 players have the same `groupId`
   - Players 1 & 2 have `teamId = "team-abc123"`
   - Players 3 & 4 have `teamId = "team-def456"`

3. **Individual within team format** (e.g., 2 players, 2 teams of 1):
   - Both players have the same `groupId`
   - Player 1 has `teamId = "team-aaa"` (solo team)
   - Player 2 has `teamId = "team-bbb"` (solo team)
   - Useful for Nassau or other match play formats

This design supports flexible team composition from 1 to 4 players per team.

#### 1.3 Migration Strategy
- Default all existing records to `format: 'individual'`
- Add migration script to `scripts/` folder
- Existing data continues to work without changes

**File to create:** `scripts/addFormatField.js`

---

### Phase 2: UI Updates - Round Setup

#### 2.1 Add Format Selection to RoundStart
**Location:** `src/components/RoundStart.jsx`

**Changes:**
1. Add state for format selection:
```javascript
const [format, setFormat] = useState('individual'); // 'individual' or 'bestball'
```

2. Add UI dropdown after Round Type selector:
```jsx
<label>
  Format:
  <select 
    className="select-dropdown" 
    name="format" 
    value={format}
    onChange={(e) => setFormat(e.target.value)}
  >
    <option value="individual">Individual</option>
    <option value="bestball">Best Ball</option>
  </select>
</label>
```

3. Update player selection UI for best ball:
   - When format is 'bestball', show "Add Team" button interface
   - Support multiple teams per group
   - Allow 1 or more players per team
   - Dynamic team creation with player assignment

**New State for Team Management:**
```javascript
const [teams, setTeams] = useState([]);
// Structure: [{ id: 'team1', name: '', players: [] }]
```

**New UI Section for Best Ball:**

**Visual Flow:**
```
┌─────────────────────────────────────┐
│  Format: [Best Ball ▼]             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Team Setup                         │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ [Team Name Input  ] [Remove]  │ │
│  │                               │ │
│  │ Players:                      │ │
│  │  • Alice      [Remove]        │ │
│  │  • Bob        [Remove]        │ │
│  │                               │ │
│  │ [+ Add player ▼]              │ │
│  └───────────────────────────────┘ │
│                                     │
│  [+ Add Team]                       │
└─────────────────────────────────────┘
```

**Code Implementation:**
```jsx
{format === 'bestball' && (
  <div className="team-management">
    <h3>Team Setup</h3>
    
    {/* Display existing teams */}
    {teams.map((team, teamIdx) => (
      <div key={team.id} className="team-card">
        <div className="team-header">
          <input 
            type="text"
            placeholder={`Team ${teamIdx + 1} name (optional)`}
            value={team.name}
            onChange={(e) => updateTeamName(team.id, e.target.value)}
            className="team-name-input"
          />
          <button 
            type="button"
            onClick={() => removeTeam(team.id)}
            className="remove-team-btn"
          >
            Remove Team
          </button>
        </div>
        
        <div className="team-players">
          <strong>Players:</strong>
          {team.players.length === 0 && (
            <p className="no-players">No players added yet</p>
          )}
          
          {team.players.map((player, playerIdx) => (
            <div key={playerIdx} className="team-player-row">
              <span>{player.name}</span>
              <button 
                type="button"
                onClick={() => removePlayerFromTeam(team.id, player.playerId)}
                className="remove-player-btn"
              >
                Remove
              </button>
            </div>
          ))}
          
          {/* Add Player dropdown for this team */}
          <div className="add-player-section">
            <select
              value=""
              onChange={(e) => addPlayerToTeam(team.id, e.target.value)}
              className="add-player-select"
              disabled={getAvailablePlayers().length === 0}
            >
              <option value="">+ Add player to team</option>
              {getAvailablePlayers().map(player => (
                <option key={player.playerId} value={player.playerId}>
                  {player.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    ))}
    
    {/* Add Team button */}
    <button 
      type="button"
      onClick={addNewTeam}
      className="add-team-btn"
      disabled={teams.length >= 4}  // Max 4 teams (4 players max per group)
    >
      + Add Team
    </button>
    
    {teams.length === 0 && (
      <p className="no-teams-message">Click "Add Team" to create your first team</p>
    )}
  </div>
)}
```

**Supporting Functions:**
```javascript
// Add a new team
const addNewTeam = () => {
  const newTeamId = `team-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  setTeams([...teams, { id: newTeamId, name: '', players: [] }]);
};

// Remove a team
const removeTeam = (teamId) => {
  setTeams(teams.filter(t => t.id !== teamId));
};

// Update team name
const updateTeamName = (teamId, name) => {
  setTeams(teams.map(t => 
    t.id === teamId ? { ...t, name } : t
  ));
};

// Get players not yet assigned to any team
const getAvailablePlayers = () => {
  const assignedPlayerIds = teams.flatMap(t => t.players.map(p => p.playerId));
  return selectedPlayers.filter(p => !assignedPlayerIds.includes(p.playerId));
};

// Add player to a team
const addPlayerToTeam = (teamId, playerId) => {
  if (!playerId) return;
  
  const player = selectedPlayers.find(p => p.playerId === playerId);
  if (!player) return;
  
  setTeams(teams.map(t => 
    t.id === teamId 
      ? { ...t, players: [...t.players, player] }
      : t
  ));
};

// Remove player from a team
const removePlayerFromTeam = (teamId, playerId) => {
  setTeams(teams.map(t => 
    t.id === teamId
      ? { ...t, players: t.players.filter(p => p.playerId !== playerId) }
      : t
  ));
};
```

#### 2.2 Validation Rules

**User Workflow:**
1. User selects "Best Ball" format
2. User clicks "+ Add Team" button → creates empty team card
3. User (optionally) enters team name
4. User selects players from dropdown to add to this team (one at a time)
5. User can click "+ Add Team" again to create a second team
6. User assigns remaining players to second team
7. System validates all players are assigned before allowing "Start Round"

**Example Scenarios:**

*Scenario 1: Single Team of 4*
- Click "+ Add Team"
- Add all 4 players to Team 1
- Click "Start Round"

*Scenario 2: Two Teams of 2*
- Click "+ Add Team" → Team 1 created
- Add Player A and Player B to Team 1
- Click "+ Add Team" → Team 2 created
- Add Player C and Player D to Team 2
- Click "Start Round"

*Scenario 3: Nassau (Two Solo Teams)*
- Click "+ Add Team" → Team 1 created
- Add Player A to Team 1
- Click "+ Add Team" → Team 2 created
- Add Player B to Team 2
- Click "Start Round"

---

#### 2.3 Validation Rules
- Individual format: 1-4 players allowed
- Best ball format: 
  - Minimum 1 team required
  - Minimum 1 player per team (allows solo "teams" for mixed formats)
  - All selected players must be assigned to a team
  - Maximum 4 players total per group (course pace of play)
  - Cannot start round with empty teams (teams with 0 players)
- Show appropriate error messages for validation failures

**Validation Logic:**
```javascript
const validateBestBall = () => {
  if (teams.length === 0) {
    return { valid: false, message: 'Please add at least one team' };
  }
  
  // Check for empty teams
  const emptyTeams = teams.filter(t => t.players.length === 0);
  if (emptyTeams.length > 0) {
    return { valid: false, message: 'All teams must have at least one player' };
  }
  
  // Check if all selected players are assigned
  const assignedPlayerIds = teams.flatMap(t => t.players.map(p => p.playerId));
  const unassignedPlayers = selectedPlayers.filter(
    p => !assignedPlayerIds.includes(p.playerId)
  );
  
  if (unassignedPlayers.length > 0) {
    return { 
      valid: false, 
      message: `${unassignedPlayers.length} player(s) not assigned to any team` 
    };
  }
  
  return { valid: true };
};
```

---

### Phase 3: Scoring Display Updates

#### 3.1 Update Hole.jsx Score Entry
**Location:** `src/components/Hole.jsx`

**Changes:**
1. Detect if current round is best ball format
2. Display team score indicator after all players enter scores
3. Show which player's score is counting for the team

**Visual Design:**
```
Hole 5 - Par 4

Player A: [5]  ← Best score indicator
Player B: [6]
Player C: [5]  ← Best score indicator (tied)
Player D: [7]

Team Score: 5 (to par: +1)
```

**Implementation:**
```javascript
// Add function to calculate team score for current hole
const calculateTeamScore = (holeIndex) => {
  if (format !== 'bestball') return null;
  
  const scores = allScores.map(playerScores => playerScores[holeIndex]);
  const validScores = scores.filter(s => s > 0);
  
  if (validScores.length === 0) return null;
  return Math.min(...validScores);
};

// Add visual indicator for best score
const isBestScore = (playerIndex, holeIndex) => {
  if (format !== 'bestball') return false;
  
  const teamScore = calculateTeamScore(holeIndex);
  const playerScore = allScores[playerIndex][holeIndex];
  
  return playerScore === teamScore;
};
```

**UI Addition:**
```jsx
{format === 'bestball' && (
  <div className="team-score-display">
    <strong>Team Score: {calculateTeamScore(currentHole)}</strong>
    <span> (to par: {calculateTeamScore(currentHole) - (course?.pars?.[currentHole] ?? 0)})</span>
  </div>
)}
```

#### 3.2 Update Scorecard.jsx Display
**Location:** `src/components/Scorecard.jsx`

**Changes:**
1. Detect best ball format from score documents
2. Add team score row below individual player rows
3. Highlight which player's score is used for each hole

**Table Structure for Best Ball:**
```
| Hole  | 1 | 2 | 3 | ... | Out | Total |
|-------|---|---|---|-----|-----|-------|
| Par   | 4 | 3 | 5 | ... | 36  | 72    |
| Alice | 4*| 4 | 6 | ... | 38  | 78    |
| Bob   | 5 | 3*| 5*| ... | 36  | 74    |
| Team  | 4 | 3 | 5 | ... | 36  | 74    |
```
*indicates best score used

**Implementation:**
```javascript
// Function to calculate team scores for all holes
const calculateTeamScores = (roundsData) => {
  if (!roundsData || roundsData.length === 0) return null;
  if (roundsData[0].format !== 'bestball') return null;
  
  const teamScores = Array(18).fill(null);
  
  for (let hole = 0; hole < 18; hole++) {
    const holeScores = roundsData
      .map(round => round.scores?.[hole])
      .filter(score => typeof score === 'number' && score > 0);
    
    if (holeScores.length > 0) {
      teamScores[hole] = Math.min(...holeScores);
    }
  }
  
  return teamScores;
};
```

---

### Phase 4: Leaderboard Updates

#### 4.1 Detect and Display Best Ball Rounds
**Location:** `src/components/Leaderboard.jsx`

**Changes:**
1. Group players by teamId for best ball rounds
2. Calculate team scores (best score per hole)
3. Display team standings when rounds are best ball format
4. Show individual standings when rounds are individual format

**New State:**
```javascript
const [viewMode, setViewMode] = useState('default'); // 'default', 'team', 'individual'
```

**Team Score Calculation:**
```javascript
const calculateTeamLeaderboard = (rounds) => {
  // IMPORTANT: Group by teamId, NOT groupId
  // A group can contain multiple teams (e.g., 4 players, 2 teams of 2)
  const teams = {};
  
  rounds.forEach(round => {
    if (round.format !== 'bestball') return;
    
    const teamId = round.teamId;  // Use teamId for grouping
    if (!teamId) return;  // Skip if no team assigned
    
    if (!teams[teamId]) {
      teams[teamId] = {
        teamId,
        teamName: round.teamName || `Team ${teamId.substring(0, 6)}`,
        groupId: round.groupId,  // Store for reference
        players: [],
        teamScores: Array(18).fill(null),
        teamScoreToPar: 0
      };
    }
    
    teams[teamId].players.push({
      playerId: round.playerId,
      playerName: round.playerName,
      scores: round.scores,
      scoreToPar: round.scoreToPar
    });
  });
  
  // Calculate best ball scores for each team
  Object.values(teams).forEach(team => {
    for (let hole = 0; hole < 18; hole++) {
      const holeScores = team.players
        .map(p => p.scores?.[hole])
        .filter(s => typeof s === 'number' && s > 0);
      
      if (holeScores.length > 0) {
        team.teamScores[hole] = Math.min(...holeScores);
      }
    }
    
    // Calculate total score to par
    team.teamScoreToPar = team.teamScores.reduce((sum, score, idx) => {
      if (score === null) return sum;
      const par = selectedCourse?.pars?.[idx] ?? 0;
      return sum + (score - par);
    }, 0);
  });
  
  return Object.values(teams).sort((a, b) => a.teamScoreToPar - b.teamScoreToPar);
};
```

**UI Addition:**
```jsx
{/* Team Leaderboard Table - shown automatically for best ball rounds */}
{hasBestBallRounds && (
  <table className="leaderboard-table">
    <thead>
      <tr>
        <th>Rank</th>
        <th>Team</th>
        <th>Players</th>
        <th>Score</th>
        <th>To Par</th>
      </tr>
    </thead>
    <tbody>
      {teamLeaderboard.map((team, idx) => (
        <tr key={team.teamId}>
          <td>{idx + 1}</td>
          <td>{team.teamName}</td>
          <td>{team.players.map(p => p.playerName).join(', ')}</td>
          <td>{team.teamScores.reduce((sum, s) => sum + (s || 0), 0)}</td>
          <td>{formatScoreToPar(team.teamScoreToPar)}</td>
        </tr>
      ))}
    </tbody>
  </table>
)}
```

#### 4.2 Tournament Mode Updates
**Changes:**
- Support mixed format tournaments (some rounds individual, some best ball)
- Show appropriate leaderboard based on round format

---

### Phase 5: Round Summary Updates

#### 5.1 Update RoundSummary.jsx
**Location:** `src/components/RoundSummary.jsx`

**Changes:**
1. Display team summary for best ball rounds
2. Show both individual and team scores
3. Highlight team performance

**New Section:**
```jsx
{format === 'bestball' && (
  <div className="team-summary">
    <h3>Team Score: {teamTotal}</h3>
    <p>Team Score to Par: {formatScoreToPar(teamScoreToPar)}</p>
    
    <h4>Team Performance by Hole</h4>
    <div className="team-hole-breakdown">
      {/* Show which player's score counted for each hole */}
      {Array.from({ length: 18 }, (_, i) => (
        <div key={i}>
          Hole {i + 1}: {teamScores[i]} 
          (by {getBestScorer(i)})
        </div>
      ))}
    </div>
    
    <h4>Individual Contributions</h4>
    <div className="individual-contributions">
      {players.map(player => (
        <div key={player.playerId}>
          <strong>{player.playerName}</strong>
          <p>Holes Won: {countHolesWon(player, i)}</p>
          <p>Individual Total: {calculatePlayerTotal(player)}</p>
        </div>
      ))}
    </div>
  </div>
)}
```

---

### Phase 6: CSS Styling

#### 6.1 New CSS Classes
**Location:** `src/index.css`

**Add:**
```css
/* Best Ball Format Styles */
.format-toggle {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.format-toggle button {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  background: white;
  cursor: pointer;
}

.format-toggle button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

/* Team Management UI */
.team-management {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.team-card {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.team-header {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.team-name-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 1rem;
}

.remove-team-btn {
  padding: 0.5rem 1rem;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.remove-team-btn:hover {
  background: #c82333;
}

.team-players {
  margin-top: 0.5rem;
}

.team-player-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.remove-player-btn {
  padding: 0.25rem 0.75rem;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.remove-player-btn:hover {
  background: #5a6268;
}

.add-player-section {
  margin-top: 0.75rem;
}

.add-player-select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.add-player-select:disabled {
  background: #e9ecef;
  cursor: not-allowed;
}

.add-team-btn {
  width: 100%;
  padding: 0.75rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  margin-top: 0.5rem;
}

.add-team-btn:hover {
  background: #218838;
}

.add-team-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.no-teams-message,
.no-players {
  color: #6c757d;
  font-style: italic;
  margin: 0.5rem 0;
}

/* During Play */
.team-score-display {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 4px;
  text-align: center;
  font-size: 1.1rem;
}

/* Round Summary */
.team-summary {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #e3f2fd;
  border-radius: 8px;
}

.best-score-indicator {
  color: #28a745;
  font-weight: bold;
}

.best-score-indicator::before {
  content: "⭐ ";
}

.team-hole-breakdown {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.5rem;
  margin-top: 1rem;
}

.individual-contributions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .team-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .team-name-input {
    margin-bottom: 0.5rem;
  }
  
  .team-player-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .remove-player-btn,
  .remove-team-btn {
    width: 100%;
  }
}
```

---

### Phase 7: Migration and Backward Compatibility

#### 7.1 Data Migration Script
**File:** `scripts/addFormatField.js`

**Purpose:**
- Add `format: 'individual'` to all existing score documents
- Can be run safely on production data

**Content:**
```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateFormatField() {
  console.log('Starting format field migration...');
  
  // Get all trips
  const tripsSnapshot = await db.collection('trips').get();
  
  let updatedCount = 0;
  
  for (const tripDoc of tripsSnapshot.docs) {
    console.log(`Processing trip: ${tripDoc.id}`);
    
    // Get all scores for this trip
    const scoresSnapshot = await db
      .collection('trips')
      .doc(tripDoc.id)
      .collection('scores')
      .get();
    
    const batch = db.batch();
    let batchCount = 0;
    
    for (const scoreDoc of scoresSnapshot.docs) {
      const data = scoreDoc.data();
      
      // Only update if format field doesn't exist
      if (!data.format) {
        batch.update(scoreDoc.ref, { format: 'individual' });
        batchCount++;
        updatedCount++;
        
        // Commit batch every 500 documents
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`  Committed ${batchCount} updates`);
          batchCount = 0;
        }
      }
    }
    
    // Commit remaining updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`  Committed ${batchCount} updates`);
    }
  }
  
  console.log(`Migration complete. Updated ${updatedCount} documents.`);
}

migrateFormatField()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
```

**Usage:**
```bash
node scripts/addFormatField.js
```

#### 7.2 Backward Compatibility Measures
1. **Default format:** All components assume `format: 'individual'` if field is missing
2. **Conditional rendering:** Best ball UI only shows when `format === 'bestball'`
3. **Graceful degradation:** If format field missing, show as individual round
4. **Safe queries:** Filter by format field with fallback logic

**Example:**
```javascript
// Safe format check with fallback
const format = round.format || 'individual';

// Only show best ball features when explicitly set
if (format === 'bestball') {
  // render best ball UI
} else {
  // render individual UI (default)
}
```

---

### Phase 8: Testing Strategy

#### 8.1 Unit Tests
- [ ] Test team score calculation logic
- [ ] Test best score identification for each hole
- [ ] Test team leaderboard sorting
- [ ] Test format field validation

#### 8.2 Integration Tests
- [ ] Start a best ball round with 1 player (solo team)
- [ ] Start a best ball round with 2 players (single team)
- [ ] Start a best ball round with 4 players (single team)
- [ ] Start a best ball round with 4 players (2 teams of 2)
- [ ] Start a best ball round with 2 players (2 teams of 1 each - solo teams)
- [ ] Add/remove teams dynamically before starting round
- [ ] Add/remove players from teams before starting round
- [ ] Enter scores and verify team score calculation (single team)
- [ ] Enter scores and verify team score calculation (multiple teams)
- [ ] View scorecard for best ball round with multiple teams
- [ ] View leaderboard with multiple best ball teams from same group
- [ ] Mix individual and best ball rounds in tournament
- [ ] Validate that all players must be assigned to teams

#### 8.3 Edge Cases
- [ ] What if a player has 0 scores entered? (Use other team member's score, or 0 if solo team)
- [ ] What if all players on a team have 0 for a hole? (Show 0 for team)
- [ ] Solo team (1 player) - team score equals player score
- [ ] Switching between team/individual view on leaderboard
- [ ] Front9/Back9 rounds in best ball format
- [ ] Unfinished best ball rounds
- [ ] Multiple teams from same group in leaderboard
- [ ] Empty teams (teams with 0 players - should be prevented by validation)
- [ ] Unassigned players (should be prevented by validation)
- [ ] Editing team assignments after round started (not allowed)
- [ ] Removing a team with players assigned (should remove assignments)
- [ ] Maximum teams per group (4 teams max for 4 players)

#### 8.4 Manual Testing Checklist
- [ ] Create new trip
- [ ] Add 3 rounds (1 individual, 2 best ball)
- [ ] Play individual round completely
- [ ] Play best ball round with 1 player solo team (edge case)
- [ ] Play best ball round with 2 players (single team)
- [ ] Play best ball round with 4 players (single team)
- [ ] Play best ball round with 4 players (2 teams of 2)
- [ ] Play best ball round with 2 players (2 solo teams of 1 each)
- [ ] Test dynamic team creation UI (add/remove teams)
- [ ] Test dynamic player assignment (add/remove players from teams)
- [ ] View scorecard for all rounds
- [ ] View leaderboard in all modes
- [ ] Verify tournament standings with mixed formats
- [ ] Verify multiple teams from same group appear correctly
- [ ] Test on mobile devices
- [ ] Test with poor network connection

---

### Phase 9: Documentation

#### 9.1 User Documentation
**Create:** `BESTBALL-USER-GUIDE.md`

**Contents:**
- What is Best Ball format?
- How to start a Best Ball round
- How scoring works
- How to view team standings
- FAQ section

#### 9.2 Code Documentation
- Add JSDoc comments to all new functions
- Document data structure changes
- Add inline comments for complex logic

#### 9.3 Update Existing Docs
- Update README.md with Best Ball feature
- Add to IMPLEMENTATION-SUMMARY.md

---

## Implementation Timeline

### Week 1: Foundation
- [x] Create implementation plan (this document)
- [ ] Phase 1: Data model updates (2 hours)
- [ ] Phase 7.1: Create migration script (1 hour)
- [ ] Run migration on dev environment (1 hour)

### Week 2: Core Features
- [ ] Phase 2: Round setup UI (4 hours)
- [ ] Phase 3.1: Score entry updates (3 hours)
- [ ] Basic testing (2 hours)

### Week 3: Display Features
- [ ] Phase 3.2: Scorecard updates (4 hours)
- [ ] Phase 4: Leaderboard updates (6 hours)
- [ ] Phase 5: Round summary updates (3 hours)

### Week 4: Polish & Testing
- [ ] Phase 6: CSS styling (2 hours)
- [ ] Phase 8: Comprehensive testing (8 hours)
- [ ] Phase 9: Documentation (3 hours)
- [ ] Bug fixes and refinements (4 hours)

**Total Estimated Time:** 43 hours

---

## Potential Enhancements (Future)

### Phase 10: Advanced Features (Optional)
1. **Dynamic team sizes**
   - Support teams of 3 players
   - Support uneven team sizes (2 vs 3)
   - Handicap adjustments for uneven teams

2. **Best Ball Net Score**
   - Apply handicaps to individual scores first
   - Then calculate best net score

3. **Modified Best Ball Formats**
   - 2 best balls (use 2 lowest scores)
   - Best ball with alternate shot
   - Chapman (scramble off tee, then best ball)

4. **Team Handicap System**
   - Calculate team handicap from individual handicaps
   - Apply to final team score

5. **Statistics Tracking**
   - Track which player contributes most holes
   - Analyze scoring patterns
   - Show contribution percentages

6. **Live Team Updates**
   - Real-time team standings during play
   - Push notifications when team standing changes

---

## Database Schema Changes Summary

### Before (Current)
```javascript
{
  courseId: "course123",
  playerId: "player456",
  groupId: "abc789",
  roundType: "full",
  scores: [4, 3, 5, ...],
  scoreToPar: [0, -1, 0, ...],
  // ... other fields
}
```

### After (With Best Ball)
```javascript
// Example 1: Single team (all 4 players on one team)
{
  courseId: "course123",
  playerId: "player1",
  groupId: "abc789",       // All 4 players share this
  roundType: "full",
  format: "bestball",      // NEW
  teamId: "team-xyz",      // NEW: All 4 players share this
  teamName: "Eagles",      // NEW
  scores: [4, 3, 5, ...],
  // ... other fields
}

// Example 2: Multiple teams (2 teams of 2 in same group)
// Player 1 (Team A):
{
  courseId: "course123",
  playerId: "player1",
  groupId: "abc789",       // Same for all 4 players
  roundType: "full",
  format: "bestball",
  teamId: "team-aaa",      // Team A
  teamName: "Eagles",
  scores: [4, 3, 5, ...],
}

// Player 2 (Team A):
{
  courseId: "course123",
  playerId: "player2",
  groupId: "abc789",       // Same for all 4 players
  roundType: "full",
  format: "bestball",
  teamId: "team-aaa",      // Team A (same as player1)
  teamName: "Eagles",
  scores: [5, 4, 6, ...],
}

// Player 3 (Team B):
{
  courseId: "course123",
  playerId: "player3",
  groupId: "abc789",       // Same for all 4 players
  roundType: "full",
  format: "bestball",
  teamId: "team-bbb",      // Team B (different)
  teamName: "Birdies",
  scores: [4, 5, 4, ...],
}

// Player 4 (Team B):
{
  courseId: "course123",
  playerId: "player4",
  groupId: "abc789",       // Same for all 4 players
  roundType: "full",
  format: "bestball",
  teamId: "team-bbb",      // Team B (same as player3)
  teamName: "Birdies",
  scores: [6, 4, 5, ...],
}
```

**Team Scoring:**
- **Team A (Eagles)**: Takes best of player1 and player2 on each hole
  - Hole 1: min(4, 5) = 4
  - Hole 2: min(3, 4) = 3
  - Hole 3: min(5, 6) = 5
  
- **Team B (Birdies)**: Takes best of player3 and player4 on each hole
  - Hole 1: min(4, 6) = 4
  - Hole 2: min(5, 4) = 4
  - Hole 3: min(4, 5) = 4

---

## Files to Create/Modify

### New Files
- [ ] `scripts/addFormatField.js` - Migration script
- [ ] `BESTBALL-USER-GUIDE.md` - User documentation
- [ ] `BESTBALL-IMPLEMENTATION-PLAN.md` - This file

### Modified Files
- [ ] `src/components/RoundStart.jsx` - Add format selection
- [ ] `src/components/Hole.jsx` - Add team score display
- [ ] `src/components/Scorecard.jsx` - Add team scoring row
- [ ] `src/components/Leaderboard.jsx` - Add team leaderboard
- [ ] `src/components/RoundSummary.jsx` - Add team summary
- [ ] `src/index.css` - Add best ball styles
- [ ] `README.md` - Update with best ball feature
- [ ] `IMPLEMENTATION-SUMMARY.md` - Add best ball implementation

---

## Questions & Decisions

### Resolved
1. **Q:** Should best ball be a separate round type or format?  
   **A:** It's a format (separate from roundType which controls full/front9/back9)

2. **Q:** Can we have multiple teams in same group?  
   **A:** Yes! A group of 4 players can be split into 2 teams of 2. Use `groupId` for the playing group and `teamId` for scoring teams.

3. **Q:** How to handle team names?  
   **A:** Optional field, defaults to "Team [teamId prefix]" if not provided

4. **Q:** Should groupId and teamId be the same?  
   **A:** No. They serve different purposes:
   - `groupId`: Physical playing group (who's playing together)
   - `teamId`: Scoring team (who's competing together)

### Open Questions
1. **Q:** Should we allow viewing individual scores in leaderboard for best ball rounds?  
   **A:** Yes, provide toggle between team view and individual view

2. **Q:** How to handle handicaps in best ball?  
   **A:** For v1, track individual handicaps but don't apply to team score. Consider for future enhancement.

3. **Q:** Should net best ball be separate format or option?  
   **A:** Defer to future enhancement

---

## Success Criteria

### MVP (Minimum Viable Product)
- ✅ Users can select "Best Ball" format when starting a round
- ✅ Users can assign players to teams (single team or multiple teams)
- ✅ Support multiple teams within same playing group (e.g., 2 teams of 2)
- ✅ System calculates and displays team score (best score per hole)
- ✅ Scorecard shows individual scores with team score rows
- ✅ Leaderboard shows team standings for all teams
- ✅ All existing individual rounds continue to work

### Nice to Have
- Team statistics (who contributed most holes)
- Historical team performance tracking
- Advanced handicap calculations
- Uneven team sizes (2 vs 3 players)

---

## Risk Assessment

### Low Risk
- Data migration (simple field addition)
- UI changes (additive, not breaking)
- Backward compatibility (defaults in place)

### Medium Risk
- Leaderboard complexity (mixing formats)
- Score calculation bugs (need thorough testing)
- Mobile responsiveness (new UI elements)

### Mitigation Strategies
1. Extensive unit testing of calculation logic
2. Manual testing on multiple devices
3. Phased rollout (dev → staging → production)
4. Feature flag for gradual enablement
5. Database backup before migration

---

## Conclusion

This implementation plan provides a comprehensive roadmap for adding Best Ball format to the golf leaderboard application. The design maintains backward compatibility, follows existing architectural patterns, and can be implemented incrementally over 4 weeks.

**Key Benefits:**
- ✅ Minimal data model changes
- ✅ Backward compatible with existing data
- ✅ Follows existing code patterns
- ✅ Extensible for future formats
- ✅ Clear testing strategy
- ✅ Comprehensive documentation

**Next Steps:**
1. Review and approve this plan
2. Set up development environment
3. Run migration script on dev database
4. Begin Phase 1 implementation
5. Iterate through phases with regular testing

---

*Document Version: 1.0*  
*Created: 2026-08-18*  
*Last Updated: 2026-08-18*
