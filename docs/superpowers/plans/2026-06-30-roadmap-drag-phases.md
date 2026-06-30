# Roadmap Phase Drag Interaction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pointer-event drag to move and resize existing phase bars on the Roadmap by Platform Gantt chart, with live quarter-snapping and overlap prevention.

**Architecture:** A pure utility `hasOverlapWith` is extracted to `lib/roadmap-utils.ts` for testability. All other changes live in `app/(dashboard)/roadmap/by-platform/page.tsx`. A new `DraggablePhaseBar` component owns the visual states (idle, dragging-valid, dragging-overlap, saving). `RoadmapChart` owns drag state via a `dragRef` (no re-renders during `pointermove`) plus a single `dragPreview` state that drives only the live bar position. Window-level `pointermove`/`pointerup` handlers are registered once; they read fresh callbacks via a `callbacksRef` to avoid stale closures. A `< 4px` travel threshold distinguishes click (opens existing edit modal) from drag.

**Tech Stack:** React pointer events, `useRef`, `useCallback`, `useEffect`, Tailwind CSS

## Global Constraints

- No new npm dependencies
- TypeScript strict — no `any`, no `as unknown`
- Tailwind classes only; inline `style` only for dynamic values: `left`, `width`, `backgroundColor`, `opacity`, `cursor`, `zIndex`, `boxShadow`, `pointerEvents`
- All async fetch handlers must `throw new Error(...)` on non-ok responses so callers can catch
- Existing modal (classification, notes, delete) is unchanged

---

### Task 1: `hasOverlapWith` utility + unit tests

**Files:**
- Create: `lib/roadmap-utils.ts`
- Create: `__tests__/unit/roadmap-utils.test.ts`

**Interfaces:**
- Produces: `hasOverlapWith(phases, excludeId, quarters, startIdx, endIdx): boolean` — imported by `page.tsx` in Task 3

---

- [ ] **Step 1: Write the failing tests**

Create `__tests__/unit/roadmap-utils.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — expect 6 failures**

```
npm test -- --testPathPattern="roadmap-utils" --no-coverage
```

Expected output: 6 failures — `Cannot find module '@/lib/roadmap-utils'`.

- [ ] **Step 3: Create `lib/roadmap-utils.ts`**

```ts
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
```

- [ ] **Step 4: Run tests — expect 6 passing**

```
npm test -- --testPathPattern="roadmap-utils" --no-coverage
```

Expected output: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/roadmap-utils.ts __tests__/unit/roadmap-utils.test.ts
git commit -m "feat: add hasOverlapWith utility for roadmap drag overlap detection"
```

---

### Task 2: Interfaces + `DraggablePhaseBar` component

**Files:**
- Modify: `app/(dashboard)/roadmap/by-platform/page.tsx`

**Interfaces:**
- Consumes: `phasePosition(phase, quarters)` (already in file, line 48); `hasOverlapWith` from Task 1
- Produces: `DragState`, `DragPreview`, `ToastItem` interfaces; `DraggablePhaseBar` component — both consumed by Task 3

---

- [ ] **Step 1: Update the React import to include the default export**

In `page.tsx`, change line 1's import from:

```ts
import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
```

to:

```ts
import React, { useState, useEffect, useCallback, useRef, FormEvent } from "react";
```

`React` is needed for `React.PointerEvent` in callback prop types.

- [ ] **Step 2: Add the `hasOverlapWith` import**

After the existing imports block (after line 11), add:

```ts
import { hasOverlapWith } from "@/lib/roadmap-utils";
```

- [ ] **Step 3: Add interfaces after `PhaseForm` (after line 147)**

Insert immediately after the closing `}` of the `PhaseForm` interface:

