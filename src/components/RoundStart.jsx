
import React, { useState, useEffect } from "react";
import Hole from "./Hole.jsx";
import { db } from "../firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { doc, getDoc } from "firebase/firestore";


function RoundStart({ currentUserID, currentHole, setCurrentHole, selectedCourse = null, setSelectedCourse = () => {}, roundStarted, setRoundStarted = () => {}, selectedPlayers = [], setSelectedPlayers = () => {}, isRoundFinished = false, setIsRoundFinished = () => {}, setView = () => {}, onSubmitRound = null, selectedTrip = null }) {
    
    const [players, setPlayers] = useState([]);
    const [courses, setCourses] = useState([]);
    const [roundType, setRoundType] = useState('full');

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
        return (
            <Hole
                course={selectedCourse}
                players={selectedPlayers}
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
        // Generate a random groupId for this group
        const groupId = Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
        try {
            const promises = selectedPlayers.map(player => {
                if (!player || !player.playerId) return null;
                console.log("Player ID:", player.playerId);
                console.log("Current User ID:", currentUserID);
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

                <div className="add-remove-buttons">
                    <button type="button" onClick={addPlayer} disabled={availablePlayersToAdd.length === 0}>
                        Add Player
                    </button>
                    <button onClick={handleStartRound}
                        disabled={selectedCourse === null ||
                            !roundType ||
                            selectedPlayers.length === 0 ||
                            selectedPlayers.some(p => !p || !p.playerId)}>
                        Start Round
                    </button>
                </div>
            </label>
        </div>
    );
}

export default RoundStart;