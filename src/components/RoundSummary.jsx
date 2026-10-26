import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { calculateHoleScores, getFallbackHoleHandicaps } from '../utils/scoring/handicap';

// Make getPlayerTotalScore async and query Firestore for the player's round
async function getPlayerTotalScore(player, course, selectedTrip, tripRoundID) {
    if (!selectedTrip?.id) return 0;
    
    const constraints = [
        where('courseId', '==', String(course.courseId)),
        where('playerId', '==', String(player.playerId)),
        where('isRoundFinished', '==', false),
        where('isActive', '==', true)
    ];
    
    if (tripRoundID !== undefined && tripRoundID !== null) {
        constraints.push(where('tripRoundID', '==', tripRoundID));
    }
    
    const q = query(collection(db, 'trips', selectedTrip.id, 'scores'), ...constraints);
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return 0;
    // Assume only one active round per player per course
    const roundDoc = querySnapshot.docs[0];
    const roundData = roundDoc.data();
    
    if (!Array.isArray(roundData.scores)) return 0;
    
    // Use roundType from the stored document
    const roundType = roundData.roundType || 'full';
    
    // Calculate total based on roundType
    let scoresToSum;
    switch (roundType) {
        case 'front9':
            scoresToSum = roundData.scores.slice(0, 9); // Holes 1-9
            break;
        case 'back9':
            scoresToSum = roundData.scores.slice(9, 18); // Holes 10-18
            break;
        case 'full':
        default:
            scoresToSum = roundData.scores;
            break;
    }
    
    // Only sum scores greater than 0 (0 means hole not played)
    return scoresToSum.reduce((sum, val) => sum + (typeof val === 'number' && val > 0 ? val : 0), 0);
}