```ts
// Defined before DragState because DragState.currentPreview references it
interface DragPreview {
  phaseId:    string;
  startIdx:   number;
  endIdx:     number;
  hasOverlap: boolean;
}

interface DragState {
  phase:            AssetRoadmapPhase;
  mode:             "move" | "resize";
  originalStartIdx: number;
  originalEndIdx:   number;
  startX:           number;
  colWidth:         number;
  hasMoved:         boolean;
  currentPreview:   DragPreview;
}

interface ToastItem {
  id:      number;
  message: string;
}
```

- [ ] **Step 4: Add `DraggablePhaseBar` component before the `// Roadmap chart` comment (before line 325)**

```tsx
// ---------------------------------------------------------------------------
// Draggable phase bar
// ---------------------------------------------------------------------------
function DraggablePhaseBar({
  phase,
  quarters,
  dragPreview,
  isSaving,
  onPointerDownMove,
  onPointerDownResize,
}: {
  phase:               AssetRoadmapPhase;
  quarters:            string[];
  dragPreview:         DragPreview | null;
  isSaving:            boolean;
  onPointerDownMove:   (e: React.PointerEvent, phase: AssetRoadmapPhase, laneEl: HTMLElement) => void;
  onPointerDownResize: (e: React.PointerEvent, phase: AssetRoadmapPhase, laneEl: HTMLElement) => void;
}) {
  const n              = quarters.length;
  const isBeingDragged = dragPreview?.phaseId === phase.id;
  const isOverlap      = isBeingDragged && (dragPreview?.hasOverlap ?? false);

  let left: string;
  let width: string;

  if (isBeingDragged && dragPreview) {
    left  = `${(dragPreview.startIdx / n) * 100}%`;
    width = `${((dragPreview.endIdx - dragPreview.startIdx + 1) / n) * 100}%`;
  } else {
    const pos = phasePosition(phase, quarters);
    if (!pos) return null;
    ({ left, width } = pos);
  }

  const bgColor = isOverlap ? "#ef4444" : phase.classificationColor;
  const opacity = isSaving
    ? 0.5
    : isBeingDragged
    ? (isOverlap ? 0.55 : 0.85)
    : 1;
  const cursor = isSaving
    ? "wait"
    : isBeingDragged
    ? (isOverlap ? "not-allowed" : "grabbing")
    : "grab";

  return (
    <div
      className="absolute inset-y-1.5 flex items-center rounded-md px-2 text-xs font-medium text-white shadow-sm overflow-hidden select-none"
      style={{
        left,
        width,
        backgroundColor: bgColor,
        opacity,
        cursor,
        zIndex: isBeingDragged ? 10 : 1,
        pointerEvents: isSaving ? "none" : undefined,
        boxShadow: isBeingDragged && !isOverlap
          ? "0 4px 12px rgba(0,0,0,0.25)"
          : undefined,
      }}
      title={`${phase.classificationName}${phase.notes ? `: ${phase.notes}` : ""}`}
      // Prevent click bubbling to the lane (which would open Add modal)
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        const lane = (e.currentTarget as HTMLElement).parentElement!;
        onPointerDownMove(e, phase, lane);
      }}
    >
      <span className="flex-1 truncate pointer-events-none">{phase.classificationName}</span>
      {/* Resize handle — 8 px strip on the right edge */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize"
        onPointerDown={(e) => {
          e.stopPropagation();
          // parentElement = bar div, parentElement.parentElement = lane div
          const lane = (e.currentTarget as HTMLElement).parentElement!.parentElement!;
          onPointerDownResize(e, phase, lane);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/\(dashboard\)/roadmap/by-platform/page.tsx
git commit -m "feat: add DraggablePhaseBar component and drag interfaces"
```

---

### Task 3: Drag state management in `RoadmapChart`

**Files:**
- Modify: `app/(dashboard)/roadmap/by-platform/page.tsx` — `RoadmapChart` function only

**Interfaces:**
- Consumes: `DragState`, `DragPreview`, `DraggablePhaseBar`, `hasOverlapWith` (all from Tasks 1–2)
- Produces: Updated `RoadmapChart` accepting `onSavePhase` + `onError` props; replaces inline phase bar `<div>` elements with `<DraggablePhaseBar />`

