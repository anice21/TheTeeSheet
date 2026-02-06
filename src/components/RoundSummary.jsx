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
    const parTotal = Array.isArray(course?.pars)
        ? course.pars.reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0)
        : 0;

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
            <div className="hole-header">
                <h1 className="hole-header-title">{course.name}</h1>
                <h2 className="hole-header-sub">Round Summary</h2>
            </div>
            <div>
                {players && players.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                                <th style={{ padding: '8px 0' }}>Player</th>
                                <th style={{ padding: '8px 0', textAlign: 'right', width: 90 }}>Total</th>
                                <th style={{ padding: '8px 0', textAlign: 'center', width: 80 }}>To Par</th>
                            </tr>
                        </thead>
                        <tbody>
                            {players.map((p, idx) => {
                                const total = totalScores[p.playerId];
                                const toPar = typeof total === 'number' ? total - parTotal : null;
                                return (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '10px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            <span className="player-name">{p.name || `Player ${idx + 1}`}</span>
                                        </td>
                                        <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '1.2em' }}>
                                            {total !== undefined ? total : 'Calculating...'}
                                        </td>
                                        <td style={{ padding: '10px 0', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1em', color: toPar !== null && toPar < 0 ? '#ef4444' : '#6b7280' }}>
                                            {toPar === null ? '' : (toPar === 0 ? 'E' : `${toPar > 0 ? '+' : ''}${toPar}`)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div>No players</div>
                )}
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
