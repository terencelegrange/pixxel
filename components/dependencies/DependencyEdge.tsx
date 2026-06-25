"use client";

import { memo } from "react";
import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from "reactflow";
import { DependencyConnectionType, DependencyDirection } from "@/types";

export interface DependencyEdgeData {
  type: DependencyConnectionType;
  direction: DependencyDirection;
  notes: string | null;
  dependencyId: string;
}

const TYPE_COLOURS: Record<DependencyConnectionType, string> = {
  "API":             "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "Database":        "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "File Transfer":   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "Event / Message": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "UI Embed":        "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "Other":           "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

function DependencyEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, selected,
}: EdgeProps<DependencyEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const strokeColour = selected ? "#6366f1" : "#94a3b8";
  const strokeWidth = selected ? 2 : 1.5;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: strokeColour, strokeWidth }}
        markerEnd={`url(#dep-arrow-${id})`}
        markerStart={data?.direction === "bidirectional" ? `url(#dep-arrow-start-${id})` : undefined}
      />

      {/* Inline SVG markers — one per edge to allow per-edge colour */}
      <svg style={{ position: "absolute", top: 0, left: 0, overflow: "visible", width: 0, height: 0 }}>
        <defs>
          <marker id={`dep-arrow-${id}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={strokeColour} />
          </marker>
          {data?.direction === "bidirectional" && (
            <marker id={`dep-arrow-start-${id}`} markerWidth="8" markerHeight="8" refX="2" refY="3" orient="auto-start-reverse">
              <path d="M0,0 L0,6 L8,3 z" fill={strokeColour} />
            </marker>
          )}
        </defs>
      </svg>

      {data && (
        <EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "none",
            }}
            className="absolute nodrag nopan"
          >
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${TYPE_COLOURS[data.type]}`}>
              {data.type}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(DependencyEdge);
