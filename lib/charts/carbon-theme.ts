/**
 * IBM Carbon-inspired chart palette — used by the widgets touched in the
 * Inicial rebuild (funnel, metric chart, lead sources, revenue vs. goal,
 * scatter/mock charts). Colors come from Carbon's categorical data-viz set;
 * axis/grid styling reads the same CSS vars as the rest of the app so charts
 * stay in sync with light/dark theme automatically.
 */

// Carbon categorical palette (data-viz-01), in the order Carbon recommends
// for sequential series.
export const CARBON_CHART_PALETTE = [
  '#0f62fe', // blue 60 — primary accent
  '#8a3ffc', // purple 60
  '#24a148', // green 50
  '#ee5396', // magenta 50
  '#1192e8', // cyan 50
  '#f1c21b', // yellow 30
  '#005d5d', // teal 70
  '#fa4d56', // red 50
] as const

export function carbonColor(index: number): string {
  return CARBON_CHART_PALETTE[index % CARBON_CHART_PALETTE.length]
}

export const CARBON_CHART_AXIS = {
  fontSize: 11,
  stroke: 'hsl(var(--muted-foreground))',
  gridStroke: 'hsl(var(--border))',
}
