"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ExternalLink, Pencil, Trash2,
  AlertTriangle, ChevronDown, ChevronUp,
  FolderKanban, ArrowDownToLine, ArrowUpFromLine,
  GitBranch, CloudUpload, FileCode2, Network, Plus,
} from "lucide-react";
import ReactFlow, { Node, Edge, NodeTypes, EdgeTypes, Background, useNodesState, useEdgesState } from "reactflow";
import "reactflow/dist/style.css";
import { AssetDependency, DependencyConnectionType } from "@/types";
import DependencyNode, { DependencyNodeData } from "@/components/dependencies/DependencyNode";
import DependencyEdge, { DependencyEdgeData } from "@/components/dependencies/DependencyEdge";
import AddDependencyModal from "@/components/dependencies/AddDependencyModal";
import DependencyPanel from "@/components/dependencies/DependencyPanel";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import AssetModal, { AssetFormState, AssetIcon } from "@/components/assets/AssetModal";
import { Asset, AuditLog, AssetComplexity, AssetStrategy, AssetType, BusinessCapability, Department, Diagram, Domain, IndustrySector, LifecycleStatus, Tier, User, Vendor } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Badge styles (duplicated from list page — could be shared in future)
// ─────────────────────────────────────────────────────────────────────────────
const LIFECYCLE_STYLES: Record<LifecycleStatus, string> = {
  Proposed:         "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  Approved:         "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "In Development": "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Production:       "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Sunset:           "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Retired:          "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const TYPE_STYLES: Record<AssetType, string> = {
  SaaS:           "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  "On-Premise":   "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Hybrid:         "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  Cloud:          "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  "Open Source":  "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Other:          "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const ACTION_STYLES = {
  CREATE: "bg-emerald-50 text-emerald-700",
  UPDATE: "bg-amber-50 text-amber-700",
  DELETE: "bg-red-50 text-red-600",
};

const TYPE_BADGE: Record<DependencyConnectionType, string> = {
  'API':             'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Database':        'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'File Transfer':   'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'Event / Message': 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'UI Embed':        'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  'Other':           'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

// ─────────────────────────────────────────────────────────────────────────────
// Reusable layout primitives
// Adding a new field in future = one <Field> line inside any <Section>
// ─────────────────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      </div>
      <dl className="divide-y divide-slate-100">{children}</dl>
    </div>
  );
}

function Field({ label, value, fullWidth = false }: {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-start ${fullWidth ? "" : ""}`}>
      <dt className="w-full shrink-0 text-xs font-medium text-slate-400 sm:w-40">{label}</dt>
      <dd className="text-sm text-slate-800 break-words min-w-0">
        {value ?? <span className="italic text-slate-300">—</span>}
      </dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit diff helpers
// ─────────────────────────────────────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  name: "Name", shortCode: "Short Code", description: "Description",
  type: "Hosting Type", category: "Asset Category", icon: "Icon",
  lifecycleStatus: "Lifecycle Status",
  departmentId: "Department ID", departmentIds: "Departments",
  strategyId: "Strategy", domainId: "Domain", businessOwner: "Business Owner",
  technicalOwner: "Technical Owner", vendor: "Vendor", vendorId: "Vendor",
  slaAvailability: "Availability SLA", slaRto: "RTO", slaRpo: "RPO",
  goLiveDate: "Go Live Date", retirementDate: "Retirement Date",
  contractEndDate: "Contract End Date", contractAmount: "Contract Amount",
  appUrl: "Application URL", docUrl: "Documentation URL", notes: "Notes",
};

interface FieldDiff {
  field: string;
  label: string;
  from: unknown;
  to: unknown;
}

function getDiff(
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null
): FieldDiff[] {
  if (!oldValues || !newValues) return [];
  const seen = new Set<string>();
  const keys = [...Object.keys(oldValues), ...Object.keys(newValues)].filter((k) => {
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return keys
    .filter((k) => JSON.stringify(oldValues[k]) !== JSON.stringify(newValues[k]))
    .map((k) => ({
      field: k,
      label: FIELD_LABELS[k] ?? k,
      from: oldValues[k],
      to: newValues[k],
    }));
}

function AuditRow({ entry }: { entry: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const diff = getDiff(entry.oldValues, entry.newValues);
  const hasDiff = entry.action === "UPDATE" && diff.length > 0;

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors">
        <td className="px-4 py-3 whitespace-nowrap">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ACTION_STYLES[entry.action]}`}>
            {entry.action}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-slate-700">{entry.performedByName}</td>
        <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
          {new Date(entry.performedAt).toLocaleString("en-GB", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </td>
        <td className="px-4 py-3 text-sm text-slate-500">
          {entry.action === "CREATE" && "Record created"}
          {entry.action === "DELETE" && "Record deleted"}
          {entry.action === "UPDATE" && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 text-brand-600 hover:underline"
            >
              {diff.length} field{diff.length !== 1 ? "s" : ""} changed
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </td>
      </tr>
      {hasDiff && expanded && (
        <tr>
          <td colSpan={4} className="px-4 pb-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 w-36">Field</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">Before</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {diff.map((d) => (
                    <tr key={d.field}>
                      <td className="px-3 py-2 font-medium text-slate-600">{d.label}</td>
                      <td className="px-3 py-2 text-red-600 line-through break-all">
                        {d.from != null && d.from !== "" ? String(d.from) : <span className="no-underline italic text-slate-400 no-line-through" style={{textDecoration:"none"}}>empty</span>}
                      </td>
                      <td className="px-3 py-2 text-emerald-700 break-all">
                        {d.to != null && d.to !== "" ? String(d.to) : <span className="italic text-slate-400">empty</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// React Flow node / edge type registries — must be module-level (not in render)
// ─────────────────────────────────────────────────────────────────────────────
const DEP_NODE_TYPES: NodeTypes = { dependencyNode: DependencyNode };
const DEP_EDGE_TYPES: EdgeTypes = { dependencyEdge: DependencyEdge };

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, canWrite } = useAuth();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [strategies, setStrategies] = useState<AssetStrategy[]>([]);
  const [complexities, setComplexities] = useState<AssetComplexity[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [capabilities, setCapabilities] = useState<BusinessCapability[]>([]);
  const [sectors, setSectors] = useState<IndustrySector[]>([]);
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [activeProjects, setActiveProjects] = useState<{
    id: string; name: string; status: string;
    startDate: string | null; endDate: string | null;
    dependencyType: string; notes: string | null;
  }[]>([]);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [assetDiagrams, setAssetDiagrams] = useState<Pick<Diagram, "id" | "name" | "latestVersion" | "assetCount" | "updatedAt">[]>([]);
  const [assetPlantUMLDiagrams, setAssetPlantUMLDiagrams] = useState<{
    id: string; name: string; updatedAt: string; latestVersion: number; matchedOn: string;
  }[]>([]);
  const [depData, setDepData] = useState<{ downstream: AssetDependency[]; upstream: AssetDependency[] }>({
    downstream: [], upstream: [],
  });
  const [depNodes, setDepNodes, onDepNodesChange] = useNodesState<DependencyNodeData>([]);
  const [depEdges, setDepEdges, onDepEdgesChange] = useEdgesState<DependencyEdgeData>([]);
  const [depAddOpen, setDepAddOpen] = useState(false);
  const [depDeleteId, setDepDeleteId] = useState<string | null>(null);
  const [isDeletingDep, setIsDeletingDep] = useState(false);
  const [editingDep, setEditingDep] = useState<AssetDependency | null>(null);
  const [allAssets, setAllAssets] = useState<Pick<Asset, "id" | "name" | "shortCode">[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Confluence push modal
  const [confluenceOpen, setConfluenceOpen] = useState(false);
  const [confluencePageTitle, setConfluencePageTitle] = useState("");
  const [confluenceParentPageId, setConfluenceParentPageId] = useState("");
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ url: string; title: string } | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [assetRes, historyRes, deptsRes, strategiesRes, complexitiesRes, domainsRes, tiersRes, vendorsRes, usersRes, projectsRes, capsRes, sectorsRes, diagramsRes, plantumlDiagramsRes, depRes, allAssetsRes, allDiagramsRes] = await Promise.all([
        fetch(`/api/assets/${id}`),
        fetch(`/api/assets/${id}/history`),
        fetch("/api/organisations"),
        fetch("/api/asset-strategy"),
        fetch("/api/asset-complexity"),
        fetch("/api/domains"),
        fetch("/api/tiers"),
        fetch("/api/vendors"),
        fetch("/api/users"),
        fetch(`/api/assets/${id}/projects`),
        fetch("/api/business-capabilities"),
        fetch("/api/industry-sectors"),
        fetch(`/api/assets/${id}/diagrams`),
        fetch(`/api/assets/${id}/plantuml-diagrams`),
        fetch(`/api/assets/${id}/dependencies`),
        fetch("/api/assets"),
        fetch("/api/diagrams"),
      ]);
      if (!assetRes.ok) {
        const d = await assetRes.json();
        throw new Error(d.error ?? "Asset not found.");
      }
      const [assetData, historyData, deptsData, strategiesData, complexitiesData, domainsData, tiersData, vendorsData, usersData, projectsData, capsData, sectorsData, diagramsData, plantumlDiagramsData, depDataResult, allAssetsData, allDiagramsData] = await Promise.all([
        assetRes.json(),
        historyRes.json(),
        deptsRes.json(),
        strategiesRes.json(),
        complexitiesRes.json(),
        domainsRes.json(),
        tiersRes.json(),
        vendorsRes.json(),
        usersRes.json(),
        projectsRes.json(),
        capsRes.json(),
        sectorsRes.json(),
        diagramsRes.json(),
        plantumlDiagramsRes.json(),
        depRes.json(),
        allAssetsRes.json(),
        allDiagramsRes.json(),
      ]);
      setAsset(assetData.asset);
      setHistory(historyData.history ?? []);
      setDepartments(deptsData.departments ?? []);
      setStrategies(strategiesData.strategies ?? []);
      setComplexities(complexitiesData.complexities ?? []);
      setDomains(domainsData.domains ?? []);
      setTiers(tiersData.tiers ?? []);
      setVendors(vendorsData.vendors ?? []);
      setUsers(usersData.users ?? []);
      setActiveProjects(projectsData.projects ?? []);
      setCapabilities(capsData.capabilities ?? []);
      setSectors(sectorsData.sectors ?? []);
      setDiagrams(allDiagramsData.diagrams ?? []);
      setAssetDiagrams(diagramsData.diagrams ?? []);
      setAssetPlantUMLDiagrams(plantumlDiagramsData.diagrams ?? []);
      const downstream: AssetDependency[] = depDataResult.downstream ?? [];
      const upstream: AssetDependency[] = depDataResult.upstream ?? [];
      setDepData({ downstream, upstream });
      setAllAssets(allAssetsData.assets ?? []);
      buildDepMiniMap(downstream, upstream, id, assetData.asset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Section diagrams: hero pinned first, then linked diagrams (deduped) ──
  // Must run before any early return below — Hooks can't be called conditionally.
  const sectionDiagrams = useMemo(() => {
    if (!asset) return assetDiagrams;
    const heroId = asset.heroDiagramId;
    if (!heroId) return assetDiagrams;
    const linkedIds = new Set(assetDiagrams.map((d) => d.id));
    const heroInLinked = linkedIds.has(heroId);
    const heroFromAll = !heroInLinked ? diagrams.find((d) => d.id === heroId) : null;
    const nonHero = assetDiagrams.filter((d) => d.id !== heroId);
    const heroEntry = heroInLinked
      ? assetDiagrams.find((d) => d.id === heroId)!
      : heroFromAll
        ? { id: heroFromAll.id, name: heroFromAll.name, latestVersion: heroFromAll.latestVersion, assetCount: heroFromAll.assetCount, updatedAt: heroFromAll.updatedAt }
        : null;
    return heroEntry ? [heroEntry, ...nonHero] : assetDiagrams;
  }, [asset, assetDiagrams, diagrams]);

  // ── Dependency mini-map builder ───────────────────────────────────────────
  function buildDepMiniMap(
    downstream: AssetDependency[],
    upstream: AssetDependency[],
    currentId: string,
    currentAsset: { name: string; icon: string | null; shortCode: string | null; lifecycleStatus: string; domainName: string | null }
  ) {
    const miniNodes: Node<DependencyNodeData>[] = [];
    const miniEdges: Edge<DependencyEdgeData>[] = [];
    const seenIds = new Set<string>();
    const upstreamX = -240;
    const centerX = 0;
    const downstreamX = 240;

    miniNodes.push({
      id: currentId,
      type: "dependencyNode",
      position: { x: centerX - 95, y: 0 },
      data: {
        name: currentAsset.name,
        shortCode: currentAsset.shortCode,
        icon: currentAsset.icon,
        domain: currentAsset.domainName ?? null,
        lifecycleStatus: currentAsset.lifecycleStatus,
        isCenter: true,
      },
    });
    seenIds.add(currentId);

    const downstreamUniq = downstream.filter((d) => {
      const otherId = d.sourceAssetId === currentId ? d.targetAssetId : d.sourceAssetId;
      return !seenIds.has(otherId);
    });
    downstreamUniq.forEach((d, i) => {
      const otherId = d.sourceAssetId === currentId ? d.targetAssetId : d.sourceAssetId;
      const otherName = d.sourceAssetId === currentId ? d.targetAssetName : d.sourceAssetName;
      const otherIcon = d.sourceAssetId === currentId ? d.targetAssetIcon : d.sourceAssetIcon;
      const otherDomain = d.sourceAssetId === currentId ? d.targetAssetDomain : d.sourceAssetDomain;
      seenIds.add(otherId);
      miniNodes.push({
        id: otherId, type: "dependencyNode",
        position: { x: downstreamX - 95, y: i * 80 - ((downstreamUniq.length - 1) * 80) / 2 },
        data: { name: otherName, shortCode: null, icon: otherIcon, domain: otherDomain, lifecycleStatus: null },
      });
      miniEdges.push({
        id: `down-${d.id}`, source: currentId, target: otherId, type: "dependencyEdge",
        data: { type: d.type, direction: d.direction, notes: d.notes, dependencyId: d.id },
      });
    });

    const upstreamUniq = upstream.filter((d) => {
      const otherId = d.targetAssetId === currentId ? d.sourceAssetId : d.targetAssetId;
      return !seenIds.has(otherId);
    });
    upstreamUniq.forEach((d, i) => {
      const otherId = d.targetAssetId === currentId ? d.sourceAssetId : d.targetAssetId;
      const otherName = d.targetAssetId === currentId ? d.sourceAssetName : d.targetAssetName;
      const otherIcon = d.targetAssetId === currentId ? d.sourceAssetIcon : d.targetAssetIcon;
      const otherDomain = d.targetAssetId === currentId ? d.sourceAssetDomain : d.targetAssetDomain;
      seenIds.add(otherId);
      miniNodes.push({
        id: otherId, type: "dependencyNode",
        position: { x: upstreamX - 95, y: i * 80 - ((upstreamUniq.length - 1) * 80) / 2 },
        data: { name: otherName, shortCode: null, icon: otherIcon, domain: otherDomain, lifecycleStatus: null },
      });
      miniEdges.push({
        id: `up-${d.id}`, source: otherId, target: currentId, type: "dependencyEdge",
        data: { type: d.type, direction: d.direction, notes: d.notes, dependencyId: d.id },
      });
    });

    setDepNodes(miniNodes);
    setDepEdges(miniEdges);
  }

  // ── Delete dependency ─────────────────────────────────────────────────────
  async function handleDeleteDep(depId: string) {
    if (!user) return;
    setIsDeletingDep(true);
    try {
      const res = await fetch(`/api/dependencies/${depId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, userName: user.name }),
      });
      if (res.ok) {
        setDepDeleteId(null);
        await fetchAll();
      }
    } finally {
      setIsDeletingDep(false);
    }
  }

  // ── Save (edit) ───────────────────────────────────────────────────────────
  async function handleSave(form: AssetFormState) {
    if (!user) return;
    const res = await fetch(`/api/assets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, userId: user.id, userName: user.name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed.");
    setEditOpen(false);
    await fetchAll();
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!user || !asset) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/assets/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, userName: user.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      router.push("/assets");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "An error occurred.");
      setIsDeleting(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmtDate(iso: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  }

  function fmtDateTime(iso: string) {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  // ── Loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
        <AlertTriangle className="h-8 w-8 text-red-400" />
        <p>{error ?? "Asset not found."}</p>
        <Link href="/assets">
          <Button variant="secondary" size="sm"><ArrowLeft className="h-4 w-4" /> Back to registry</Button>
        </Link>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Back link */}
      <Link href="/assets" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Asset Registry
      </Link>

      {/* ── Hero card ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100">
              <AssetIcon name={asset.icon ?? ''} className="h-6 w-6 text-slate-500" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{asset.name}</h1>
                {asset.shortCode && (
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-sm text-slate-500">
                    {asset.shortCode}
                  </span>
                )}
                {asset.appUrl && (
                  <a href={asset.appUrl} target="_blank" rel="noopener noreferrer"
                    className="text-slate-400 hover:text-brand-600"
                    title="Open application"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LIFECYCLE_STYLES[asset.lifecycleStatus]}`}>
                  {asset.lifecycleStatus}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_STYLES[asset.type]}`}>
                  {asset.type}
                </span>
                {asset.departmentNames.length > 0 && (
                  <span className="text-xs text-slate-400">
                    {asset.departmentNames.join(", ")}
                  </span>
                )}
              </div>
              {asset.vendorName && (
                <p className="mt-1 text-sm text-slate-500">{asset.vendorName}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {canWrite && (
              <>
                <Button variant="secondary" size="sm" onClick={() => {
                  setConfluencePageTitle(asset.name);
                  setConfluenceParentPageId("");
                  setPushResult(null);
                  setPushError(null);
                  setConfluenceOpen(true);
                }}>
                  <CloudUpload className="h-4 w-4" /> Push to Confluence
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => { setDeleteOpen(true); setDeleteError(null); }}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Meta footer */}
        <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-4 text-xs text-slate-400">
          <span>Created by <span className="font-medium text-slate-600">{asset.createdByName}</span> on {fmtDate(asset.createdAt)}</span>
          <span>Last modified <span className="font-medium text-slate-600">{fmtDateTime(asset.updatedAt)}</span></span>
        </div>
      </div>

      {/* ── Detail grid ────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Basic Information */}
        <Section title="Basic Information">
          <Field label="Description"    value={asset.description} fullWidth />
          <Field label="Asset category" value={asset.category} />
          <Field label="Hosting type"   value={asset.type} />
          <Field label="Lifecycle"      value={asset.lifecycleStatus} />
          <Field label="Short code"     value={asset.shortCode} />
          {/* ↑ Add new basic fields here in future */}
        </Section>

        {/* Ownership */}
        <Section title="Ownership">
          <Field
            label="Departments"
            value={asset.departmentNames.length > 0 ? asset.departmentNames.join(", ") : null}
          />
          <Field
            label="Architects"
            value={asset.architectNames.length > 0 ? asset.architectNames.join(", ") : null}
          />
          <Field
            label="Business Capabilities"
            value={asset.capabilityNames.length > 0 ? asset.capabilityNames.join(", ") : null}
          />
          <Field label="Business owner"  value={asset.businessOwner} />
          <Field label="Technical owner" value={asset.technicalOwner} />
          <Field label="Strategy"         value={asset.strategyName} />
          <Field label="Domain"           value={asset.domainName} />
          <Field label="Tier"             value={asset.tierName} />
          <Field label="Vendor"          value={asset.vendorName} />
          {/* ↑ Add new ownership fields here in future */}
        </Section>

        {/* SLA & Dates */}
        <Section title="SLA &amp; Dates">
          <Field label="Availability SLA" value={asset.slaAvailability} />
          <Field label="RTO"               value={asset.slaRto} />
          <Field label="RPO"               value={asset.slaRpo} />
          <Field label="Go live date"       value={fmtDate(asset.goLiveDate)} />
          <Field label="Retirement date"   value={fmtDate(asset.retirementDate)} />
          <Field label="Contract end date" value={fmtDate(asset.contractEndDate)} />
          <Field
            label="Contract amount"
            value={asset.contractAmount != null
              ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(asset.contractAmount)
              : null}
          />
          {/* ↑ Add new SLA/date fields here in future */}
        </Section>

        {/* Links & Notes */}
        <Section title="Links &amp; Notes">
          <Field
            label="Application URL"
            value={asset.appUrl ? (
              <a href={asset.appUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-brand-600 hover:underline break-all"
              >
                {asset.appUrl} <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            ) : null}
          />
          <Field
            label="Documentation URL"
            value={asset.docUrl ? (
              <a href={asset.docUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-brand-600 hover:underline break-all"
              >
                {asset.docUrl} <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            ) : null}
          />
          <Field label="Notes" value={asset.notes} fullWidth />
          {/* ↑ Add new link/note fields here in future */}
        </Section>

      </div>

      {/* ── Active Projects ────────────────────────────────────────────────── */}
      {activeProjects.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-slate-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Projects</h2>
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {activeProjects.length} project{activeProjects.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {activeProjects.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50">
                  <FolderKanban className="h-4 w-4 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/projects/${p.id}`}
                    className="text-sm font-medium text-slate-900 hover:text-brand-600 transition-colors"
                  >
                    {p.name}
                  </Link>
                  {p.notes && (
                    <p className="mt-0.5 text-xs text-slate-400 truncate">{p.notes}</p>
                  )}
                </div>
                <span className={[
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium flex-shrink-0",
                  p.dependencyType === "upstream"
                    ? "bg-violet-50 text-violet-700"
                    : "bg-sky-50 text-sky-700",
                ].join(" ")}>
                  {p.dependencyType === "upstream"
                    ? <ArrowUpFromLine className="h-3 w-3" />
                    : <ArrowDownToLine className="h-3 w-3" />
                  }
                  {p.dependencyType}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Diagrams ───────────────────────────────────────────────────────── */}
      {(sectionDiagrams.length > 0 || asset.heroDiagramId) && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-slate-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Architecture Diagrams</h2>
            </div>
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
              {sectionDiagrams.length} diagram{sectionDiagrams.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {sectionDiagrams.map((d) => {
              const isHero = d.id === asset.heroDiagramId;
              return (
                <div key={d.id} className={`flex items-center gap-4 px-5 py-3 transition-colors ${isHero ? "bg-brand-50/40 hover:bg-brand-50" : "hover:bg-slate-50"}`}>
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${isHero ? "bg-brand-100" : "bg-brand-50"}`}>
                    <GitBranch className={`h-4 w-4 ${isHero ? "text-brand-600" : "text-brand-500"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/diagrams/${d.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-brand-600 transition-colors"
                      >
                        {d.name}
                      </Link>
                      {isHero && (
                        <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                          Main
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 shrink-0">
                    v{d.latestVersion}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0 hidden sm:block">
                    {new Date(d.updatedAt).toLocaleDateString("en-GB", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PlantUML Diagrams ─────────────────────────────────────────────── */}
      {assetPlantUMLDiagrams.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-5 py-3">
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-slate-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">PlantUML Diagrams</h2>
            </div>
            <span className="rounded-full bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-400">
              {assetPlantUMLDiagrams.length} diagram{assetPlantUMLDiagrams.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Diagram</th>
                  <th className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Version</th>
                  <th className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Matched by</th>
                  <th className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Last modified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {assetPlantUMLDiagrams.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3">
                      <Link
                        href={`/plantuml/${d.id}`}
                        className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                      >
                        <FileCode2 className="h-4 w-4 text-violet-500 flex-shrink-0" />
                        {d.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                        v{d.latestVersion}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {d.matchedOn === "short_code" ? "Short code" : "Name"}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {new Date(d.updatedAt).toLocaleDateString("en-GB", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Dependencies ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-5 py-3">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Dependencies
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              {depData.downstream.length + depData.upstream.length} connection{depData.downstream.length + depData.upstream.length !== 1 ? "s" : ""}
            </span>
            {canWrite && (
              <button
                onClick={() => setDepAddOpen(true)}
                className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            )}
          </div>
        </div>

        {(depData.downstream.length > 0 || depData.upstream.length > 0) && (
          <div className="border-b border-slate-100 dark:border-slate-800" style={{ height: 240 }}>
            <ReactFlow
              nodes={depNodes}
              edges={depEdges}
              nodeTypes={DEP_NODE_TYPES}
              edgeTypes={DEP_EDGE_TYPES}
              onNodesChange={onDepNodesChange}
              onEdgesChange={onDepEdgesChange}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              onNodeClick={(_e, node) => router.push(`/assets/${node.id}`)}
              className="bg-slate-50 dark:bg-slate-950"
            >
              <Background color="#e2e8f0" className="dark:[&_line]:stroke-slate-800" />
            </ReactFlow>
          </div>
        )}

        {depData.downstream.length > 0 && (
          <div>
            <div className="px-5 py-2 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Downstream - We depend on
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {depData.downstream.map((d) => {
                const otherId = d.sourceAssetId === id ? d.targetAssetId : d.sourceAssetId;
                const otherName = d.sourceAssetId === id ? d.targetAssetName : d.sourceAssetName;
                return (
                  <div key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <Link href={`/assets/${otherId}`} className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 truncate">
                      {otherName}
                    </Link>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[d.type]}`}>
                      {d.type}
                    </span>
                    <span className="text-xs text-slate-300 dark:text-slate-600">{d.direction}</span>
                    {d.notes && <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[120px]" title={d.notes}>{d.notes}</span>}
                    {canWrite && user && (
                      depDeleteId === d.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Delete?</span>
                          <button onClick={() => handleDeleteDep(d.id)} disabled={isDeletingDep} className="text-xs text-red-600 hover:underline dark:text-red-400 disabled:opacity-50">Yes</button>
                          <button onClick={() => setDepDeleteId(null)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">No</button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => setEditingDep(d)} className="text-slate-300 hover:text-brand-500 dark:text-slate-600 dark:hover:text-brand-400">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDepDeleteId(d.id)} className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {depData.upstream.length > 0 && (
          <div>
            <div className="px-5 py-2 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Upstream - Depends on us
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {depData.upstream.map((d) => {
                const otherId = d.targetAssetId === id ? d.sourceAssetId : d.targetAssetId;
                const otherName = d.targetAssetId === id ? d.sourceAssetName : d.targetAssetName;
                return (
                  <div key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <Link href={`/assets/${otherId}`} className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 truncate">
                      {otherName}
                    </Link>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[d.type]}`}>
                      {d.type}
                    </span>
                    <span className="text-xs text-slate-300 dark:text-slate-600">{d.direction}</span>
                    {d.notes && <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[120px]" title={d.notes}>{d.notes}</span>}
                    {canWrite && user && (
                      <button onClick={() => setEditingDep(d)} className="text-slate-300 hover:text-brand-500 dark:text-slate-600 dark:hover:text-brand-400">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {depData.downstream.length === 0 && depData.upstream.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400 dark:text-slate-500">
            <Network className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm">No dependencies recorded yet</p>
            {canWrite && (
              <button onClick={() => setDepAddOpen(true)} className="text-xs text-brand-600 hover:underline dark:text-brand-400">
                Add first dependency
              </button>
            )}
          </div>
        )}
      </div>

      {canWrite && user && (
        <AddDependencyModal
          open={depAddOpen}
          onClose={() => setDepAddOpen(false)}
          onCreated={fetchAll}
          allAssets={allAssets}
          lockedSourceAssetId={id}
          lockedSourceAssetName={asset.name}
          userId={user.id}
          userName={user.name}
        />
      )}

      {editingDep && canWrite && user && (
        <DependencyPanel
          dependency={editingDep}
          onClose={() => setEditingDep(null)}
          onUpdated={() => { setEditingDep(null); fetchAll(); }}
          onDeleted={() => { setEditingDep(null); fetchAll(); }}
          userId={user.id}
          userName={user.name ?? ""}
        />
      )}

      {/* ── Audit History ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Audit History</h2>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
            {history.length} event{history.length !== 1 ? "s" : ""}
          </span>
        </div>

        {history.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm italic text-slate-400">No audit events recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 w-24">Action</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Performed by</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date &amp; Time</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      <AssetModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        editing={asset}
        departments={departments}
        strategies={strategies}
        complexities={complexities}
        domains={domains}
        tiers={tiers}
        vendors={vendors}
        users={users}
        capabilities={capabilities}
        sectors={sectors}
        diagrams={diagrams}
        onSave={handleSave}
      />

      {/* ── Delete Modal ───────────────────────────────────────────────────── */}
      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Asset" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700">
                Are you sure you want to delete <span className="font-semibold">{asset.name}</span>?
                This will also remove all audit history for this asset.
              </p>
              {deleteError && <p className="mt-2 text-sm text-red-500">{deleteError}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" isLoading={isDeleting} onClick={handleDelete}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Confluence Push Modal ──────────────────────────────────────────── */}
      <Modal isOpen={confluenceOpen} onClose={() => setConfluenceOpen(false)} title="Push to Confluence" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          {pushResult ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20">
                  <CloudUpload className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    Page published successfully!
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{pushResult.title}</p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setConfluenceOpen(false)}>Close</Button>
                <a href={pushResult.url} target="_blank" rel="noopener noreferrer">
                  <Button>
                    <ExternalLink className="h-4 w-4" /> Open in Confluence
                  </Button>
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Page Title</label>
                  <input
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={confluencePageTitle}
                    onChange={(e) => setConfluencePageTitle(e.target.value)}
                    placeholder="Page title in Confluence"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Parent Page ID <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={confluenceParentPageId}
                    onChange={(e) => setConfluenceParentPageId(e.target.value)}
                    placeholder="Optional Confluence page ID"
                  />
                </div>
                {pushError && <p className="text-sm text-red-500">{pushError}</p>}
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setConfluenceOpen(false)}>Cancel</Button>
                <Button
                  isLoading={isPushing}
                  onClick={async () => {
                    if (!confluencePageTitle.trim()) return;
                    setIsPushing(true);
                    setPushError(null);
                    try {
                      // Render main diagram as PNG (client-side, non-fatal)
                      let diagramPng: string | null = null;
                      if (asset.heroDiagramId) {
                        try {
                          const dRes = await fetch(`/api/diagrams/${asset.heroDiagramId}`);
                          if (dRes.ok) {
                            const dData = await dRes.json();
                            const content: string = dData.diagram?.content ?? "";
                            if (content) {
                              const { exportDiagramPng } = await import("@/components/diagrams/exportDiagramPng");
                              diagramPng = await exportDiagramPng(content);
                            }
                          }
                        } catch {
                          // non-fatal — push without image
                        }
                      }
                      const res = await fetch("/api/confluence/push", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          assetId: id,
                          pageTitle: confluencePageTitle.trim(),
                          parentPageId: confluenceParentPageId.trim() || undefined,
                          diagramPng,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error ?? "Push failed.");
                      setPushResult({ url: data.url, title: data.title ?? confluencePageTitle });
                    } catch (err) {
                      setPushError(err instanceof Error ? err.message : "Push failed.");
                    } finally {
                      setIsPushing(false);
                    }
                  }}
                >
                  <CloudUpload className="h-4 w-4" /> Push
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

    </div>
  );
}
