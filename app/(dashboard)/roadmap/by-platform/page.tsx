"use client";

import React, { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  RoadmapDomainGroup, RoadmapAsset, AssetRoadmapPhase,
  InvestmentClassification, Domain,
} from "@/types";
import { hasOverlapWith } from "@/lib/roadmap-utils";

// ---------------------------------------------------------------------------
// Quarter utilities
// ---------------------------------------------------------------------------
function generateQuarters(from: string, to: string): string[] {
  const quarters: string[] = [];
  let [year, q] = from.split("-Q").map(Number);
  const [toYear, toQ] = to.split("-Q").map(Number);
  while (year < toYear || (year === toYear && q <= toQ)) {
    quarters.push(`${year}-Q${q}`);
    q++;
    if (q > 4) { q = 1; year++; }
  }
  return quarters;
}

const ALL_QUARTER_OPTIONS = generateQuarters("2024-Q1", "2030-Q4");

function currentQuarter(): string {
  const now = new Date();
  return `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
}

function addQuarters(quarter: string, n: number): string {
  let [year, q] = quarter.split("-Q").map(Number);
  q += n;
  year += Math.floor((q - 1) / 4);
  q = ((q - 1) % 4) + 1;
  return `${year}-Q${q}`;
}

function formatQuarter(q: string): string {
  const [year, qPart] = q.split("-");
  return `${qPart} ${year}`;
}

function phasePosition(
  phase: AssetRoadmapPhase,
  quarters: string[]
): { left: string; width: string } | null {
  const n = quarters.length;
  if (n === 0) return null;
  const from = quarters[0];
  const to   = quarters[n - 1];
  if (phase.endQuarter < from || phase.startQuarter > to) return null;
  const clampedStart = phase.startQuarter < from ? from : phase.startQuarter;
  const clampedEnd   = phase.endQuarter   > to   ? to   : phase.endQuarter;
  const startIdx = quarters.indexOf(clampedStart);
  const endIdx   = quarters.indexOf(clampedEnd);
  if (startIdx === -1 || endIdx === -1) return null;
  const left  = `${(startIdx / n) * 100}%`;
  const width = `${((endIdx - startIdx + 1) / n) * 100}%`;
  return { left, width };
}

// ---------------------------------------------------------------------------
// Domain filter (multi-select dropdown)
// ---------------------------------------------------------------------------
function DomainFilter({
  domains, selected, onChange,
}: {
  domains: Domain[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const label = selected.length === 0 ? "All Domains" : `${selected.length} domain${selected.length !== 1 ? "s" : ""}`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-brand-400 hover:bg-slate-50 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        <span>Domains: {label}</span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 w-64 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="max-h-64 overflow-y-auto p-2">
            {domains.length === 0 && (
              <p className="px-2 py-1 text-sm text-slate-400">No domains configured.</p>
            )}
            {domains.map((d) => (
              <label
                key={d.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(d.id)}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...selected, d.id]);
                    else onChange(selected.filter((id) => id !== d.id));
                  }}
                  className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                />
                <span className="text-slate-700 dark:text-slate-300">{d.name}</span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-slate-100 p-2 dark:border-slate-800">
              <button
                onClick={() => onChange([])}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase modal (add + edit)
// ---------------------------------------------------------------------------
interface PhaseForm {
  classificationId: string;
  startQuarter: string;
  endQuarter: string;
  notes: string;
}

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

function PhaseModal({
  isOpen, onClose, asset, phase, classifications, fromQuarter, onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  asset: RoadmapAsset | null;
  phase: AssetRoadmapPhase | null;
  classifications: InvestmentClassification[];
  fromQuarter: string;
  onSaved: () => void;
}) {
  const { user, canWrite } = useAuth();
  const isEdit = phase !== null;

  const defaultForm: PhaseForm = {
    classificationId: classifications[0]?.id ?? "",
    startQuarter:     fromQuarter,
    endQuarter:       addQuarters(fromQuarter, 3),
    notes:            "",
  };

  const [form, setForm] = useState<PhaseForm>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof PhaseForm, string>>>({});
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setGeneralError(""); setErrors({});
      if (phase) {
        setForm({
          classificationId: phase.classificationId,
          startQuarter:     phase.startQuarter,
          endQuarter:       phase.endQuarter,
          notes:            phase.notes ?? "",
        });
      } else {
        setForm({ ...defaultForm, classificationId: classifications[0]?.id ?? "" });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, phase]);

  function set<K extends keyof PhaseForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const newErrors: Partial<Record<keyof PhaseForm, string>> = {};
    if (!form.classificationId) newErrors.classificationId = "Classification is required.";
    if (!form.startQuarter)     newErrors.startQuarter = "Start quarter is required.";
    if (!form.endQuarter)       newErrors.endQuarter = "End quarter is required.";
    if (form.endQuarter && form.startQuarter && form.endQuarter < form.startQuarter)
      newErrors.endQuarter = "End quarter must be after start quarter.";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    if (!user) return;

    setGeneralError(""); setIsSaving(true);
    try {
      const url    = isEdit ? `/api/roadmap/phases/${phase!.id}` : "/api/roadmap/phases";
      const method = isEdit ? "PUT" : "POST";
      const body   = isEdit
        ? { classificationId: form.classificationId, startQuarter: form.startQuarter, endQuarter: form.endQuarter, notes: form.notes, userId: user.id, userName: user.name }
        : { assetId: asset!.id, classificationId: form.classificationId, startQuarter: form.startQuarter, endQuarter: form.endQuarter, notes: form.notes, userId: user.id, userName: user.name };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      onSaved();
      onClose();
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setIsSaving(false); }
  }

  async function handleDelete() {
    if (!phase || !user) return;
    setIsDeleting(true); setGeneralError("");
    try {
      const res = await fetch(`/api/roadmap/phases/${phase.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, userName: user.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      onSaved();
      onClose();
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setIsDeleting(false); }
  }

  const selectCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit phase - ${asset?.name ?? ""}` : `Add phase - ${asset?.name ?? ""}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} noValidate>
        {generalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
            {generalError}
          </div>
        )}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Classification</label>
            <select value={form.classificationId} onChange={(e) => set("classificationId", e.target.value)} className={selectCls}>
              {classifications.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.classificationId && <p className="text-xs text-red-500">{errors.classificationId}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Start quarter</label>
              <select value={form.startQuarter} onChange={(e) => set("startQuarter", e.target.value)} className={selectCls}>
                {ALL_QUARTER_OPTIONS.map((q) => (
                  <option key={q} value={q}>{formatQuarter(q)}</option>
                ))}
              </select>
              {errors.startQuarter && <p className="text-xs text-red-500">{errors.startQuarter}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">End quarter</label>
              <select value={form.endQuarter} onChange={(e) => set("endQuarter", e.target.value)} className={selectCls}>
                {ALL_QUARTER_OPTIONS.map((q) => (
                  <option key={q} value={q}>{formatQuarter(q)}</option>
                ))}
              </select>
              {errors.endQuarter && <p className="text-xs text-red-500">{errors.endQuarter}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes (optional)</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
            />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
          {isEdit && canWrite ? (
            <Button type="button" variant="danger" isLoading={isDeleting} onClick={handleDelete}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          ) : <div />}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            {canWrite && (
              <Button type="submit" isLoading={isSaving}>{isEdit ? "Save changes" : "Add phase"}</Button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Draggable phase bar
// ---------------------------------------------------------------------------
function DraggablePhaseBar({
  phase,
  quarters,
  dragPreview,
  isSaving,
  canWrite,
  onPointerDownMove,
  onPointerDownResize,
}: {
  phase:               AssetRoadmapPhase;
  quarters:            string[];
  dragPreview:         DragPreview | null;
  isSaving:            boolean;
  canWrite:            boolean;
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
  const cursor = !canWrite
    ? "pointer"
    : isSaving
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
        // Always allow: a plain click (no movement) opens the view/edit modal,
        // which itself gates save/delete behind canWrite. Only actual dragging
        // (handled inside onPointerDownMove's move-tracking) results in a mutation.
        const lane = (e.currentTarget as HTMLElement).parentElement!;
        onPointerDownMove(e, phase, lane);
      }}
    >
      <span className="flex-1 truncate pointer-events-none">{phase.classificationName}</span>
      {/* Resize handle — 8 px strip on the right edge (mutates via drag, so write-only) */}
      {canWrite && (
        <div
          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize"
          onPointerDown={(e) => {
            e.stopPropagation();
            // parentElement = bar div, parentElement.parentElement = lane div
            const lane = (e.currentTarget as HTMLElement).parentElement!.parentElement!;
            onPointerDownResize(e, phase, lane);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roadmap chart
// ---------------------------------------------------------------------------
function RoadmapChart({
  groups, quarters, canWrite, onAddPhase, onEditPhase, onSavePhase, onError,
}: {
  groups:      RoadmapDomainGroup[];
  quarters:    string[];
  canWrite:    boolean;
  onAddPhase:  (asset: RoadmapAsset) => void;
  onEditPhase: (asset: RoadmapAsset, phase: AssetRoadmapPhase) => void;
  onSavePhase: (phase: AssetRoadmapPhase, newStart: string, newEnd: string) => Promise<void>;
  onError:     (message: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const dragRef      = useRef<DragState | null>(null);
  const quartersRef  = useRef(quarters);
  const groupsRef    = useRef(groups);
  const phasesMapRef = useRef<Map<string, AssetRoadmapPhase[]>>(new Map());
  const callbacksRef = useRef({ onEditPhase, onSavePhase, onError });
  const canWriteRef  = useRef(canWrite);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [savingId,    setSavingId]    = useState<string | null>(null);

  // Mutate refs during render — safe React pattern for keeping refs fresh
  quartersRef.current  = quarters;
  groupsRef.current    = groups;
  callbacksRef.current = { onEditPhase, onSavePhase, onError };
  canWriteRef.current   = canWrite;

  // Rebuild phase map whenever groups change (needed for overlap check)
  useEffect(() => {
    const m = new Map<string, AssetRoadmapPhase[]>();
    for (const g of groups) for (const a of g.assets) m.set(a.id, a.phases);
    phasesMapRef.current = m;
  }, [groups]);

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
    document.body.style.cursor = mode === "resize" ? "ew-resize" : "grabbing";
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
      document.body.style.cursor = "";

      // Under 4 px travel — treat as click, open edit modal
      if (!drag.hasMoved) {
        setDragPreview(null);
        const asset = groupsRef.current
          .flatMap((g) => g.assets)
          .find((a) => a.id === drag.phase.assetId) ?? null;
        if (asset) callbacksRef.current.onEditPhase(asset, drag.phase);
        return;
      }

      // Drop blocked by overlap — snap back
      if (preview.hasOverlap) {
        setDragPreview(null);
        return;
      }

      // Read-only users cannot commit drag/resize mutations — snap back
      if (!canWriteRef.current) {
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
        .then(() => {
          setDragPreview(null);   // clear AFTER data is refreshed
        })
        .catch((err: Error) => {
          setDragPreview(null);   // still clear on error (snap back)
          callbacksRef.current.onError(
            err?.message ?? "Save failed - your change was not saved.",
          );
        })
        .finally(() => {
          setSavingId(null);
        });
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup",   onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup",   onPointerUp);
    };
  }, []); // empty deps — reads all live values via refs

  function toggleDomain(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const n = quarters.length;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div style={{ minWidth: `${200 + n * 80}px` }}>
        {/* Quarter header */}
        <div className="flex border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="w-48 flex-shrink-0 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400" />
          <div
            className="flex-1 grid"
            style={{ gridTemplateColumns: `repeat(${n}, minmax(80px, 1fr))` }}
          >
            {quarters.map((q) => (
              <div
                key={q}
                className="border-l border-slate-200 px-2 py-2 text-center text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400"
              >
                {formatQuarter(q)}
              </div>
            ))}
          </div>
        </div>

        {/* Domain groups */}
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.domainId);
          return (
            <div key={group.domainId}>
              {/* Domain header */}
              <button
                onClick={() => toggleDomain(group.domainId)}
                className="flex w-full items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                {isCollapsed
                  ? <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                  : <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                }
                {group.domainName}
                <span className="ml-1 font-normal text-slate-400">
                  ({group.assets.length})
                </span>
              </button>

              {/* Asset rows */}
              {!isCollapsed && group.assets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex border-b border-slate-100 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/20"
                >
                  {/* Asset name */}
                  <div className="w-48 flex-shrink-0 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 truncate" title={asset.name}>
                    {asset.name}
                  </div>

                  {/* Phase lane */}
                  <div
                    className={`relative flex-1 ${canWrite ? "cursor-pointer" : ""}`}
                    style={{ height: "40px" }}
                    onClick={() => { if (canWrite) onAddPhase(asset); }}
                  >
                    {/* Quarter column guides */}
                    <div
                      className="pointer-events-none absolute inset-0 grid"
                      style={{ gridTemplateColumns: `repeat(${n}, minmax(80px, 1fr))` }}
                    >
                      {quarters.map((q) => (
                        <div key={q} className="border-l border-slate-100 dark:border-slate-800" />
                      ))}
                    </div>

                    {/* Empty state hint */}
                    {asset.phases.length === 0 && canWrite && (
                      <div className="pointer-events-none absolute inset-1 rounded-md border-2 border-dashed border-slate-200 flex items-center px-3 dark:border-slate-700">
                        <span className="text-xs text-slate-400">Click to add a phase</span>
                      </div>
                    )}

                    {/* Phase bars */}
                    {asset.phases.map((phase) => (
                      <DraggablePhaseBar
                        key={phase.id}
                        phase={phase}
                        quarters={quarters}
                        dragPreview={dragPreview}
                        isSaving={savingId === phase.id}
                        canWrite={canWrite}
                        onPointerDownMove={onPointerDownMove}
                        onPointerDownResize={onPointerDownResize}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-slate-400">
            <p className="text-sm">No assets match the selected filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function RoadmapByPlatformPage() {
  const cq = currentQuarter();
  const [from, setFrom] = useState(cq);
  const [to,   setTo]   = useState(addQuarters(cq, 7));

  const [groups,          setGroups]          = useState<RoadmapDomainGroup[]>([]);
  const [domains,         setDomains]         = useState<Domain[]>([]);
  const [classifications, setClassifications] = useState<InvestmentClassification[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [isLoading,       setIsLoading]       = useState(true);
  const [fetchError,      setFetchError]      = useState<string | null>(null);

  // Modal state
  const [modalOpen,    setModalOpen]    = useState(false);
  const [activeAsset,  setActiveAsset]  = useState<RoadmapAsset | null>(null);
  const [activePhase,  setActivePhase]  = useState<AssetRoadmapPhase | null>(null);

  // Toast state
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastCounterRef = useRef(0);

  function showToast(message: string) {
    const id = ++toastCounterRef.current;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  const { user, canWrite } = useAuth();

  const quarters = generateQuarters(from, to);

  const fetchRoadmap = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const res = await fetch(`/api/roadmap/phases?from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load roadmap.");
      setGroups(data.groups);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load roadmap.");
    } finally { setIsLoading(false); }
  }, [from, to]);

  useEffect(() => { fetchRoadmap(); }, [fetchRoadmap]);

  const handleSavePhase = useCallback(async (
    phase: AssetRoadmapPhase,
    newStart: string,
    newEnd: string,
  ): Promise<void> => {
    const res = await fetch(`/api/roadmap/phases/${phase.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classificationId: phase.classificationId,
        startQuarter: newStart,
        endQuarter: newEnd,
        notes: phase.notes ?? "",
        userId: user?.id ?? "",
        userName: user?.name ?? "",
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed.");
    await fetchRoadmap();
  }, [user, fetchRoadmap]);

  useEffect(() => {
    Promise.all([
      fetch("/api/domains").then((r) => r.json()),
      fetch("/api/investment-classifications").then((r) => r.json()),
    ]).then(([domainsData, classData]) => {
      setDomains(domainsData.domains ?? []);
      setClassifications(classData.classifications ?? []);
    }).catch(() => { /* non-critical */ });
  }, []);

  function openAddModal(asset: RoadmapAsset) {
    setActiveAsset(asset); setActivePhase(null); setModalOpen(true);
  }

  function openEditModal(asset: RoadmapAsset, phase: AssetRoadmapPhase) {
    setActiveAsset(asset); setActivePhase(phase); setModalOpen(true);
  }

  // Apply domain filter client-side
  const filteredGroups = selectedDomains.length === 0
    ? groups
    : groups.filter((g) => selectedDomains.includes(g.domainId));

  const selectCls = "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300";

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Roadmap by Platform</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Asset investment phases across quarters. Click a lane to add a phase, click a bar to edit.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <DomainFilter
          domains={domains}
          selected={selectedDomains}
          onChange={setSelectedDomains}
        />
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>From</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls}>
            {ALL_QUARTER_OPTIONS.map((q) => (
              <option key={q} value={q}>{formatQuarter(q)}</option>
            ))}
          </select>
          <span>to</span>
          <select value={to} onChange={(e) => setTo(e.target.value)} className={selectCls}>
            {ALL_QUARTER_OPTIONS.map((q) => (
              <option key={q} value={q}>{formatQuarter(q)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-red-500">
          <AlertTriangle className="h-6 w-6" />
          <p className="text-sm">{fetchError}</p>
          <Button variant="secondary" size="sm" onClick={fetchRoadmap}>Retry</Button>
        </div>
      ) : (
        <RoadmapChart
          groups={filteredGroups}
          quarters={quarters}
          canWrite={canWrite}
          onAddPhase={openAddModal}
          onEditPhase={openEditModal}
          onSavePhase={handleSavePhase}
          onError={showToast}
        />
      )}

      {/* Phase modal */}
      <PhaseModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setActiveAsset(null); setActivePhase(null); }}
        asset={activeAsset}
        phase={activePhase}
        classifications={classifications}
        fromQuarter={from}
        onSaved={fetchRoadmap}
      />

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg dark:border-red-900 dark:bg-red-950/80 dark:text-red-400"
            >
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
