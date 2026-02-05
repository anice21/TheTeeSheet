import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';

// Make getPlayerTotalScore async and query Firestore for the player's round
async function getPlayerTotalScore(player, course) {
    const q = query(
        collection(db, 'rounds'),
        where('courseId', '==', String(course.courseId)),
        where('playerId', '==', String(player.playerId)),
        where('isActive', '==', true)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return 0;
    // Assume only one active round per player per course
    const roundDoc = querySnapshot.docs[0];
    const roundData = roundDoc.data();
    return Array.isArray(roundData.scores)
        ? roundData.scores.reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0)
        : 0;
}

function RoundSummary({ players, course, onEditRound, onSubmitRound }) {
    const [deleting, setDeleting] = useState(false);
    const [totalScores, setTotalScores] = useState({});

    useEffect(() => {
        const fetchScores = async () => {
            const scores = {};
            for (const player of players) {
                scores[player.playerId] = await getPlayerTotalScore(player, course);
            }
            setTotalScores(scores);
        };

        if (players.length > 0 && course) {
            fetchScores();
        }
    }, [players, course]);

    const handleSubmit = async () => {
        if (!course || !players || players.length === 0) {
            if (onSubmitRound) onSubmitRound();
            return;
        }
        try {
            // For each player, update isRoundFinished to true for their active round for this course
            await Promise.all(players.map(async (p) => {
                const q = query(
                    collection(db, 'rounds'),
                    where('courseId', '==', String(course.courseId)),
                    where('playerId', '==', String(p.playerId)),
                    where('isActive', '==', true)
                );
                const querySnapshot = await getDocs(q);
                await Promise.all(querySnapshot.docs.map(docSnap => updateDoc(docSnap.ref, { isRoundFinished: true })));
            }));
        } catch (err) {
            alert('Error submitting round: ' + err.message);
        }
        if (onSubmitRound) onSubmitRound();
    };

    const handleDiscard = async () => {
        if (!course || !players || players.length === 0) return;
        setDeleting(true);
        try {
            // For each player, delete their round document for this course
            await Promise.all(players.map(async (p) => {
                const q = query(
                    collection(db, 'rounds'),
                    where('courseId', '==', String(course.courseId)),
                    where('playerId', '==', String(p.playerId))
                );
                const querySnapshot = await getDocs(q);
                await Promise.all(querySnapshot.docs.map(docSnap => deleteDoc(docSnap.ref)));
            }));
            // Optionally, you can call onSubmitRound or onEditRound to exit the summary view
            if (onSubmitRound) onSubmitRound();
        } catch (err) {
            alert('Error discarding round: ' + err.message);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="round-finished-message">
            <h1>{course.name}</h1>
            <div>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {players && players.length > 0 ? (
                        players.map((p, idx) => (
                            <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                <div style={{ flex: 1 }}>
                                    <span className="player-name">{p.name || `Player ${idx + 1}`}</span>
                                </div>
                                <div style={{ fontWeight: 'bold' }}>Total: {totalScores[p.playerId] !== undefined ? totalScores[p.playerId] : 'Calculating...'}</div>
                            </li>
                        ))
                    ) : (
                        <li>No players</li>
                    )}
                </ul>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 32 }}>
                <button className="round-action-btn discard" onClick={handleDiscard} disabled={deleting}>{deleting ? 'Discarding...' : 'Discard Round'}</button>
                <button className="round-action-btn edit" onClick={onEditRound}>Edit Round</button>
                <button className="round-action-btn submit" onClick={handleSubmit}>Submit Round</button>
            </div>
        </div>
    );
}

export default RoundSummary;
