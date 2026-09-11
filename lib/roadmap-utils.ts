import type { AssetRoadmapPhase } from "@/types";

/**
 * Returns true if [quarters[startIdx], quarters[endIdx]] overlaps any phase
 * except the one with id === excludeId.
 * Uses quarter string comparison so off-screen phases are still caught.
 */
export function hasOverlapWith(
  phases: AssetRoadmapPhase[],
  excludeId: string,
  quarters: string[],
  startIdx: number,
  endIdx: number
): boolean {
  const startQ = quarters[startIdx];
  const endQ   = quarters[endIdx];
  return phases
    .filter((p) => p.id !== excludeId)
    .some((p) => p.startQuarter <= endQ && p.endQuarter >= startQ);
}
