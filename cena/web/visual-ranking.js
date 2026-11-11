// Visual similarity is auxiliary evidence, never permission to add a title automatically.
export function rankWithVision(items, scores) {
  const byId = new Map(scores.filter(row => typeof row.id === 'string' && Number.isFinite(row.score)).map(row => [row.id, Math.max(0, Math.min(1, row.score))]));
  const visualWeight = items.some(item => item.ambiguousTitle) ? .55 : .25;
  return items.map(item => {
    const text = Number.isFinite(item.matchScore) ? item.matchScore : .85;
    const visual = byId.get(item.id);
    return { ...item, visualSimilarity: visual, combinedScore: visual === undefined ? text * (1 - visualWeight) : text * (1 - visualWeight) + visual * visualWeight };
  }).sort((a, b) => b.combinedScore - a.combinedScore);
}
