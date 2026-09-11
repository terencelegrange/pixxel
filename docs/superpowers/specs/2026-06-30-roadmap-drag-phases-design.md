# Roadmap Phase Drag Interaction — Design Spec

**Date:** 2026-06-30
**Page:** `/roadmap/by-platform`
**Scope:** Drag to move and resize existing phase bars on the Gantt chart. No new dependencies.

---

## Goal

Replace the current "click bar → modal to change quarters" workflow with direct manipulation: drag a phase bar left/right to move it, drag its right edge to resize it. The existing modal (click bar → edit classification, notes, delete) is unchanged.

---

## Out of Scope

- Drag-to-create new phases (still click empty lane → modal)
- Keyboard drag accessibility (not in scope for this iteration)
- Touch / mobile drag (pointer events work on touch but no specific touch UX tuning)

---

## Architecture

All changes are confined to `app/(dashboard)/roadmap/by-platform/page.tsx`. No new files, no new dependencies.

### New inline component: `DraggablePhaseBar`

Extracted from the existing inline phase bar rendering inside `RoadmapChart`. Owns all pointer event handlers for one phase bar.

Props:
```ts
interface DraggablePhaseBarProps {
  phase: AssetRoadmapPhase;
  quarters: string[];
  allPhasesForAsset: AssetRoadmapPhase[];
  onDragCommit: (phaseId: string, newStart: string, newEnd: string) => Promise<void>;
  onClickEdit: () => void;
}
```

### Drag state

Stored in a `useRef` on `RoadmapChart` (not `useState`) so `pointermove` handlers don't trigger full chart re-renders. A single separate `useState<DragPreview | null>` drives only the dragged bar's live position:

```ts
interface DragState {
  phaseId:           string;
  assetId:           string;
  mode:              "move" | "resize";
  originalStartIdx:  number;
  originalEndIdx:    number;
  startX:            number;
  colWidth:          number;
}

interface DragPreview {
  phaseId:    string;
  startIdx:   number;
  endIdx:     number;
  hasOverlap: boolean;
}
```

---

## Interaction Details

### Move

- `pointerdown` on the bar body (excluding the resize handle): capture pointer, record `dragState.ref`, set `cursor: grabbing` on `<body>`.
- `pointermove` on `window`:
  ```
  deltaQuarters = Math.round((e.clientX - startX) / colWidth)
  newStartIdx   = clamp(originalStartIdx + deltaQuarters, 0, n - span)
  newEndIdx     = newStartIdx + span          // preserves bar width
  ```
  Update `dragPreview` state → bar snaps live to quarter boundaries.
- `pointerup` on `window`: clear `cursor`, if `hasOverlap` → snap back (set `dragPreview = null`); else call `onDragCommit`.

### Resize

- `pointerdown` on the 8px resize handle (right edge of bar): same capture flow, `mode = "resize"`.
- `pointermove`:
  ```
  deltaQuarters = Math.round((e.clientX - startX) / colWidth)
  newEndIdx     = clamp(originalEndIdx + deltaQuarters, originalStartIdx, n - 1)
  ```
  Minimum span = 1 quarter (end ≥ start always).
- `pointerup`: same commit/snap logic.

### Click vs drag threshold

If total pointer travel is < 4px before `pointerup`, cancel drag and call `onClickEdit` instead (opens existing edit modal). This preserves the full edit workflow for classification, notes, and delete.

### Overlap detection (client-side)

During `pointermove`, check proposed `[newStartIdx, newEndIdx]` against all other phases on the same asset:

```ts
function hasOverlapWith(
  phases: AssetRoadmapPhase[],
  excludeId: string,
  quarters: string[],
  startIdx: number,
  endIdx: number
): boolean {
  const startQ = quarters[startIdx];
  const endQ   = quarters[endIdx];
  return phases
    .filter(p => p.id !== excludeId)
    .some(p => p.startQuarter <= endQ && p.endQuarter >= startQ);
}
```

Quarter string comparison works because the format `YYYY-Qn` sorts lexicographically — no index lookup needed, so phases outside the visible window are still caught.

When `hasOverlap = true`: bar renders semi-transparent red, cursor changes to `not-allowed`, drop is blocked on `pointerup` (snap back, no API call).

---

## Visual States

| State | Bar appearance |
|---|---|
| Idle | Solid classification colour, `cursor: grab` on hover |
| Dragging (valid) | Slightly reduced opacity (0.85), shadow elevated, `cursor: grabbing` |
| Dragging (overlap) | Semi-transparent red overlay, `cursor: not-allowed` |
| Saving | Reduced opacity, pointer-events none, brief spinner on bar |
| Save error | Snaps back to original position, inline toast below the chart |

The resize handle is a narrow strip on the right edge (`w-2`, `cursor: ew-resize`) visible on bar hover.

---

## Data Flow

```
pointerup (valid drop)
  → onDragCommit(phaseId, newStart, newEnd)
    → PUT /api/roadmap/phases/:id  { startQuarter, endQuarter }
    → on 200: fetchRoadmap() to refresh data
    → on error: snap bar back, show toast
```

No optimistic update to the full `groups` state — the bar stays in its drag-preview position while saving, then the refresh settles it. This avoids stale-data races.

---

## Error Handling

- **409 overlap (server):** API returns overlap error → bar snaps back, toast: "This phase overlaps another — it's been reset."
- **Network / 500:** Bar snaps back, toast: "Save failed — your change was not saved."
- **Toast:** Displayed as a fixed bottom-right notification, auto-dismisses after 4 seconds. Reuses Tailwind classes consistent with existing error styling.

---

## Files Changed

| File | Change |
|---|---|
| `app/(dashboard)/roadmap/by-platform/page.tsx` | Extract `DraggablePhaseBar`, add drag state ref + preview state, add `hasOverlapWith` helper, add toast state |

No API route changes required (existing `PUT /api/roadmap/phases/:id` is sufficient).

---

## Non-Goals / Future

- Drag-to-create phases
- Multi-phase selection / bulk move
- Undo/redo
