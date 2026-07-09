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
import { Layers } from "lucide-react";
import { Service, ServiceAsset, ServiceStatus, ServiceRole } from "@/types";

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

const STATUS_COLOURS: Record<ServiceStatus, { border: string; bg: string; badge: string; badgeText: string }> = {
  "Planned":  { border: "#3b82f6", bg: "#eff6ff", badge: "#dbeafe", badgeText: "#1e40af" },
  "Active":   { border: "#22c55e", bg: "#f0fdf4", badge: "#dcfce7", badgeText: "#166534" },
  "Degraded": { border: "#f59e0b", bg: "#fffbeb", badge: "#fef3c7", badgeText: "#92400e" },
  "Retired":  { border: "#94a3b8", bg: "#f8fafc", badge: "#f1f5f9", badgeText: "#475569" },
};

// Role → colour mapping (edges + role badges)
const ROLE_COLOURS: Record<ServiceRole, string> = {
  Core: "#7c3aed",
  Supporting: "#0ea5e9",
  Dependency: "#94a3b8",
};

// ---------------------------------------------------------------------------
// Custom node: Service (centre hub)
// ---------------------------------------------------------------------------
function ServiceNode({ data }: NodeProps) {
  const colours = STATUS_COLOURS[data.status as ServiceStatus] ?? STATUS_COLOURS["Active"];
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
          <Layers size={18} color={colours.border} />
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
        {data.memberCount} linked asset{data.memberCount !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom node: Asset
// ---------------------------------------------------------------------------
function AssetNode({ data }: NodeProps) {
  const lc = LIFECYCLE_COLOURS[data.lifecycleStatus] ?? LIFECYCLE_COLOURS["Proposed"];
  const roleColour = ROLE_COLOURS[data.role as ServiceRole] ?? ROLE_COLOURS.Dependency;
  const isLeft = data.side === "left";

  return (
    <div
      style={{
        background: "#fff",
        border: `1.5px solid ${roleColour}55`,
        borderRadius: 12,
        padding: "10px 14px",
        minWidth: 180,
        maxWidth: 210,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      {isLeft ? (
        <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      ) : (
        <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      )}

      <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 6, lineHeight: 1.35 }}>
        {data.label}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        <span style={{
          background: `${roleColour}1a`,
          color: roleColour,
          borderRadius: 99,
          fontSize: 10,
          fontWeight: 600,
          padding: "2px 8px",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: roleColour, display: "inline-block" }} />
          {data.role}
        </span>

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

const NODE_TYPES = { service: ServiceNode, asset: AssetNode };

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------
const NODE_HEIGHT = 90;
const NODE_GAP = 24;
const LEFT_X = 60;
const SERVICE_X = 420;
const RIGHT_X = 780;

// Roles are split across the two columns: Core + Supporting on the left
// (primary contributors), Dependency on the right (things the service
// relies on) — but the columns themselves are colour-neutral; the edges
// and badges carry the role colour, per the brief.
const LEFT_ROLES: ServiceRole[] = ["Core", "Supporting"];
const RIGHT_ROLES: ServiceRole[] = ["Dependency"];

function buildGraph(service: Service, members: ServiceAsset[]): { nodes: Node[]; edges: Edge[] } {
  const left = members.filter((m) => LEFT_ROLES.includes(m.role));
  const right = members.filter((m) => RIGHT_ROLES.includes(m.role));

  const maxSide = Math.max(left.length, right.length, 1);
  const totalHeight = maxSide * (NODE_HEIGHT + NODE_GAP) - NODE_GAP;
  const serviceY = totalHeight / 2 - 60; // approx half node height

  // Service node
  const nodes: Node[] = [
    {
      id: "service",
      type: "service",
      position: { x: SERVICE_X, y: serviceY },
      data: {
        name: service.name,
        status: service.status,
        memberCount: members.length,
      },
      draggable: true,
    },
  ];

  const edges: Edge[] = [];

  // Left column — Core / Supporting assets, connect TO the service
  left.forEach((m, i) => {
    const y = i * (NODE_HEIGHT + NODE_GAP);
    nodes.push({
      id: m.assetId,
      type: "asset",
      position: { x: LEFT_X, y },
      data: {
        label: m.assetName,
        lifecycleStatus: m.lifecycleStatus,
        tierName: m.tierName,
        notes: m.notes,
        role: m.role,
        side: "left",
      },
      draggable: true,
    });
    const colour = ROLE_COLOURS[m.role];
    edges.push({
      id: `e-${m.assetId}-service`,
      source: m.assetId,
      target: "service",
      type: "smoothstep",
      animated: true,
      style: { stroke: colour, strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: colour },
      label: m.role,
      labelStyle: { fontSize: 10, fill: colour, fontWeight: 600 },
      labelBgStyle: { fill: `${colour}14` },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 4,
    });
  });

  // Right column — Dependency assets, service connects TO them
  right.forEach((m, i) => {
    const y = i * (NODE_HEIGHT + NODE_GAP);
    nodes.push({
      id: m.assetId,
      type: "asset",
      position: { x: RIGHT_X, y },
      data: {
        label: m.assetName,
        lifecycleStatus: m.lifecycleStatus,
        tierName: m.tierName,
        notes: m.notes,
        role: m.role,
        side: "right",
      },
      draggable: true,
    });
    const colour = ROLE_COLOURS[m.role];
    edges.push({
      id: `e-service-${m.assetId}`,
      source: "service",
      target: m.assetId,
      type: "smoothstep",
      animated: true,
      style: { stroke: colour, strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: colour },
      label: m.role,
      labelStyle: { fontSize: 10, fill: colour, fontWeight: 600 },
      labelBgStyle: { fill: `${colour}14` },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 4,
    });
  });

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ServiceFlow({
  service,
  members,
}: {
  service: Service;
  members: ServiceAsset[];
}) {
  const { nodes, edges } = useMemo(() => buildGraph(service, members), [service, members]);

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
        <Layers className="h-8 w-8 text-slate-200" />
        <p className="text-sm">Link assets to see the service composition flow.</p>
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
