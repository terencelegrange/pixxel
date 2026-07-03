"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, {
  Node, Edge, NodeTypes, EdgeTypes,
  Background, Controls, MiniMap,
  useNodesState, useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "@dagrejs/dagre";
import { Network, Plus, Search, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AssetDependency, DependencyConnectionType } from "@/types";
import DependencyNode, { DependencyNodeData } from "@/components/dependencies/DependencyNode";
import DependencyEdge, { DependencyEdgeData } from "@/components/dependencies/DependencyEdge";
import AddDependencyModal from "@/components/dependencies/AddDependencyModal";
import DependencyPanel from "@/components/dependencies/DependencyPanel";

const nodeTypes: NodeTypes = { dependencyNode: DependencyNode };
const edgeTypes: EdgeTypes = { dependencyEdge: DependencyEdge };

const NODE_W = 190;
const NODE_H = 56;

function computeForceLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  const pos = new Map(nodes.map((n) => [
    n.id,
    { x: (Math.random() - 0.5) * 600, y: (Math.random() - 0.5) * 400 },
  ]));

  const SPRING_K = 120;
  const REPULSION = 6000;
  const ITERATIONS = 80;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces = new Map(nodes.map((n) => [n.id, { x: 0, y: 0 }]));
    const cooling = 1 - (iter / ITERATIONS) * 0.85;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const pi = pos.get(nodes[i].id)!;
        const pj = pos.get(nodes[j].id)!;
        const dx = pj.x - pi.x || 0.01;
        const dy = pj.y - pi.y || 0.01;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = REPULSION / (dist * dist);
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        forces.get(nodes[i].id)!.x -= fx;
        forces.get(nodes[i].id)!.y -= fy;
        forces.get(nodes[j].id)!.x += fx;
        forces.get(nodes[j].id)!.y += fy;
      }
    }

    for (const edge of edges) {
      const ps = pos.get(edge.source);
      const pt = pos.get(edge.target);
      if (!ps || !pt) continue;
      const dx = pt.x - ps.x;
      const dy = pt.y - ps.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = ((dist - SPRING_K) / dist) * 0.1;
      forces.get(edge.source)!.x += dx * f;
      forces.get(edge.source)!.y += dy * f;
      forces.get(edge.target)!.x -= dx * f;
      forces.get(edge.target)!.y -= dy * f;
    }

    for (const n of nodes) {
      const f = forces.get(n.id)!;
      const p = pos.get(n.id)!;
      p.x += f.x * cooling;
      p.y += f.y * cooling;
    }
  }

  return nodes.map((n) => ({ ...n, position: pos.get(n.id)! }));
}

function computeLayeredLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", ranksep: 140, nodesep: 60 });
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } };
  });
}

function computeDomainLayout(nodes: Node[]): Node[] {
  if (nodes.length === 0) return nodes;
  const COLS = 3;
  const CELL_W = 210;
  const CELL_H = 90;
  const PAD = 40;
  const LABEL_H = 36;
  const GAP = 32;

  const groups = new Map<string, Node[]>();
  for (const n of nodes) {
    const domain = (n.data as DependencyNodeData).domain ?? "No Domain";
    if (!groups.has(domain)) groups.set(domain, []);
    groups.get(domain)!.push(n);
  }

  const positioned: Node[] = [];
  let groupX = 0;

  for (const [, domNodes] of Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const cols = Math.min(domNodes.length, COLS);
    const rows = Math.ceil(domNodes.length / COLS);
    const gW = cols * CELL_W + PAD * 2;
    const gH = rows * CELL_H + PAD * 2 + LABEL_H;
    const domain = (domNodes[0].data as DependencyNodeData).domain ?? "No Domain";

    positioned.push({
      id: `group-${domain}`,
      type: "group",
      position: { x: groupX, y: 0 },
      style: { width: gW, height: gH, background: "rgba(100,116,139,0.04)", border: "1.5px dashed #e2e8f0", borderRadius: 12 },
      data: { label: domain },
      className: "dep-group-node",
      selectable: false,
      draggable: false,
    });

    domNodes.forEach((n, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      positioned.push({
        ...n,
        position: { x: PAD + col * CELL_W, y: LABEL_H + PAD + row * CELL_H },
        parentNode: `group-${domain}`,
        extent: "parent" as const,
        draggable: false,
      });
    });

    groupX += gW + GAP;
  }

  return positioned;
}

