export function getStrokesReceived(playerHandicap, holeHandicap) {
  const handicap = Number.isFinite(Number(playerHandicap)) ? Math.trunc(Number(playerHandicap)) : 0;
  const ranking = Number(holeHandicap);

  if (!Number.isInteger(ranking) || ranking < 1 || ranking > 18) {
    return 0;
  }

  if (handicap >= 0) {
    const baseStrokes = Math.floor(handicap / 18);
    const extraStrokes = handicap % 18;
    return baseStrokes + (ranking <= extraStrokes ? 1 : 0);
  }

  const strokesGivenBack = Math.min(Math.abs(handicap), 18);
  return ranking <= strokesGivenBack ? -1 : 0;
}

export function calculateNetScore(grossScore, playerHandicap, holeHandicap) {
  if (typeof grossScore !== 'number' || grossScore <= 0) {
    return 0;
  }

  return grossScore - getStrokesReceived(playerHandicap, holeHandicap);
}

export function calculateNetScoreToPar(grossScore, par, playerHandicap, holeHandicap) {
  if (typeof grossScore !== 'number' || grossScore <= 0) {
    return 0;
  }

  return calculateNetScore(grossScore, playerHandicap, holeHandicap) - (Number(par) || 0);
}

export function calculateHoleScores(grossScores, pars, holeHandicaps, playerHandicap) {
  const netScores = Array(18).fill(0);
  const netScoreToPar = Array(18).fill(0);
  const strokesReceived = Array(18).fill(0);

  for (let hole = 0; hole < 18; hole += 1) {
    const grossScore = grossScores?.[hole];
    const par = pars?.[hole] ?? 0;
    const holeHandicap = holeHandicaps?.[hole];
    const strokes = getStrokesReceived(playerHandicap, holeHandicap);

    strokesReceived[hole] = strokes;
    netScores[hole] = calculateNetScore(grossScore, playerHandicap, holeHandicap);
    netScoreToPar[hole] = calculateNetScoreToPar(grossScore, par, playerHandicap, holeHandicap);
  }

  return { netScores, netScoreToPar, strokesReceived };
}

export function getFallbackHoleHandicaps() {
  return Array.from({ length: 18 }, (_, index) => index + 1);
}

export function isValidHoleHandicaps(holeHandicaps) {
  if (!Array.isArray(holeHandicaps) || holeHandicaps.length !== 18) {
    return false;
  }

  const normalized = holeHandicaps.map(value => Number(value));
  return normalized.every(value => Number.isInteger(value) && value >= 1 && value <= 18)
    && new Set(normalized).size === 18;
}
