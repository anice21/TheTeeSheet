
import React, { useState, useEffect } from "react";
import Hole from "./Hole.jsx";
import { db } from "../firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { doc, getDoc } from "firebase/firestore";


function RoundStart({ currentUserID, currentHole, setCurrentHole, selectedCourse = null, setSelectedCourse = () => {}, roundStarted, setRoundStarted = () => {}, selectedPlayers = [], setSelectedPlayers = () => {}, isRoundFinished = false, setIsRoundFinished = () => {}, setView = () => {}, onSubmitRound = null }) {
    
    const [players, setPlayers] = useState([]);
    const [courses, setCourses] = useState([]);

    useEffect(() => {
        // Fetch courses on mount
        const fetchCourses = async () => {
            const querySnapshot = await getDocs(collection(db, "courses"));
            const coursesData = querySnapshot.docs
                .map(doc => ({ ...doc.data(), courseId: doc.id }))
                .filter(course => course.isActive === true);
            console.log("All course information from Firestore:", coursesData);
            setCourses(coursesData);
        };
        fetchCourses();
    }, []);

    useEffect(() => {
        // Fetch players only after a course is selected
        const fetchPlayers = async () => {
            if (!selectedCourse || !selectedCourse.courseId) {
                setPlayers([]);
                return;
            }
            // Get only active players
            const playersSnapshot = await getDocs(collection(db, "players"));
            const allPlayers = playersSnapshot.docs
                .map(doc => ({ ...doc.data(), playerId: doc.id }))
                .filter(player => player.isActive === true);
            // Get all rounds for this course
            const roundsSnapshot = await getDocs(collection(db, "rounds"));
            const rounds = roundsSnapshot.docs.map(doc => doc.data());
            // Filter out players who already have a round for this course
            const availablePlayers = allPlayers.filter(player => {
                return !rounds.some(round => round.courseId === selectedCourse.courseId && round.playerId === player.playerId);
            });
            setPlayers(availablePlayers);
        };
        fetchPlayers();
    }, [selectedCourse]);

    const addPlayer = () => {
        // create an empty slot for a player select; we'll store a player object here
        console.log("Selected Players:", selectedPlayers.length);
        if (selectedPlayers.length <= 3) {
            setSelectedPlayers((prev) => [...prev, null]);
        }
    };


    function handleSelectedCourse(e) {
        const courseId = e.target.value;
        const courseObj = courses.find(c => String(c.courseId) === String(courseId));
        setSelectedCourse(courseObj || null);
        console.log("Selected course changed to:", courseObj);
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
        // Generate a random groupId for this group
        const groupId = Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
        try {
            const promises = selectedPlayers.map(player => {
                if (!player || !player.playerId) return null;
                console.log("Player ID:", player.playerId);
                console.log("Current User ID:", currentUserID);
                return addDoc(collection(db, "rounds"), {
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

    return (
        <div>
           <h1>Mesquite 2026</h1>
            <label>
                Pick a Course:
                <select className="select-dropdown" name="selectedCourse" value={selectedCourse ? selectedCourse.courseId : ""}
                    onChange={handleSelectedCourse}>
                    <option value="" disabled>Select a Course</option>
                    {courses.map((course) => (
                        <option key={String(course.courseId)} value={course.courseId}>
                            {course.name}
                        </option>
                    ))}
                </select>

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