type AssetMeta = {
  id: string;
  name: string;
  shortCode: string | null;
  icon: string | null;
  domain: string | null;
  lifecycleStatus: string | null;
};

function buildGraph(
  deps: AssetDependency[],
  assetMeta: Map<string, AssetMeta>
): { nodes: Node<DependencyNodeData>[]; edges: Edge<DependencyEdgeData>[] } {
  const seenNodes = new Set<string>();
  const nodes: Node<DependencyNodeData>[] = [];

  function addNode(assetId: string) {
    if (seenNodes.has(assetId)) return;
    seenNodes.add(assetId);
    const meta = assetMeta.get(assetId);
    nodes.push({
      id: assetId,
      type: "dependencyNode",
      position: { x: 0, y: 0 },
      data: {
        name: meta?.name ?? assetId,
        shortCode: meta?.shortCode ?? null,
        icon: meta?.icon ?? null,
        domain: meta?.domain ?? null,
        lifecycleStatus: meta?.lifecycleStatus ?? null,
      },
    });
  }

  deps.forEach((d) => { addNode(d.sourceAssetId); addNode(d.targetAssetId); });

  const edges: Edge<DependencyEdgeData>[] = deps.map((d) => ({
    id: d.id,
    source: d.sourceAssetId,
    target: d.targetAssetId,
    type: "dependencyEdge",
    data: { type: d.type, direction: d.direction, notes: d.notes, dependencyId: d.id },
  }));

  return { nodes, edges };
}

type LayoutTab = "force" | "layered" | "domain";