function RoundSummary({ players, course, onEditRound, onSubmitRound, selectedTrip, tripRoundID, roundType = 'full' }) {
    const [deleting, setDeleting] = useState(false);
    const [totalScores, setTotalScores] = useState({});
    const [actualRoundType, setActualRoundType] = useState(roundType);
    const [format, setFormat] = useState('individual');
    const [teamScores, setTeamScores] = useState(null);
    const [netScoresByPlayer, setNetScoresByPlayer] = useState({});
    const [teamNetScores, setTeamNetScores] = useState(null);
    const [teamSummaries, setTeamSummaries] = useState([]);
    const [teamName, setTeamName] = useState(null);
    
    // Fetch the actual round type from Firestore
    useEffect(() => {
        const fetchRoundType = async () => {
            if (!selectedTrip?.id || !course?.courseId || players.length === 0) return;
            
            const constraints = [
                where('courseId', '==', String(course.courseId)),
                where('isRoundFinished', '==', false),
                where('isActive', '==', true)
            ];
            
            if (tripRoundID !== undefined && tripRoundID !== null) {
                constraints.push(where('tripRoundID', '==', tripRoundID));
            }
            
            const q = query(collection(db, 'trips', selectedTrip.id, 'scores'), ...constraints);
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const roundData = querySnapshot.docs[0].data();
                setActualRoundType(roundData.roundType || 'full');
                setFormat(roundData.format || 'individual');
                setTeamName(roundData.teamName || null);
            }
        };
        
        fetchRoundType();
    }, [selectedTrip, course, players, tripRoundID]);
    
    // Calculate par total based on actualRoundType
    const parTotal = React.useMemo(() => {
        if (!Array.isArray(course?.pars)) return 0;
        
        let parsToSum;
        switch (actualRoundType) {
            case 'front9':
                parsToSum = course.pars.slice(0, 9); // Holes 1-9
                break;
            case 'back9':
                parsToSum = course.pars.slice(9, 18); // Holes 10-18
                break;
            case 'full':
            default:
                parsToSum = course.pars;
                break;
        }
        
        return parsToSum.reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
    }, [course?.pars, actualRoundType]);

    useEffect(() => {
        const fetchScores = async () => {
            const scores = {};
            const netScores = {};
            const allPlayerScores = [];
            const allPlayerNetScores = [];
            const teamPlayers = {};
            
            for (const player of players) {
                const total = await getPlayerTotalScore(player, course, selectedTrip, tripRoundID);
                scores[player.playerId] = total;
                
                // Fetch full scores array for team calculation
                if (format === 'bestball') {
                    const constraints = [
                        where('courseId', '==', String(course.courseId)),
                        where('playerId', '==', String(player.playerId)),
                        where('isRoundFinished', '==', false),
                        where('isActive', '==', true)
                    ];
                    if (tripRoundID !== undefined && tripRoundID !== null) {
                        constraints.push(where('tripRoundID', '==', tripRoundID));
                    }
                    const q = query(collection(db, 'trips', selectedTrip.id, 'scores'), ...constraints);
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        const roundData = querySnapshot.docs[0].data();
                        const grossScores = roundData.scores || [];
                        const netScores = roundData.netScores || calculateHoleScores(
                            roundData.scores || [],
                            course.pars,
                            course.holeHandicaps || getFallbackHoleHandicaps(),
                            roundData.playerHandicap ?? player.handicap
                        ).netScores;
                        allPlayerScores.push(grossScores);
                        allPlayerNetScores.push(netScores);
                        const teamKey = roundData.teamId || player.teamId || 'unassigned';
                        if (!teamPlayers[teamKey]) {
                            teamPlayers[teamKey] = {
                                teamKey,
                                teamName: roundData.teamName || player.teamName || null,
                                players: []
                            };
                        }
                        teamPlayers[teamKey].players.push({ player, grossScores, netScores });
                    }
                }

                const netQuery = query(
                    collection(db, 'trips', selectedTrip.id, 'scores'),
                    where('courseId', '==', String(course.courseId)),
                    where('playerId', '==', String(player.playerId)),
                    where('isRoundFinished', '==', false),
                    where('isActive', '==', true)
                );
                const netSnapshot = await getDocs(netQuery);
                if (!netSnapshot.empty) {
                    const roundData = netSnapshot.docs[0].data();
                    const calculated = roundData.netScores || calculateHoleScores(
                        roundData.scores || [],
                        course.pars,
                        course.holeHandicaps || getFallbackHoleHandicaps(),
                        roundData.playerHandicap ?? player.handicap
                    ).netScores;
                    netScores[player.playerId] = calculated.reduce((sum, value) => sum + (value > 0 ? value : 0), 0);
                }
            }
            
            setTotalScores(scores);
            setNetScoresByPlayer(netScores);
            
            // Calculate team scores
            if (format === 'bestball' && allPlayerScores.length > 0) {
                const teamScoresArray = Array(18).fill(null);
                for (let hole = 0; hole < 18; hole++) {
                    const holeScores = allPlayerScores
                        .map(scores => scores[hole])
                        .filter(s => typeof s === 'number' && s > 0);
                    if (holeScores.length > 0) {
                        teamScoresArray[hole] = Math.min(...holeScores);
                    }
                }
                setTeamScores(teamScoresArray);
                const teamNetScoresArray = Array(18).fill(null);
                for (let hole = 0; hole < 18; hole++) {
                    const holeScores = allPlayerNetScores
                        .map(scores => scores[hole])
                        .filter(s => typeof s === 'number' && s > 0);
                    if (holeScores.length > 0) {
                        teamNetScoresArray[hole] = Math.min(...holeScores);
                    }
                }
                setTeamNetScores(teamNetScoresArray);

                setTeamSummaries(Object.values(teamPlayers).map(team => {
                    const grossTeamScores = Array(18).fill(null);
                    const netTeamScores = Array(18).fill(null);
                    for (let hole = 0; hole < 18; hole++) {
                        const grossValues = team.players.map(item => item.grossScores[hole]).filter(score => typeof score === 'number' && score > 0);
                        const netValues = team.players.map(item => item.netScores[hole]).filter(score => typeof score === 'number' && score > 0);
                        if (grossValues.length > 0) grossTeamScores[hole] = Math.min(...grossValues);
                        if (netValues.length > 0) netTeamScores[hole] = Math.min(...netValues);
                    }
                    return {
                        ...team,
                        grossTotal: grossTeamScores.reduce((sum, score) => sum + (score || 0), 0),
                        netTotal: netTeamScores.reduce((sum, score) => sum + (score || 0), 0)
                    };
                }));
            }
        };

        if (players.length > 0 && course && selectedTrip) {
            fetchScores();
        }
    }, [players, course, selectedTrip, tripRoundID, format]);

    const handleSubmit = async () => {
        if (!course || !players || players.length === 0 || !selectedTrip?.id) {
            if (onSubmitRound) onSubmitRound();
            return;
        }
        try {
            // For each player, update isRoundFinished to true for their active round for this course
            await Promise.all(players.map(async (p) => {
                const constraints = [
                    where('courseId', '==', String(course.courseId)),
                    where('playerId', '==', String(p.playerId)),
                    where('isActive', '==', true)
                ];
                
                if (tripRoundID !== undefined && tripRoundID !== null) {
                    constraints.push(where('tripRoundID', '==', tripRoundID));
                }
                
                const q = query(collection(db, 'trips', selectedTrip.id, 'scores'), ...constraints);
                const querySnapshot = await getDocs(q);
                await Promise.all(querySnapshot.docs.map(docSnap => updateDoc(docSnap.ref, { isRoundFinished: true })));
            }));
        } catch (err) {
            alert('Error submitting round: ' + err.message);
        }
        if (onSubmitRound) onSubmitRound();
    };

    const handleDiscard = async () => {
        if (!selectedTrip?.id || !course?.courseId || !players?.length) {
            alert('Unable to discard this round because the round details are incomplete.');
            return;
        }
        setDeleting(true);
        try {
            const scoreQueries = players.map(async (player) => {
                const constraints = [
                    where('courseId', '==', String(course.courseId)),
                    where('playerId', '==', String(player.playerId))
                ];

                if (tripRoundID !== undefined && tripRoundID !== null) {
                    constraints.push(where('tripRoundID', '==', tripRoundID));
                }

                const scoreQuery = query(
                    collection(db, 'trips', selectedTrip.id, 'scores'),
                    ...constraints
                );
                return getDocs(scoreQuery);
            });

            const snapshots = await Promise.all(scoreQueries);
            const scoreDocs = snapshots.flatMap(snapshot => snapshot.docs);
            await Promise.all(scoreDocs.map(scoreDoc => deleteDoc(scoreDoc.ref)));
            
            if (onSubmitRound) onSubmitRound();
        } catch (err) {
            alert('Error discarding round: ' + err.message);
        } finally {
            setDeleting(false);
        }
    };

    const renderPlayerSummaryRow = (player, key, displayIndex) => {
        const total = totalScores[player.playerId];
        const netTotal = netScoresByPlayer[player.playerId];
        const toPar = typeof total === 'number' ? total - parTotal : null;
        return (
            <tr key={key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span className="player-name">{player.name || `Player ${displayIndex + 1}`}</span>
                </td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '1.2em' }}>
                    {total !== undefined
                        ? `${total} / ${netTotal ?? 'N/A'}`
                        : 'Calculating...'}
                </td>
                <td style={{ padding: '10px 0', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1em', color: toPar !== null && toPar < 0 ? '#ef4444' : '#6b7280' }}>
                    {toPar === null ? '' : (toPar === 0 ? 'E' : `${toPar > 0 ? '+' : ''}${toPar}`)}
                </td>
            </tr>
        );
    };

    const renderTeamSummaryRow = (team) => {
        const toPar = team.grossTotal - parTotal;
        const teamNetTotal = team.netTotal;
        return (
            <tr key={`team-score-${team.teamKey}`} style={{ borderTop: '2px solid #d1d5db', borderBottom: '2px solid #d1d5db', fontWeight: 'bold' }}>
                <td style={{ padding: '10px 0' }}>Team Score</td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontSize: '1.2em' }}>
                    {team.grossTotal} / {teamNetTotal}
                </td>
                <td style={{ padding: '10px 0', textAlign: 'center', fontSize: '1.1em', color: toPar < 0 ? '#ef4444' : '#6b7280' }}>
                    {toPar === 0 ? 'E' : `${toPar > 0 ? '+' : ''}${toPar}`}
                </td>
            </tr>
        );
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
                                <th style={{ padding: '8px 0', textAlign: 'center', width: 90 }}>Total</th>
                                <th style={{ padding: '8px 0', textAlign: 'center', width: 80 }}>To Par</th>
                            </tr>
                        </thead>
                        <tbody>
                            {format === 'bestball' && teamSummaries.length > 0
                                ? teamSummaries.flatMap(team => [
                                    ...team.players.map(({ player }, index) => renderPlayerSummaryRow(player, `${team.teamKey}-${player.playerId}`, index)),
                                    renderTeamSummaryRow(team)
                                ])
                                : players.map((player, index) => renderPlayerSummaryRow(player, index, index))}
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
