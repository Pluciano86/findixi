function normalizeIsoDate(value) {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';
  return raw.slice(0, 10);
}

export function shuffleArray(input = []) {
  const output = Array.isArray(input) ? [...input] : [];

  for (let idx = output.length - 1; idx > 0; idx -= 1) {
    const swapIndex = Math.floor(Math.random() * (idx + 1));
    [output[idx], output[swapIndex]] = [output[swapIndex], output[idx]];
  }

  return output;
}

export function pickRandomItems(input = [], limit = input.length) {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : input.length;
  return shuffleArray(input).slice(0, safeLimit);
}

export function getNearestUpcomingISODate(dateValues = [], todayISO = new Date().toISOString().slice(0, 10)) {
  const upcoming = (Array.isArray(dateValues) ? dateValues : [])
    .map(normalizeIsoDate)
    .filter((value) => value && value >= todayISO)
    .sort((a, b) => a.localeCompare(b));

  return upcoming[0] || null;
}

export function getLatestISODate(dateValues = []) {
  const ordered = (Array.isArray(dateValues) ? dateValues : [])
    .map(normalizeIsoDate)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));

  return ordered[0] || null;
}

export function compareByNearestUpcomingDate(dateValuesA = [], dateValuesB = [], todayISO) {
  const nearestA = getNearestUpcomingISODate(dateValuesA, todayISO);
  const nearestB = getNearestUpcomingISODate(dateValuesB, todayISO);

  if (nearestA && nearestB) return nearestA.localeCompare(nearestB);
  if (nearestA) return -1;
  if (nearestB) return 1;

  const latestA = getLatestISODate(dateValuesA);
  const latestB = getLatestISODate(dateValuesB);
  if (latestA && latestB) return latestB.localeCompare(latestA);
  if (latestA) return -1;
  if (latestB) return 1;

  return 0;
}
