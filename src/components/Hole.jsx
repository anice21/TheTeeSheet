import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import RoundSummary from "./RoundSummary.jsx";
import { calculateHoleScores, getFallbackHoleHandicaps } from "../utils/scoring/handicap";



function Hole({ course, players, currentHole: propCurrentHole, setCurrentHole: propSetCurrentHole, isRoundFinished, setIsRoundFinished, onSubmitRound, selectedTrip, roundType = 'full' }) {
    // State for format (individual or bestball)
    const [format, setFormat] = useState('individual');
    const [teamId, setTeamId] = useState(null);
    const [playerTeamIds, setPlayerTeamIds] = useState({});

    // Calculate start and end holes based on round type
    const getHoleRange = () => {
        switch (roundType) {
            case 'front9':
                return { startHole: 0, endHole: 8 }; // Holes 1-9
            case 'back9':
                return { startHole: 9, endHole: 17 }; // Holes 10-18
            case 'full':
            default:
                return { startHole: 0, endHole: 17 }; // Holes 1-18
        }
    };
    
    const { startHole, endHole } = getHoleRange();
    
    // support controlled `currentHole` passed from parent (App) or fall back to local state
    const [localCurrentHole, setLocalCurrentHole] = useState(startHole);
    const currentHole = typeof propCurrentHole === 'number' ? propCurrentHole : localCurrentHole;
    const setCurrentHole = typeof propSetCurrentHole === 'function' ? propSetCurrentHole : setLocalCurrentHole;

    // allScores: array of arrays, one per player, each with 18 holes
    const [allScores, setAllScores] = useState(() =>
        players.map((p) => {
            // Use player's scores if present, else fill with default
            return Array.from({ length: 18 }, (_, h) => getPlayerDefaultScore(p, h));
        })
    );

    // Initialize currentHole to startHole only if using local state and currentHole is outside the valid range
    useEffect(() => {
        if (typeof propCurrentHole !== 'number' && (localCurrentHole < startHole || localCurrentHole > endHole)) {
            setLocalCurrentHole(startHole);
        }
    }, [startHole, endHole, propCurrentHole, localCurrentHole]);

    // Constrain currentHole to valid range when using controlled mode
    useEffect(() => {
        if (typeof propCurrentHole === 'number' && typeof propSetCurrentHole === 'function') {
            if (propCurrentHole < startHole) {
                propSetCurrentHole(startHole);
            } else if (propCurrentHole > endHole) {
                propSetCurrentHole(endHole);
            }
        }
    }, [propCurrentHole, propSetCurrentHole, startHole, endHole]);

    // If players change (shouldn't mid-round), reset allScores and hydrate from Firestore
    useEffect(() => {
        let isMounted = true;

        const hydrateScores = async () => {
            if (!players || players.length === 0 || !course?.courseId) {
                if (isMounted) {
                    setAllScores(
                        players.map((p) => Array.from({ length: 18 }, (_, h) => getPlayerDefaultScore(p, h)))
                    );
                }
                return;
            }

            try {
                const fetchedScores = await Promise.all(
                    players.map(async (p) => {
                        if (!selectedTrip?.id) {
                            return Array.from({ length: 18 }, (_, h) => getPlayerDefaultScore(p, h));
                        }
                        
                        const constraints = [
                            where("courseId", "==", String(course.courseId)),
                            where("playerId", "==", String(p.playerId)),
                            where("isActive", "==", true)
                        ];
                        
                        if (course?.tripRoundID !== undefined && course?.tripRoundID !== null) {
                            constraints.push(where("tripRoundID", "==", course.tripRoundID));
                        }
                        
                        const q = query(
                            collection(db, "trips", selectedTrip.id, "scores"),
                            ...constraints
                        );
                        const querySnapshot = await getDocs(q);
                        if (querySnapshot.empty) {
                            return Array.from({ length: 18 }, (_, h) => getPlayerDefaultScore(p, h));
                        }
                        const roundData = querySnapshot.docs[0].data();
                        
                        // Set format and teamId from first player's data (all players in group share these)
                        if (isMounted && players.indexOf(p) === 0) {
                            setFormat(roundData.format || 'individual');
                            setTeamId(roundData.teamId || null);
                        }
                        if (isMounted && roundData.teamId) {
                            setPlayerTeamIds(prev => ({ ...prev, [p.playerId]: roundData.teamId }));
                        }
                        
                        if (Array.isArray(roundData.scores)) {
                            return roundData.scores.map((val, h) =>
                                typeof val === 'number' && val > 0
                                    ? val
                                    : (course?.pars?.[h] ?? 1)
                            );
                        }
                        return Array.from({ length: 18 }, (_, h) => getPlayerDefaultScore(p, h));
                    })
                );

                if (isMounted) {
                    setAllScores(fetchedScores);
                }
            } catch (err) {
                console.error("Error hydrating scores:", err);
                if (isMounted) {
                    setAllScores(
                        players.map((p) => Array.from({ length: 18 }, (_, h) => getPlayerDefaultScore(p, h)))
                    );
                }
            }
        };

        hydrateScores();

        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line
    }, [players, course?.courseId]);

    // If currentHole changes, nothing to do: allScores already has all holes

    function getPlayerDefaultScore(player, hole) {
        const saved = player.scores?.[hole];
        return (typeof saved !== 'undefined' && saved !== 0) ? saved : (course?.pars?.[hole] ?? 1);
    }

    const getPlayerTeamId = (player) => playerTeamIds[player?.playerId] || player?.teamId || 'all-players';

    const getTeamGroups = () => {
        if (format !== 'bestball') {
            return [{ id: 'all-players', name: null, players: players.map((player, index) => ({ player, index })) }];
        }

        const groups = new Map();
        players.forEach((player, index) => {
            const id = getPlayerTeamId(player);
            if (!groups.has(id)) {
                groups.set(id, { id, name: player?.teamName || null, players: [] });
            }
            groups.get(id).players.push({ player, index });
        });
        return Array.from(groups.values());
    };

    // Calculate a team's best score for a specific hole.
    const calculateTeamScore = (holeIndex, teamPlayers = players) => {
        if (format !== 'bestball') return null;
        
        const scores = teamPlayers.map(({ index }) => allScores[index][holeIndex]);
        const validScores = scores.filter(s => s > 0);
        
        if (validScores.length === 0) return null;
        return Math.min(...validScores);
    };

    const isBestScore = (playerIndex, holeIndex, teamPlayers = players) => {
        if (format !== 'bestball') return false;

        const teamScore = calculateTeamScore(holeIndex, teamPlayers);
        const playerScore = allScores[playerIndex][holeIndex];
        return teamScore !== null && playerScore === teamScore && playerScore > 0;
    };

    async function saveHoleScore(player, holeIndex, val) {
        if (!player?.playerId || !course?.courseId || !selectedTrip?.id) return;
        const par = course?.pars?.[holeIndex] ?? 0;
        const holeHandicaps = course?.holeHandicaps || getFallbackHoleHandicaps();
        const playerHandicap = Number.isFinite(Number(player.handicap)) ? Number(player.handicap) : 0;
        try {
            const constraints = [
                where("courseId", "==", String(course.courseId)),
                where("playerId", "==", String(player.playerId)),
                where("isActive", "==", true)
            ];
            
            if (course?.tripRoundID !== undefined && course?.tripRoundID !== null) {
                constraints.push(where("tripRoundID", "==", course.tripRoundID));
            }
            
            const q = query(
                collection(db, "trips", selectedTrip.id, "scores"),
                ...constraints
            );
            const querySnapshot = await getDocs(q);
            await Promise.all(querySnapshot.docs.map(async (docSnap) => {
                const docRef = docSnap.ref;
                const scores = docSnap.data().scores ? [...docSnap.data().scores] : Array(18).fill(0);
                scores[holeIndex] = val;
                const scoreToPar = docSnap.data().scoreToPar ? [...docSnap.data().scoreToPar] : Array(18).fill(0);
                scoreToPar[holeIndex] = val - par;
                const calculated = calculateHoleScores(scores, course?.pars, holeHandicaps, docSnap.data().playerHandicap ?? playerHandicap);
                await updateDoc(docRef, {
                    scores,
                    scoreToPar,
                    playerHandicap: docSnap.data().playerHandicap ?? playerHandicap,
                    netScores: calculated.netScores,
                    netScoreToPar: calculated.netScoreToPar,
                    strokesReceived: calculated.strokesReceived
                });
            }));
        } catch (err) {
            console.error("Error saving score in Firestore:", err);
        }
    }

    async function nextHole() {
        // Save the current hole's scores for all players to Firestore
        if (players && players.length) {
            await Promise.all(players.map(async (p, i) => {
                const val = allScores[i][currentHole];
                const par = course?.pars?.[currentHole] ?? 0;
                const holeHandicaps = course?.holeHandicaps || getFallbackHoleHandicaps();
                const playerHandicap = Number.isFinite(Number(p.handicap)) ? Number(p.handicap) : 0;
                if (!selectedTrip?.id) return;
                try {
                    const constraints = [
                        where("courseId", "==", String(course.courseId)),
                        where("playerId", "==", String(p.playerId)),
                        where("isActive", "==", true)
                    ];
                    
                    if (course?.tripRoundID !== undefined && course?.tripRoundID !== null) {
                        constraints.push(where("tripRoundID", "==", course.tripRoundID));
                    }
                    
                    const q = query(
                        collection(db, "trips", selectedTrip.id, "scores"),
                        ...constraints
                    );
                    const querySnapshot = await getDocs(q);
                    await Promise.all(querySnapshot.docs.map(async (docSnap) => {
                        const docRef = docSnap.ref;
                        // Get the full scores array from Firestore, update only the current hole
                        const scores = docSnap.data().scores ? [...docSnap.data().scores] : Array(18).fill(0);
                        scores[currentHole] = val;
                        // Update scoreToPar for this hole
                        const scoreToPar = docSnap.data().scoreToPar ? [...docSnap.data().scoreToPar] : Array(18).fill(0);
                        scoreToPar[currentHole] = val - par;
                        const calculated = calculateHoleScores(scores, course?.pars, holeHandicaps, docSnap.data().playerHandicap ?? playerHandicap);
                        await updateDoc(docRef, {
                            scores,
                            scoreToPar,
                            playerHandicap: docSnap.data().playerHandicap ?? playerHandicap,
                            netScores: calculated.netScores,
                            netScoreToPar: calculated.netScoreToPar,
                            strokesReceived: calculated.strokesReceived
                        });
                    }));
                } catch (err) {
                    console.error("Error updating score in Firestore:", err);
                }
            }));
        }
        // Advance to next hole
        if (currentHole < endHole) {
            setCurrentHole(currentHole + 1);
        } else {
            setIsRoundFinished(true);
        }
    }

    function prevHole() {
        if (currentHole > startHole) {
            setCurrentHole(currentHole - 1);
        }
    }

    async function handleEditRound() {
        // Fetch the actual roundType from Firestore to determine correct starting hole
        let correctStartHole = startHole;
        
        if (selectedTrip?.id && course?.courseId && players.length > 0) {
            try {
                const constraints = [
                    where("courseId", "==", String(course.courseId)),
                    where("isActive", "==", true)
                ];
                
                if (course?.tripRoundID !== undefined && course?.tripRoundID !== null) {
                    constraints.push(where("tripRoundID", "==", course.tripRoundID));
                }
                
                const q = query(
                    collection(db, "trips", selectedTrip.id, "scores"),
                    ...constraints
                );
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const roundData = querySnapshot.docs[0].data();
                    const actualRoundType = roundData.roundType || 'full';
                    
                    // Calculate correct startHole based on actual roundType
                    switch (actualRoundType) {
                        case 'front9':
                            correctStartHole = 0;
                            break;
                        case 'back9':
                            correctStartHole = 9;
                            break;
                        case 'full':
                        default:
                            correctStartHole = 0;
                            break;
                    }
                }
            } catch (err) {
                console.error("Error fetching roundType for edit:", err);
            }
        }
        
        setIsRoundFinished(false);
        setCurrentHole(correctStartHole);
    }

    if (isRoundFinished) {
        // Pass the scores to RoundSummary by cloning players and attaching scores
        const playersWithScores = players.map((p, i) => ({ ...p, scores: allScores[i] }));
        return (
            <RoundSummary
                players={playersWithScores}
                course={course}
                onEditRound={handleEditRound}
                onSubmitRound={onSubmitRound}
                selectedTrip={selectedTrip}
                tripRoundID={course?.tripRoundID}
                roundType={roundType}
            />
        );
    }

    return (
        <div>
            <div className="hole-header">
                <h1 className="hole-header-title">{course.name}</h1>
                <h2 className="hole-header-sub">Hole {currentHole + 1} Par {
                  course && Array.isArray(course.pars) && course.pars[currentHole] !== undefined
                    ? course.pars[currentHole]
                    : '-'
                }</h2>
            </div>
            <div>
                {(!players || players.length === 0) ? (
                    <div>No players</div>
                ) : (
                    getTeamGroups().map((group) => (
                        <section key={group.id} style={{ marginBottom: format === 'bestball' ? '1.25rem' : 0 }}>
                            <ul className="hole-player-list">
                                {group.players.map(({ player: p, index: i }) => (
                                    <li key={p.playerId || i} className="hole-player-list-item">
                                        <div className="hole-player-list-item-inner">
                                            <PlayerScoreDropdown
                                                player={p}
                                                value={allScores[i][currentHole]}
                                                isBestScore={isBestScore(i, currentHole, group.players)}
                                                onChange={(val) => {
                                                    setAllScores((prev) => {
                                                        const next = prev.map(arr => [...arr]);
                                                        next[i][currentHole] = val;
                                                        return next;
                                                    });
                                                    saveHoleScore(p, currentHole, val);
                                                }}
                                            />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            {format === 'bestball' && (
                                <div style={{ marginTop: '0.5rem', padding: '0.65rem', backgroundColor: '#f8f9fa', borderRadius: '6px', textAlign: 'center', border: '1px solid #28a745' }}>
                                    Team Score: <strong>{calculateTeamScore(currentHole, group.players) || '-'}</strong>
                                </div>
                            )}
                        </section>
                    ))
                )}
            </div>
            
            <div className="nav-buttons">
                <button onClick={prevHole} disabled={currentHole === startHole}> Previous Hole </button>
                <button onClick={nextHole}>
                    {currentHole === endHole ? "Finish Round" : "Next Hole"}
                </button>
            </div>
        </div>
    );
}

function PlayerScoreDropdown({ player, value, isBestScore, onChange }) {
    const handleChange = (e) => {
        const n = Number(e.target.value);
        onChange(n);
    };
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span className="player-name" style={{ 
                display: 'flex', 
                alignItems: 'center',
                fontSize: '1rem',
                fontWeight: isBestScore ? 'bold' : 'normal',
                color: isBestScore ? '#28a745' : '#000'
            }}>
                {player?.name || String(player)}
            </span>
            <select className="select-dropdown player-score-select" style={{ width: '25%', marginLeft: 'auto' }} value={value} onChange={handleChange}>
                {[...Array(10)].map((_, idx) => (
                    <option key={idx + 1} value={idx + 1}>{idx + 1}</option>
                ))}
            </select>
        </div>
    );
}

export default Hole;