---

- [ ] **Step 1: Update `RoadmapChart` props signature**

Replace the existing function signature (around line 325):

```tsx
// BEFORE:
function RoadmapChart({
  groups, quarters, onAddPhase, onEditPhase,
}: {
  groups: RoadmapDomainGroup[];
  quarters: string[];
  onAddPhase: (asset: RoadmapAsset) => void;
  onEditPhase: (asset: RoadmapAsset, phase: AssetRoadmapPhase) => void;
}) {
```

```tsx
// AFTER:
function RoadmapChart({
  groups, quarters, onAddPhase, onEditPhase, onSavePhase, onError,
}: {
  groups:      RoadmapDomainGroup[];
  quarters:    string[];
  onAddPhase:  (asset: RoadmapAsset) => void;
  onEditPhase: (asset: RoadmapAsset, phase: AssetRoadmapPhase) => void;
  onSavePhase: (phase: AssetRoadmapPhase, newStart: string, newEnd: string) => Promise<void>;
  onError:     (message: string) => void;
}) {
```

- [ ] **Step 2: Add refs, drag preview state, and callbacks ref inside `RoadmapChart`**

After the existing `const [collapsed, setCollapsed] = useState<Set<string>>(new Set());` line, insert:

```tsx
  const dragRef      = useRef<DragState | null>(null);
  const quartersRef  = useRef(quarters);
  const groupsRef    = useRef(groups);
  const phasesMapRef = useRef<Map<string, AssetRoadmapPhase[]>>(new Map());
  const callbacksRef = useRef({ onEditPhase, onSavePhase, onError });
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [savingId,    setSavingId]    = useState<string | null>(null);

  // Mutate refs during render — safe React pattern for keeping refs fresh
  quartersRef.current  = quarters;
  groupsRef.current    = groups;
  callbacksRef.current = { onEditPhase, onSavePhase, onError };

  // Rebuild phase map whenever groups change (needed for overlap check)
  useEffect(() => {
    const m = new Map<string, AssetRoadmapPhase[]>();
    for (const g of groups) for (const a of g.assets) m.set(a.id, a.phases);
    phasesMapRef.current = m;
  }, [groups]);
```

- [ ] **Step 3: Add `startDrag`, `onPointerDownMove`, `onPointerDownResize` callbacks**

After the refs block, before the existing `function toggleDomain` definition, insert:

```tsx
  const startDrag = useCallback((
    e: React.PointerEvent,
    phase: AssetRoadmapPhase,
    laneEl: HTMLElement,
    mode: "move" | "resize",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const qs = quartersRef.current;
    const n  = qs.length;
    if (n === 0) return;
    const colWidth = laneEl.offsetWidth / n;
    const startQ   = phase.startQuarter < qs[0]     ? qs[0]     : phase.startQuarter;
    const endQ     = phase.endQuarter   > qs[n - 1] ? qs[n - 1] : phase.endQuarter;
    const startIdx = qs.indexOf(startQ);
    const endIdx   = qs.indexOf(endQ);
    if (startIdx === -1 || endIdx === -1) return;
    const initialPreview: DragPreview = {
      phaseId: phase.id, startIdx, endIdx, hasOverlap: false,
    };
    dragRef.current = {
      phase, mode,
      originalStartIdx: startIdx, originalEndIdx: endIdx,
      startX: e.clientX, colWidth,
      hasMoved: false, currentPreview: initialPreview,
    };
    setDragPreview(initialPreview);
  }, []);

  const onPointerDownMove = useCallback(
    (e: React.PointerEvent, phase: AssetRoadmapPhase, laneEl: HTMLElement) =>
      startDrag(e, phase, laneEl, "move"),
    [startDrag],
  );

  const onPointerDownResize = useCallback(
    (e: React.PointerEvent, phase: AssetRoadmapPhase, laneEl: HTMLElement) =>
      startDrag(e, phase, laneEl, "resize"),
    [startDrag],
  );
```

