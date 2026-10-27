const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);

/**
 * Pure function: combines component scores (0-100 or null when no data) into one health score.
 * Components without data are ignored and weights are re-normalised.
 */
export function scoreHealth(components) {
  const usable = components.filter((c) => c.score !== null && c.score !== undefined);
  if (!usable.length) return { score: null, label: 'No data yet', components };
  const totalWeight = sum(usable, (c) => c.weight);
  const score = Math.round(sum(usable, (c) => c.score * c.weight) / totalWeight);
  const label = score >= 80 ? 'Healthy' : score >= 60 ? 'Needs attention' : 'At risk';
  return { score, label, components };
}

export function bugPenaltyScore(openBugs) {
  const w = { CRITICAL: 25, HIGH: 10, MEDIUM: 4, LOW: 1 };
  return clamp(100 - sum(openBugs, (b) => w[b.severity]));
}
