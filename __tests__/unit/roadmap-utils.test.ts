import { hasOverlapWith } from "@/lib/roadmap-utils";
import type { AssetRoadmapPhase } from "@/types";

const Q = ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4", "2027-Q1"];

function makePhase(id: string, start: string, end: string): AssetRoadmapPhase {
  return {
    id, assetId: "a1", classificationId: "c1",
    classificationName: "Invest", classificationColor: "#22c55e",
    startQuarter: start, endQuarter: end,
    notes: null, createdById: "u1", createdByName: "Test",
    createdAt: "", updatedAt: "",
  };
}

const phases = [
  makePhase("p1", "2026-Q1", "2026-Q2"),
  makePhase("p2", "2026-Q4", "2027-Q1"),
];

describe("hasOverlapWith", () => {
  it("returns false when proposed range has no overlap", () => {
    // Q3 only — clear gap between p1 (Q1-Q2) and p2 (Q4-Q1)
    expect(hasOverlapWith(phases, "other", Q, 2, 2)).toBe(false);
  });

  it("returns true when proposed range overlaps an existing phase", () => {
    // Q2-Q3 overlaps p1 which ends Q2
    expect(hasOverlapWith(phases, "other", Q, 1, 2)).toBe(true);
  });

  it("excludes the phase matching excludeId so a bar cannot overlap itself during resize", () => {
    // p1 occupies Q1-Q2; resizing p1 into Q1-Q2 must not be self-blocked
    expect(hasOverlapWith(phases, "p1", Q, 0, 1)).toBe(false);
  });

  it("returns true when ranges share exactly one quarter (adjacent = overlap)", () => {
    // Q3-Q4 proposed; p2 starts Q4 — shared quarter is an overlap
    expect(hasOverlapWith(phases, "other", Q, 2, 3)).toBe(true);
  });

  it("returns false for empty phases list", () => {
    expect(hasOverlapWith([], "other", Q, 0, 1)).toBe(false);
  });

  it("catches phases that start before the visible window (string comparison, not index)", () => {
    // p3 starts at 2025-Q4 (before Q[0]="2026-Q1") but ends inside the window
    const offScreen = [makePhase("p3", "2025-Q4", "2026-Q1")];
    // proposed Q1-Q2: p3 endQuarter "2026-Q1" >= startQ "2026-Q1" → overlap
    expect(hasOverlapWith(offScreen, "other", Q, 0, 1)).toBe(true);
  });
});
