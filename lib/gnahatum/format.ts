/**
 * Render a point value exactly as awarded.
 *
 * Scores are awarded in quarter-point steps and stored as numeric(4,2), but
 * every display called `.toFixed(1)`, so a corrected 2.75 rendered as "2.8".
 * The teacher then saw a number they had not entered and, reasonably, assumed
 * the correction had been rounded on save. It had not — only the label was
 * wrong. Trims trailing zeros so 2.5 stays "2.5" and 3 stays "3".
 */
export function formatPoints(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  // toFixed(2) first absorbs float noise from summing 0.1 deductions
  // (2.9000000000000004 → "2.90"); parseFloat then drops the padding.
  return String(Number.parseFloat(value.toFixed(2)));
}
