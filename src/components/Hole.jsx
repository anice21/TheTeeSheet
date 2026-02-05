import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import RoundSummary from "./RoundSummary.jsx";



function Hole({ course, players, currentHole: propCurrentHole, setCurrentHole: propSetCurrentHole, isRoundFinished, setIsRoundFinished, onSubmitRound }) {
    // support controlled `currentHole` passed from parent (App) or fall back to local state
    const [localCurrentHole, setLocalCurrentHole] = useState(0);
    const currentHole = typeof propCurrentHole === 'number' ? propCurrentHole : localCurrentHole;
    const setCurrentHole = typeof propSetCurrentHole === 'function' ? propSetCurrentHole : setLocalCurrentHole;

    // allScores: array of arrays, one per player, each with 18 holes
    const [allScores, setAllScores] = useState(() =>
        players.map((p) => {
            // Use player's scores if present, else fill with default
            return Array.from({ length: 18 }, (_, h) => getPlayerDefaultScore(p, h));
        })
    );

    // If players change (shouldn't mid-round), reset allScores
    useEffect(() => {
        setAllScores(
            players.map((p) => Array.from({ length: 18 }, (_, h) => getPlayerDefaultScore(p, h)))
        );
        // eslint-disable-next-line
    }, [players]);

    // If currentHole changes, nothing to do: allScores already has all holes

    function getPlayerDefaultScore(player, hole) {
        const saved = player.scores?.[hole];
        return (typeof saved !== 'undefined' && saved !== 0) ? saved : (course?.pars?.[hole] ?? 1);
    }

    async function nextHole() {
        // Save the current hole's scores for all players to Firestore
        if (players && players.length) {
            await Promise.all(players.map(async (p, i) => {
                const val = allScores[i][currentHole];
                const par = course?.pars?.[currentHole] ?? 0;
                try {
                    const q = query(
                        collection(db, "rounds"),
                        where("courseId", "==", String(course.courseId)),
                        where("playerId", "==", String(p.playerId))
                    );
                    const querySnapshot = await getDocs(q);
                    querySnapshot.forEach(async (docSnap) => {
                        const docRef = docSnap.ref;
                        // Get the full scores array from Firestore, update only the current hole
                        const scores = docSnap.data().scores ? [...docSnap.data().scores] : Array(18).fill(0);
                        scores[currentHole] = val;
                        // Update scoreToPar for this hole
                        const scoreToPar = docSnap.data().scoreToPar ? [...docSnap.data().scoreToPar] : Array(18).fill(0);
                        scoreToPar[currentHole] = val - par;
                        await updateDoc(docRef, { scores, scoreToPar });
                    });
                } catch (err) {
                    console.error("Error updating score in Firestore:", err);
                }
            }));
        }
        // Advance to next hole
        if (currentHole < (course?.pars?.length ?? 18) - 1) {
            setCurrentHole(currentHole + 1);
        } else {
            setIsRoundFinished(true);
        }
    }

    function prevHole() {
        if (currentHole > 0) {
            setCurrentHole(currentHole - 1);
        }
    }

    if (isRoundFinished) {
        // Pass the scores to RoundSummary by cloning players and attaching scores
        const playersWithScores = players.map((p, i) => ({ ...p, scores: allScores[i] }));
        return (
            <RoundSummary
                players={playersWithScores}
                course={course}
                onEditRound={() => {
                    setIsRoundFinished(false);
                    setCurrentHole(0);
                }}
                onSubmitRound={onSubmitRound}
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
                    <ul className="hole-player-list">
                        {players.map((p, i) => (
                            <li key={i} className="hole-player-list-item">
                                <div className="hole-player-list-item-inner">
                                    <PlayerScoreDropdown
                                        player={p}
                                        value={allScores[i][currentHole]}
                                        onChange={(val) => {
                                            setAllScores((prev) => {
                                                const next = prev.map(arr => [...arr]);
                                                next[i][currentHole] = val;
                                                return next;
                                            });
                                        }}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="nav-buttons">
                <button onClick={prevHole} disabled={currentHole === 0}> Previous Hole </button>
                <button onClick={nextHole}>
                    {currentHole === course.pars.length - 1 ? "Finish Round" : "Next Hole"}
                </button>
            </div>
        </div>
    );
}

function PlayerScoreDropdown({ player, value, onChange }) {
    const handleChange = (e) => {
        const n = Number(e.target.value);
        onChange(n);
    };
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span className="player-name">{player?.name || String(player)}</span>
            <select className="select-dropdown player-score-select" style={{ width: '25%', marginLeft: 'auto' }} value={value} onChange={handleChange}>
                {[...Array(10)].map((_, idx) => (
                    <option key={idx + 1} value={idx + 1}>{idx + 1}</option>
                ))}
            </select>
        </div>
    );
}

export default Hole;