- [ ] **Step 4: Add window pointermove / pointerup effect**

After the callbacks, before `function toggleDomain`, insert:

```tsx
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const qs = quartersRef.current;
      const n  = qs.length;
      if (Math.abs(e.clientX - drag.startX) > 4) drag.hasMoved = true;
      const delta = Math.round((e.clientX - drag.startX) / drag.colWidth);

      let startIdx: number;
      let endIdx:   number;
      if (drag.mode === "move") {
        const span = drag.originalEndIdx - drag.originalStartIdx;
        startIdx   = Math.max(0, Math.min(n - 1 - span, drag.originalStartIdx + delta));
        endIdx     = startIdx + span;
      } else {
        // resize: only the right edge moves; minimum span = 1 quarter
        startIdx = drag.originalStartIdx;
        endIdx   = Math.max(drag.originalStartIdx, Math.min(n - 1, drag.originalEndIdx + delta));
      }

      const phases     = phasesMapRef.current.get(drag.phase.assetId) ?? [];
      const hasOverlap = hasOverlapWith(phases, drag.phase.id, qs, startIdx, endIdx);
      const preview: DragPreview = { phaseId: drag.phase.id, startIdx, endIdx, hasOverlap };
      drag.currentPreview = preview;
      setDragPreview(preview);
    }

    function onPointerUp() {
      const drag = dragRef.current;
      if (!drag) return;
      const preview = drag.currentPreview;
      dragRef.current = null;

      // Under 4 px travel → treat as click, open edit modal
      if (!drag.hasMoved) {
        setDragPreview(null);
        const asset = groupsRef.current
          .flatMap((g) => g.assets)
          .find((a) => a.id === drag.phase.assetId) ?? null;
        if (asset) callbacksRef.current.onEditPhase(asset, drag.phase);
        return;
      }

      // Drop blocked by overlap → snap back
      if (preview.hasOverlap) {
        setDragPreview(null);
        return;
      }

      // Commit the drag
      const qs       = quartersRef.current;
      const newStart = qs[preview.startIdx];
      const newEnd   = qs[preview.endIdx];
      setSavingId(drag.phase.id);
      callbacksRef.current
        .onSavePhase(drag.phase, newStart, newEnd)
        .catch((err: Error) =>
          callbacksRef.current.onError(
            err?.message ?? "Save failed — your change was not saved.",
          ),
        )
        .finally(() => {
          setSavingId(null);
          setDragPreview(null);
        });
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup",   onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup",   onPointerUp);
    };
  }, []); // empty deps — reads all live values via refs
```

- [ ] **Step 5: Replace inline phase bar rendering with `DraggablePhaseBar`**

Inside `RoadmapChart`'s JSX, find the existing `{/* Phase bars */}` block. It looks like:

```tsx
{/* Phase bars */}
{asset.phases.map((phase) => {
  const pos = phasePosition(phase, quarters);
  if (!pos) return null;
  return (
    <div
      key={phase.id}
      className="absolute inset-y-1.5 flex cursor-pointer items-center rounded-md px-2 text-xs font-medium text-white shadow-sm overflow-hidden"
      style={{
        left: pos.left,
        width: pos.width,
        backgroundColor: phase.classificationColor,
      }}
      title={`${phase.classificationName}${phase.notes ? `: ${phase.notes}` : ""}`}
      onClick={(e) => { e.stopPropagation(); onEditPhase(asset, phase); }}
    >
      <span className="truncate">{phase.classificationName}</span>
    </div>
  );
})}
```

Replace it with:

```tsx
{/* Phase bars */}
{asset.phases.map((phase) => (
  <DraggablePhaseBar
    key={phase.id}
    phase={phase}
    quarters={quarters}
    dragPreview={dragPreview}
    isSaving={savingId === phase.id}
    onPointerDownMove={onPointerDownMove}
    onPointerDownResize={onPointerDownResize}
  />
))}
```

