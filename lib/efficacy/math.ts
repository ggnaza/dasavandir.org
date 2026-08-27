const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeAverage(scores: (number | null | undefined)[]): number | null {
  const valid = scores.filter((n): n is number => typeof n === "number" && !Number.isNaN(n));
  if (valid.length === 0) return null;
  return round2(valid.reduce((a, b) => a + b, 0) / valid.length);
}

export function computeTrend(averageScores: (number | null | undefined)[]) {
  const valid = averageScores.filter((n): n is number => typeof n === "number" && !Number.isNaN(n));
  if (valid.length < 2) return { direction: "flat" as const, change: 0 };
  const change = round2(valid[valid.length - 1] - valid[0]);
  const direction = change > 0 ? ("up" as const) : change < 0 ? ("down" as const) : ("flat" as const);
  return { direction, change };
}
