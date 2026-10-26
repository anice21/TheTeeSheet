
import React, { useState, useEffect } from "react";
import Hole from "./Hole.jsx";
import { db } from "../firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { doc, getDoc } from "firebase/firestore";


function RoundStart({ currentUserID, currentHole, setCurrentHole, selectedCourse = null, setSelectedCourse = () => {}, roundStarted, setRoundStarted = () => {}, selectedPlayers = [], setSelectedPlayers = () => {}, isRoundFinished = false, setIsRoundFinished = () => {}, setView = () => {}, onSubmitRound = null, selectedTrip = null, roundType = 'full', setRoundType = () => {} }) {
    
    const [players, setPlayers] = useState([]);
    const [courses, setCourses] = useState([]);
    
    // Best Ball format state
    const [format, setFormat] = useState('individual'); // 'individual' or 'bestball'
    const [teams, setTeams] = useState([]); // [{ id, name, players: [] }]


    useEffect(() => {
        // Fetch rounds from the selected trip
        const fetchCourses = async () => {
            if (!selectedTrip) {
                setCourses([]);
                return;
            }
            
            // Get all rounds for this trip
            const tripRoundsSnapshot = await getDocs(collection(db, "trips", selectedTrip.id, "rounds"));
            const roundsData = tripRoundsSnapshot.docs.map(doc => ({
                ...doc.data(),
                roundId: doc.id,
                name: doc.data().courseName // Map courseName to name for compatibility
            }));
            
            console.log("Rounds for trip:", roundsData);
            setCourses(roundsData);
        };
        fetchCourses();
    }, [selectedTrip]);

    useEffect(() => {
        // Fetch players only after a course is selected and trip is selected
        const fetchPlayers = async () => {
            if (!selectedCourse || !selectedCourse.courseId || !selectedTrip) {
                setPlayers([]);
                return;
            }
            
            // Get players who are part of this trip (includes trip-specific handicap)
            const tripPlayersSnapshot = await getDocs(collection(db, "trips", selectedTrip.id, "players"));
            const tripPlayers = tripPlayersSnapshot.docs.map(doc => ({
                ...doc.data(),
                tripPlayerId: doc.id
            }));
            
            if (tripPlayers.length === 0) {
                setPlayers([]);
                return;
            }
            
            // Get only active players who are in the trip
            const playersSnapshot = await getDocs(collection(db, "players"));
            const allPlayers = playersSnapshot.docs
                .map(doc => ({ ...doc.data(), playerId: doc.id }))
                .filter(player => player.isActive === true && tripPlayers.some(tp => tp.playerId === player.playerId))
                .map(player => {
                    // Merge with trip player data to get trip-specific handicap
                    const tripPlayer = tripPlayers.find(tp => tp.playerId === player.playerId);
                    return {
                        ...player,
                        handicap: tripPlayer?.handicap ?? player.handicap
                    };
                });
            
            // Get all rounds for this course and trip round
            const roundsSnapshot = await getDocs(collection(db, "trips", selectedTrip.id, "scores"));
            const rounds = roundsSnapshot.docs.map(doc => doc.data());
            
            // Filter out players who already have a round for this specific trip round
            // Check both courseId and tripRoundID to allow same course multiple times in a trip
            const availablePlayers = allPlayers.filter(player => {
                return !rounds.some(round => 
                    round.courseId === selectedCourse.courseId && 
                    round.tripRoundID === selectedCourse.tripRoundID &&
                    round.playerId === player.playerId
                );
            });
            setPlayers(availablePlayers);
        };
        fetchPlayers();
    }, [selectedCourse, selectedTrip]);

    const addPlayer = () => {
        // create an empty slot for a player select; we'll store a player object here
        console.log("Selected Players:", selectedPlayers.length);
        if (selectedPlayers.length <= 3) {
            setSelectedPlayers((prev) => [...prev, null]);
        }
    };


    function handleSelectedCourse(e) {
        const roundId = e.target.value;
        const roundObj = courses.find(c => String(c.roundId) === String(roundId));
        
        // Fetch the full course data including pars
        if (roundObj && roundObj.courseId) {
            const fetchCourseDetails = async () => {
                try {
                    const courseDoc = await getDoc(doc(db, "courses", roundObj.courseId));
                    if (courseDoc.exists()) {
                        const fullCourseData = {
                            ...courseDoc.data(),
                            courseId: courseDoc.id,
                            tripRoundID: roundObj.tripRoundID,
                            roundId: roundObj.roundId,
                            name: roundObj.courseName || courseDoc.data().name
                        };
                        setSelectedCourse(fullCourseData);
                        console.log("Selected course changed to:", fullCourseData);
                    }
                } catch (err) {
                    console.error("Error fetching course details:", err);
                }
            };
            fetchCourseDetails();
        } else {
            setSelectedCourse(null);
        }
    }

    const selectPlayer = (index, e) => {
        const id = e.target.value;
        const playerObj = players.find((p) => p.playerId === id) || null;
        setSelectedPlayers((prev) => {
            const next = [...prev];
            next[index] = playerObj;
            return next;
        });
    };

    const removePlayer = (index) => {
        setSelectedPlayers((prev) => prev.filter((_, i) => i !== index));
    };

    // ===== BEST BALL TEAM MANAGEMENT FUNCTIONS =====
    
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
        // In Best Ball mode, use all players. In Individual mode, use selectedPlayers
        const playerPool = format === 'bestball' ? players : selectedPlayers;
        return playerPool.filter(p => p && !assignedPlayerIds.includes(p.playerId));
    };

    // Add player to a team
    const addPlayerToTeam = (teamId, playerId) => {
        if (!playerId) return;
        
        // In Best Ball mode, get from all players. In Individual mode, from selectedPlayers
        const playerPool = format === 'bestball' ? players : selectedPlayers;
        const player = playerPool.find(p => p && p.playerId === playerId);
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

    // Validate best ball setup
    const validateBestBall = () => {
        if (teams.length === 0) {
            return { valid: false, message: 'Please add at least one team' };
        }
        
        // Check for empty teams
        const emptyTeams = teams.filter(t => t.players.length === 0);
        if (emptyTeams.length > 0) {
            return { valid: false, message: 'All teams must have at least one player' };
        }
        
        // No need to check unassigned players in Best Ball mode since players are added directly to teams
        
        return { valid: true };
    };

    const sortedCourses = [...courses].sort((a, b) => {
        const aId = a.tripRoundID ?? '';
        const bId = b.tripRoundID ?? '';
        if (aId === bId) {
            return (a.name || '').localeCompare(b.name || '');
        }
        if (aId === '') return 1;
        if (bId === '') return -1;
        const aNum = Number(aId);
        const bNum = Number(bId);
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
            return aNum - bNum;
        }
        return String(aId).localeCompare(String(bId));
    });

    if (roundStarted) {
        // For Best Ball, get players from teams. For Individual, use selectedPlayers
        const playersForRound = format === 'bestball' 
            ? teams.flatMap(team => team.players)
            : selectedPlayers;
            
        return (
            <Hole
                course={selectedCourse}
                players={playersForRound}
                currentHole={currentHole}
                setCurrentHole={setCurrentHole}
                isRoundFinished={isRoundFinished}
                setIsRoundFinished={setIsRoundFinished}
                onSubmitRound={onSubmitRound ? onSubmitRound : () => setView('leaderboard')}
                selectedTrip={selectedTrip}
                roundType={roundType}
            />
        );
    }

    // Determine if there are any available players left to add
    const availablePlayersToAdd = players.filter(
        (p) => !selectedPlayers.some((sp) => sp && sp.playerId === p.playerId)
    );

    // Save round-player info to Firestore and start round
    const handleStartRound = async (e) => {
        e.preventDefault();
        if (!selectedTrip?.id) {
            console.error("No trip selected");
            return;
        }
        
        // Validate best ball format if selected
        if (format === 'bestball') {
            const validation = validateBestBall();
            if (!validation.valid) {
                alert(validation.message);
                return;
            }
        }
        
        // For Best Ball, build players list from teams. For Individual, use selectedPlayers
        const playersToSave = format === 'bestball' 
            ? teams.flatMap(team => team.players)
            : selectedPlayers;
        
        // Generate a random groupId for this group
        const groupId = Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
        
        // Build team assignments for best ball
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
        
        try {
            const promises = playersToSave.map(player => {
                if (!player || !player.playerId) return null;
                console.log("Player ID:", player.playerId);
                console.log("Current User ID:", currentUserID);
                
                const teamInfo = format === 'bestball' ? teamAssignments[player.playerId] : {};
                
                return addDoc(collection(db, "trips", selectedTrip.id, "scores"), {
                    courseId: selectedCourse.courseId,
                    courseName: selectedCourse.name || "Unnamed Course",
                    playerId: player.playerId,
                    playerName: player.name || "Unnamed Player",
                    playerHandicap: player.handicap !== undefined && player.handicap !== null ? Number(player.handicap) : null,
                    scoreKeeper: currentUserID === player.playerId ? true : false,
                    groupId: groupId,
                    isRoundFinished: false,
                    isActive: true,
                    tripRoundID: selectedCourse.tripRoundID || null,
                    roundType: roundType,
                    format: format, // NEW: 'individual' or 'bestball'
                    teamId: teamInfo.teamId || null, // NEW: team identifier
                    teamName: teamInfo.teamName || null, // NEW: team name
                    scores: Array(18).fill(0),
                    scoreToPar: Array(18).fill(0)
                });
            });
            await Promise.all(promises);
        } catch (err) {
            console.error("Error saving round-player info:", err);
        }
        setRoundStarted(true);
    };

    // Show message if no trip is selected
    if (!selectedTrip) {
        return (
            <div>
                <h1>Start a Round</h1>
                <p style={{ marginTop: 16, color: '#666' }}>
                    Please select a trip first to start a round. Go to the menu and choose "Select Trip".
                </p>
            </div>
        );
    }

    return (
        <div>
           <h1>{selectedTrip.name}</h1>
            <label>
                Pick a Course:
                <select className="select-dropdown" name="selectedCourse" value={selectedCourse ? selectedCourse.roundId : ""}
                    onChange={handleSelectedCourse}>
                    <option value="" disabled>Select a Course</option>
                    {sortedCourses.map((course) => (
                        <option key={String(course.roundId)} value={course.roundId}>
                            {course.tripRoundID ? `R${course.tripRoundID}: ` : ''}{course.name}
                        </option>
                    ))}
                </select>
            </label>

            <label>
                Round Type:
                <select 
                    className="select-dropdown" 
                    name="roundType" 
                    value={roundType}
                    onChange={(e) => setRoundType(e.target.value)}
                >
                    <option value="full">Full Round</option>
                    <option value="front9">Front 9</option>
                    <option value="back9">Back 9</option>
                </select>
            </label>

            <label>
                Format:
                <select 
                    className="select-dropdown" 
                    name="format" 
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                >
                    <option value="individual">Stroke</option>
                    <option value="bestball">Best Ball</option>
                </select>
            </label>

            {/* Only show regular player selection for individual format */}
            {format === 'individual' && (
                <label>
                    <div style={{ marginTop: 12 }}>
                        <strong>Players:</strong>

                        {selectedPlayers.length === 0 && (
                            <div style={{ marginTop: 8, marginBottom: 8, color: '#666' }}>No players added</div>
                        )}

                        {selectedPlayers.map((selected, idx) => {
                            // compute available players for this slot: exclude players selected in other slots
                            const available = players.filter((p) => !selectedPlayers.some((sp, i2) => i2 !== idx && sp && sp.playerId === p.playerId));

                            return (
                                <div key={idx} style={{ marginTop: 8, marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <select className="select-dropdown" value={selected ? selected.playerId : ""} onChange={(e) => selectPlayer(idx, e)}>
                                        <option value="" disabled>Select player</option>
                                        {available.map((p) => (
                                            <option key={String(p.playerId)} value={p.playerId}>{p.name}</option>
                                        ))}
                                    </select>
                                    <div className="add-remove-buttons">
                                        <button type="button" onClick={() => removePlayer(idx)}>Remove</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                </label>
            )}

            {/* Best Ball Team Management UI */}
            {format === 'bestball' && (
                <label>
                    <div style={{ marginTop: 12 }}>
                        <strong>Team Setup:</strong>

                        {teams.length === 0 && (
                            <div style={{ marginTop: 8, marginBottom: 8, color: '#666' }}>No teams added</div>
                        )}
                        
                        {/* Display existing teams */}
                        {teams.map((team, teamIdx) => (
                            <div key={team.id} style={{ marginTop: 12, marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <div style={{ fontSize: '0.95em', color: '#555', fontWeight: 600 }}>
                                        Team {teamIdx + 1}:
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => removeTeam(team.id)}
                                        style={{
                                            padding: '6px 12px',
                                            fontSize: '0.9em',
                                            color: 'white',
                                            backgroundColor: '#dc3545',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.3s'
                                        }}
                                        onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
                                        onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
                                    >
                                        Remove Team
                                    </button>
                                </div>
                                
                                    <div>
                                    <strong style={{ fontSize: '0.9em', color: '#666' }}>Players:</strong>
                                    {team.players.length === 0 && (
                                        <div style={{ marginTop: 4, marginBottom: 4, fontSize: '0.9em', color: '#999', fontStyle: 'italic' }}>No players added yet</div>
                                    )}
                                    
                                    {team.players.map((player, playerIdx) => (
                                        <div key={playerIdx} style={{ marginTop: 8, marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <span style={{ flex: 1 }}>{player.name}</span>
                                            <div className="add-remove-buttons">
                                                <button 
                                                    type="button"
                                                    onClick={() => removePlayerFromTeam(team.id, player.playerId)}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {/* Add Player dropdown for this team */}
                                    <div style={{ marginTop: 8 }}>
                                        <select
                                            className="select-dropdown"
                                            value=""
                                            onChange={(e) => addPlayerToTeam(team.id, e.target.value)}
                                            disabled={getAvailablePlayers().length === 0}
                                        >
                                            <option value="">Add player to team</option>
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
                    </div>
                    
                </label>
            )}

            <div className="round-start-actions">
                <div className="add-remove-buttons">
                    {format === 'individual' ? (
                        <button type="button" onClick={addPlayer} disabled={availablePlayersToAdd.length === 0}>
                            Add Player
                        </button>
                    ) : (
                        <button type="button" onClick={addNewTeam} disabled={teams.length >= 4}>
                            Add Team
                        </button>
                    )}
                </div>
                <div className="add-remove-buttons">
                    <button onClick={handleStartRound}
                        disabled={selectedCourse === null ||
                            !roundType ||
                            (format === 'individual' && (selectedPlayers.length === 0 || selectedPlayers.some(p => !p || !p.playerId))) ||
                            (format === 'bestball' && teams.length === 0)}>
                        Start Round
                    </button>
                </div>
            </div>
        </div>
    );
}

export default RoundStart;