- [ ] **Step 6: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/\(dashboard\)/roadmap/by-platform/page.tsx
git commit -m "feat: add drag state and window pointer handlers to RoadmapChart"
```

---

### Task 4: Wire into page — `handleSavePhase`, toast, and updated `RoadmapChart` call

**Files:**
- Modify: `app/(dashboard)/roadmap/by-platform/page.tsx` — `RoadmapByPlatformPage` function only

**Interfaces:**
- Consumes: `RoadmapChart` with `onSavePhase` + `onError` props from Task 3; `ToastItem` from Task 2

---

- [ ] **Step 1: Add toast state + `addToast` helper inside `RoadmapByPlatformPage`**

After the existing `const [fetchError, setFetchError] = useState<string | null>(null);` line, insert:

```tsx
  const [toasts,    setToasts]    = useState<ToastItem[]>([]);
  const toastCounter              = useRef(0);

  function addToast(message: string) {
    const id = ++toastCounter.current;
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }
```

- [ ] **Step 2: Add `handleSavePhase` inside `RoadmapByPlatformPage`**

After the existing `openEditModal` function (around line 509), insert:

```tsx
  const handleSavePhase = useCallback(async (
    phase: AssetRoadmapPhase,
    newStart: string,
    newEnd: string,
  ) => {
    if (!user) return;
    const res = await fetch(`/api/roadmap/phases/${phase.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classificationId: phase.classificationId,
        startQuarter:     newStart,
        endQuarter:       newEnd,
        notes:            phase.notes ?? "",
        userId:           user.id,
        userName:         user.name,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed.");
    fetchRoadmap();
  }, [user, fetchRoadmap]);
```

- [ ] **Step 3: Update `<RoadmapChart />` usage in page JSX**

Find the existing `<RoadmapChart ... />` call (around line 563):

```tsx
// BEFORE:
<RoadmapChart
  groups={filteredGroups}
  quarters={quarters}
  onAddPhase={openAddModal}
  onEditPhase={openEditModal}
/>
```

```tsx
// AFTER:
<RoadmapChart
  groups={filteredGroups}
  quarters={quarters}
  onAddPhase={openAddModal}
  onEditPhase={openEditModal}
  onSavePhase={handleSavePhase}
  onError={addToast}
/>
```

- [ ] **Step 4: Add toast display to the page JSX**

At the very end of the returned JSX in `RoadmapByPlatformPage`, just before the closing `</div>` of the outer `space-y-4` wrapper, insert:

```tsx
      {/* Drag-save error toasts */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 shadow-lg dark:bg-red-950/50 dark:border-red-900 dark:text-red-400"
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
```

- [ ] **Step 5: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run full test suite**

```
npm test -- --no-coverage
```

Expected: all existing tests pass; 6 new `roadmap-utils` tests pass.

- [ ] **Step 7: Manual smoke test**

Start the dev server and open `http://localhost:3000/roadmap/by-platform`.

Verify each of the following:

1. **Move:** Drag an existing phase bar left or right — it snaps to quarter boundaries as you drag and saves in the new position on release.
2. **Resize:** Hover the right edge of a bar — cursor becomes `ew-resize`. Drag right to extend or left to shrink. Saves on release.
3. **Overlap block:** Drag a bar until it overlaps a neighbouring bar — the bar turns red/transparent. Releasing snaps it back; no API call is made.
4. **Click → modal:** Click a phase bar without dragging — the edit modal opens with existing classification, notes, and delete button intact.
5. **Add phase:** Click on an empty lane area (not a bar) — the add modal opens as before.
6. **Save error toast:** With the network offline (DevTools → Network → Offline), drag and drop a phase — the red toast appears bottom-right and disappears after 4 seconds.

- [ ] **Step 8: Commit**

```bash
git add app/\(dashboard\)/roadmap/by-platform/page.tsx
git commit -m "feat: wire drag save and error toast into roadmap page"
```
