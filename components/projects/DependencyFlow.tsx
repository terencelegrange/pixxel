"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  type NodeProps,
  type Node,
  type Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import { FolderKanban } from "lucide-react";
import { Project, ProjectAsset, ProjectStatus } from "@/types";

// ---------------------------------------------------------------------------
// Styling maps
// ---------------------------------------------------------------------------
const LIFECYCLE_COLOURS: Record<string, { bg: string; text: string; dot: string }> = {
  Proposed:         { bg: "#f8fafc", text: "#475569", dot: "#94a3b8" },
  Approved:         { bg: "#eff6ff", text: "#1d4ed8", dot: "#3b82f6" },
  "In Development": { bg: "#fffbeb", text: "#b45309", dot: "#f59e0b" },
  Production:       { bg: "#f0fdf4", text: "#166534", dot: "#22c55e" },
  Sunset:           { bg: "#fff7ed", text: "#c2410c", dot: "#f97316" },
  Retired:          { bg: "#fef2f2", text: "#b91c1c", dot: "#ef4444" },
};

const STATUS_COLOURS: Record<ProjectStatus, { border: string; bg: string; badge: string; badgeText: string }> = {
  "Active":    { border: "#22c55e", bg: "#f0fdf4", badge: "#dcfce7", badgeText: "#166534" },
  "On Hold":   { border: "#f59e0b", bg: "#fffbeb", badge: "#fef3c7", badgeText: "#92400e" },
  "Completed": { border: "#3b82f6", bg: "#eff6ff", badge: "#dbeafe", badgeText: "#1e40af" },
  "Cancelled": { border: "#94a3b8", bg: "#f8fafc", badge: "#f1f5f9", badgeText: "#475569" },
};

// ---------------------------------------------------------------------------
// Custom node: Project (centre hub)
// ---------------------------------------------------------------------------
function ProjectNode({ data }: NodeProps) {
  const colours = STATUS_COLOURS[data.status as ProjectStatus] ?? STATUS_COLOURS["Active"];
  return (
    <div
      style={{
        background: colours.bg,
        border: `2px solid ${colours.border}`,
        borderRadius: 16,
        padding: "14px 20px",
        minWidth: 200,
        maxWidth: 240,
        boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
      }}
    >
      {/* Handles — both sides so edges can connect */}
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ background: colours.border + "20", borderRadius: 8, padding: 6, display: "flex" }}>
          <FolderKanban size={18} color={colours.border} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>
          {data.name}
        </span>
      </div>

      <span style={{
        display: "inline-block",
        background: colours.badge,
        color: colours.badgeText,
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 10px",
      }}>
        {data.status}
      </span>

      <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
        {data.upstream} upstream · {data.downstream} downstream
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom node: Asset
// ---------------------------------------------------------------------------
function AssetNode({ data }: NodeProps) {
  const lc = LIFECYCLE_COLOURS[data.lifecycleStatus] ?? LIFECYCLE_COLOURS["Proposed"];
  const isUpstream = data.dependencyType === "upstream";

  return (
    <div
      style={{
        background: "#fff",
        border: "1.5px solid #e2e8f0",
        borderRadius: 12,
        padding: "10px 14px",
        minWidth: 180,
        maxWidth: 210,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      {isUpstream ? (
        <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      ) : (
        <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      )}

      <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 6, lineHeight: 1.35 }}>
        {data.label}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        <span style={{
          background: lc.bg,
          color: lc.text,
          borderRadius: 99,
          fontSize: 10,
          fontWeight: 600,
          padding: "2px 8px",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: lc.dot, display: "inline-block" }} />
          {data.lifecycleStatus}
        </span>

        {data.tierName && (
          <span style={{
            background: "#f1f5f9",
            color: "#475569",
            borderRadius: 99,
            fontSize: 10,
            fontWeight: 500,
            padding: "2px 8px",
          }}>
            {data.tierName}
          </span>
        )}
      </div>

      {data.notes && (
        <div style={{ marginTop: 6, fontSize: 10, color: "#94a3b8", lineHeight: 1.4 }}>
          {data.notes}
        </div>
      )}
    </div>
  );
}

const NODE_TYPES = { project: ProjectNode, asset: AssetNode };

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------
const NODE_HEIGHT = 90;
const NODE_GAP = 24;
const UPSTREAM_X = 60;
const PROJECT_X = 420;
const DOWNSTREAM_X = 780;

function buildGraph(project: Project, assets: ProjectAsset[]): { nodes: Node[]; edges: Edge[] } {
  const upstream = assets.filter((a) => a.dependencyType === "upstream");
  const downstream = assets.filter((a) => a.dependencyType === "downstream");

  const maxSide = Math.max(upstream.length, downstream.length, 1);
  const totalHeight = maxSide * (NODE_HEIGHT + NODE_GAP) - NODE_GAP;
  const projectY = totalHeight / 2 - 60; // approx half node height

  // Project node
  const nodes: Node[] = [
    {
      id: "project",
      type: "project",
      position: { x: PROJECT_X, y: projectY },
      data: {
        name: project.name,
        status: project.status,
        upstream: upstream.length,
        downstream: downstream.length,
      },
      draggable: true,
    },
  ];

  const edges: Edge[] = [];

  // Upstream nodes — left side, connect TO project
  upstream.forEach((a, i) => {
    const y = i * (NODE_HEIGHT + NODE_GAP);
    nodes.push({
      id: a.assetId,
      type: "asset",
      position: { x: UPSTREAM_X, y },
      data: {
        label: a.assetName,
        lifecycleStatus: a.lifecycleStatus,
        tierName: a.tierName,
        notes: a.notes,
        dependencyType: "upstream",
      },
      draggable: true,
    });
    edges.push({
      id: `e-${a.assetId}-project`,
      source: a.assetId,
      target: "project",
      type: "smoothstep",
      animated: true,
      style: { stroke: "#8b5cf6", strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#8b5cf6" },
      label: "upstream",
      labelStyle: { fontSize: 10, fill: "#8b5cf6", fontWeight: 600 },
      labelBgStyle: { fill: "#f5f3ff" },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 4,
    });
  });

  // Downstream nodes — right side, project connects TO them
  downstream.forEach((a, i) => {
    const y = i * (NODE_HEIGHT + NODE_GAP);
    nodes.push({
      id: a.assetId,
      type: "asset",
      position: { x: DOWNSTREAM_X, y },
      data: {
        label: a.assetName,
        lifecycleStatus: a.lifecycleStatus,
        tierName: a.tierName,
        notes: a.notes,
        dependencyType: "downstream",
      },
      draggable: true,
    });
    edges.push({
      id: `e-project-${a.assetId}`,
      source: "project",
      target: a.assetId,
      type: "smoothstep",
      animated: true,
      style: { stroke: "#0ea5e9", strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#0ea5e9" },
      label: "downstream",
      labelStyle: { fontSize: 10, fill: "#0284c7", fontWeight: 600 },
      labelBgStyle: { fill: "#f0f9ff" },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 4,
    });
  });

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DependencyFlow({
  project,
  assets,
}: {
  project: Project;
  assets: ProjectAsset[];
}) {
  const { nodes, edges } = useMemo(() => buildGraph(project, assets), [project, assets]);

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
        <FolderKanban className="h-8 w-8 text-slate-200" />
        <p className="text-sm">Link assets to see the dependency flow.</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 520 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e2e8f0" gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