export default function DependenciesPage() {
  const router = useRouter();
  const { user, canWrite } = useAuth();

  const [deps, setDeps] = useState<AssetDependency[]>([]);
  const [assetMeta, setAssetMeta] = useState<Map<string, AssetMeta>>(new Map());
  const [allAssets, setAllAssets] = useState<{ id: string; name: string; shortCode: string | null }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [layoutTab, setLayoutTab] = useState<LayoutTab>("force");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DependencyConnectionType | "">("");
  const [domainFilter, setDomainFilter] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [depsRes, assetsRes] = await Promise.all([
        fetch("/api/dependencies"),
        fetch("/api/assets"),
      ]);
      const [depsData, assetsData] = await Promise.all([depsRes.json(), assetsRes.json()]);
      if (!depsRes.ok) throw new Error(depsData.error ?? "Failed to load dependencies.");
      setDeps(depsData.dependencies ?? []);
      const meta = new Map<string, AssetMeta>();
      for (const a of assetsData.assets ?? []) {
        meta.set(a.id, {
          id: a.id,
          name: a.name,
          shortCode: a.shortCode ?? null,
          icon: a.icon ?? null,
          domain: a.domainName ?? null,
          lifecycleStatus: a.lifecycleStatus ?? null,
        });
      }
      setAssetMeta(meta);
      setAllAssets((assetsData.assets ?? []).map((a: { id: string; name: string; shortCode: string | null }) => ({
        id: a.id,
        name: a.name,
        shortCode: a.shortCode ?? null,
      })));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const domains = useMemo(() => {
    const s = new Set<string>();
    assetMeta.forEach((a) => { if (a.domain) s.add(a.domain); });
    return Array.from(s).sort();
  }, [assetMeta]);

  const filteredDeps = useMemo(() => {
    return deps.filter((d) => {
      if (typeFilter && d.type !== typeFilter) return false;
      if (domainFilter) {
        const srcDomain = assetMeta.get(d.sourceAssetId)?.domain;
        const tgtDomain = assetMeta.get(d.targetAssetId)?.domain;
        if (srcDomain !== domainFilter && tgtDomain !== domainFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const srcName = assetMeta.get(d.sourceAssetId)?.name?.toLowerCase() ?? "";
        const tgtName = assetMeta.get(d.targetAssetId)?.name?.toLowerCase() ?? "";
        if (!srcName.includes(q) && !tgtName.includes(q)) return false;
      }
      return true;
    });
  }, [deps, typeFilter, domainFilter, search, assetMeta]);

  useEffect(() => {
    const { nodes: rawNodes, edges: rawEdges } = buildGraph(filteredDeps, assetMeta);

    let layoutNodes: Node<DependencyNodeData>[];
    if (layoutTab === "force") {
      layoutNodes = computeForceLayout(rawNodes, rawEdges) as Node<DependencyNodeData>[];
    } else if (layoutTab === "layered") {
      layoutNodes = computeLayeredLayout(rawNodes, rawEdges) as Node<DependencyNodeData>[];
    } else {
      layoutNodes = computeDomainLayout(rawNodes) as Node<DependencyNodeData>[];
    }

    setNodes(layoutNodes);
    setEdges(rawEdges);
    setSelectedEdgeId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredDeps, layoutTab, assetMeta]);

  const selectedDep = selectedEdgeId
    ? deps.find((d) => d.id === selectedEdgeId) ?? null
    : null;

  const nodesDraggable = layoutTab === "force";

  const CONN_TYPES: DependencyConnectionType[] = [
    "API", "Database", "File Transfer", "Event / Message", "UI Embed", "Other",
  ];
  const selectCls = "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200";

  return (
    <div className="flex flex-col gap-0" style={{ height: "calc(100vh - 130px)", minHeight: 500 }}>

      <div className="flex flex-wrap items-center gap-2 rounded-t-xl border border-b-0 border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets…"
            className="h-9 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 w-44 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-500"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <select className={selectCls} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as DependencyConnectionType | "")}>
          <option value="">All types</option>
          {CONN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <select className={selectCls} value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}>
          <option value="">All domains</option>
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        <div className="flex-1" />

        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
          {(["force", "layered", "domain"] as LayoutTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setLayoutTab(tab)}
              className={[
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                layoutTab === tab
                  ? "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
              ].join(" ")}
            >
              {tab === "force" ? "Force" : tab === "layered" ? "Layered" : "Domain"}
            </button>
          ))}
        </div>

        {canWrite && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Add Dependency
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden rounded-b-xl border border-slate-200 dark:border-slate-700">
        <div className={`flex-1 ${selectedDep ? "mr-0" : ""}`}>
          {isLoading ? (
            <div className="flex h-full items-center justify-center bg-white dark:bg-slate-900">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
            </div>
          ) : fetchError ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-white dark:bg-slate-900 text-red-500">
              <p className="text-sm">{fetchError}</p>
              <button onClick={fetchAll} className="text-xs underline">Retry</button>
            </div>
          ) : filteredDeps.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900">
              <Network className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                {deps.length === 0 ? "No dependencies yet" : "No results match your filters"}
              </p>
              {deps.length === 0 && canWrite && (
                <button
                  onClick={() => setAddOpen(true)}
                  className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline dark:text-brand-400"
                >
                  <Plus className="h-3.5 w-3.5" /> Add the first dependency
                </button>
              )}
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodesDraggable={nodesDraggable}
              nodesConnectable={false}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              onNodeClick={(_e, node) => {
                if (!node.id.startsWith("group-")) {
                  router.push(`/assets/${node.id}`);
                }
              }}
              onEdgeClick={(_e, edge) => {
                setSelectedEdgeId((prev) => (prev === edge.id ? null : edge.id));
              }}
              onPaneClick={() => setSelectedEdgeId(null)}
              className="bg-slate-50 dark:bg-slate-950"
            >
              <Background color="#e2e8f0" className="dark:[&_line]:stroke-slate-800" />
              <Controls className="dark:[&_button]:bg-slate-800 dark:[&_button]:text-slate-200 dark:[&_button]:border-slate-700" />
              <MiniMap
                nodeColor={(n) => {
                  if (n.id.startsWith("group-")) return "transparent";
                  return "#6366f1";
                }}
                className="dark:bg-slate-900 dark:[&_.react-flow__minimap-mask]:fill-slate-950/60"
              />
            </ReactFlow>
          )}
        </div>

        {selectedDep && user && canWrite && (
          <div className="w-80 flex-shrink-0">
            <DependencyPanel
              dependency={selectedDep}
              onClose={() => setSelectedEdgeId(null)}
              onUpdated={() => { fetchAll(); setSelectedEdgeId(null); }}
              onDeleted={() => { fetchAll(); setSelectedEdgeId(null); }}
              userId={user.id}
              userName={user.name}
            />
          </div>
        )}
      </div>

      {canWrite && user && (
        <AddDependencyModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onCreated={fetchAll}
          allAssets={allAssets}
          userId={user.id}
          userName={user.name}
        />
      )}
    </div>
  );
}
