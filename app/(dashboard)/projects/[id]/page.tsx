"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft, FolderKanban, Plus, Trash2, AlertTriangle,
  ArrowDownToLine, ArrowUpFromLine, Pencil, List, GitFork,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AssetIcon } from "@/components/assets/AssetModal";
import { Project, ProjectAsset, ProjectStatus, DependencyType } from "@/types";

const DependencyFlow = dynamic(() => import("@/components/projects/DependencyFlow"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STATUS_STYLES: Record<ProjectStatus, string> = {
  "Active":    "bg-emerald-50 text-emerald-700",
  "On Hold":   "bg-amber-50 text-amber-700",
  "Completed": "bg-blue-50 text-blue-700",
  "Cancelled": "bg-slate-100 text-slate-500",
};

const LIFECYCLE_STYLES: Record<string, string> = {
  Proposed:         "bg-slate-100 text-slate-600",
  Approved:         "bg-blue-50 text-blue-700",
  "In Development": "bg-amber-50 text-amber-700",
  Production:       "bg-emerald-50 text-emerald-700",
  Sunset:           "bg-orange-50 text-orange-700",
  Retired:          "bg-red-50 text-red-600",
};

// ---------------------------------------------------------------------------
// Link Asset Modal
// ---------------------------------------------------------------------------
interface AvailableAsset { id: string; name: string; type: string; icon: string | null; lifecycleStatus: string; }

function LinkAssetModal({
  isOpen, onClose, projectId, linkedAssetIds, onLinked,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  linkedAssetIds: Set<string>;
  onLinked: () => void;
}) {
  const [assets, setAssets] = useState<AvailableAsset[]>([]);
  const [selected, setSelected] = useState("");
  const [depType, setDepType] = useState<DependencyType>("downstream");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setSelected(""); setDepType("downstream"); setNotes(""); setError("");
    fetch("/api/assets")
      .then((r) => r.json())
      .then((d) => setAssets((d.assets ?? []).filter((a: AvailableAsset) => !linkedAssetIds.has(a.id))))
      .catch(() => {});
  }, [isOpen, linkedAssetIds]);

  async function handleSubmit() {
    if (!selected) { setError("Please select an asset."); return; }
    setError(""); setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: selected, dependencyType: depType, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to link asset.");
      onLinked();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setIsSaving(false); }
  }

  const fieldCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Link Asset" maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Asset</label>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className={fieldCls}>
            <option value="">— Select an asset —</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Dependency type</label>
          <div className="grid grid-cols-2 gap-2">
            {(["downstream", "upstream"] as DependencyType[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDepType(d)}
                className={[
                  "flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  depType === d
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                ].join(" ")}
              >
                {d === "downstream"
                  ? <ArrowDownToLine className="h-4 w-4 flex-shrink-0" />
                  : <ArrowUpFromLine className="h-4 w-4 flex-shrink-0" />
                }
                <span className="capitalize">{d}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {depType === "downstream"
              ? "This project produces outputs that this asset consumes or depends on."
              : "This asset feeds data or services that this project consumes."}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 resize-none"
            placeholder="Describe the relationship…"
          />
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button isLoading={isSaving} onClick={handleSubmit}>Link asset</Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Edit dependency modal
// ---------------------------------------------------------------------------
function EditLinkModal({
  isOpen, onClose, projectId, asset, onUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  asset: ProjectAsset | null;
  onUpdated: () => void;
}) {
  const [depType, setDepType] = useState<DependencyType>("downstream");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && asset) {
      setDepType(asset.dependencyType);
      setNotes(asset.notes ?? "");
      setError("");
    }
  }, [isOpen, asset]);

  async function handleSubmit() {
    setError(""); setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/assets/${asset!.assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependencyType: depType, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update.");
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setIsSaving(false); }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit — ${asset?.assetName ?? ""}`} maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Dependency type</label>
          <div className="grid grid-cols-2 gap-2">
            {(["downstream", "upstream"] as DependencyType[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDepType(d)}
                className={[
                  "flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  depType === d
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                ].join(" ")}
              >
                {d === "downstream"
                  ? <ArrowDownToLine className="h-4 w-4 flex-shrink-0" />
                  : <ArrowUpFromLine className="h-4 w-4 flex-shrink-0" />
                }
                <span className="capitalize">{d}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 resize-none"
          />
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button isLoading={isSaving} onClick={handleSubmit}>Save changes</Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Asset row
// ---------------------------------------------------------------------------
function AssetRow({
  pa, projectId, onRemove, onEdit,
}: {
  pa: ProjectAsset;
  projectId: string;
  onRemove: (assetId: string) => void;
  onEdit: (pa: ProjectAsset) => void;
}) {
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    try {
      await fetch(`/api/projects/${projectId}/assets/${pa.assetId}`, { method: "DELETE" });
      onRemove(pa.assetId);
    } finally { setRemoving(false); }
  }

  const isUpstream = pa.dependencyType === "upstream";

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <AssetIcon name={pa.assetIcon ?? "Server"} className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/assets/${pa.assetId}`} className="text-sm font-medium text-slate-900 hover:text-brand-600 transition-colors">
            {pa.assetName}
          </Link>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${LIFECYCLE_STYLES[pa.lifecycleStatus] ?? "bg-slate-100 text-slate-500"}`}>
            {pa.lifecycleStatus}
          </span>
          {pa.tierName && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              {pa.tierName}
            </span>
          )}
        </div>
        {pa.notes && <p className="mt-0.5 text-xs text-slate-400 truncate">{pa.notes}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={[
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
          isUpstream ? "bg-violet-50 text-violet-700" : "bg-sky-50 text-sky-700",
        ].join(" ")}>
          {isUpstream
            ? <ArrowUpFromLine className="h-3 w-3" />
            : <ArrowDownToLine className="h-3 w-3" />
          }
          {pa.dependencyType}
        </span>
        <button
          onClick={() => onEdit(pa)}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label="Edit dependency"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleRemove}
          disabled={removing}
          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
          aria-label={`Remove ${pa.assetName}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [view, setView] = useState<"list" | "flow">("list");
  const [linkOpen, setLinkOpen] = useState(false);
  const [editLink, setEditLink] = useState<ProjectAsset | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const [projRes, assetsRes] = await Promise.all([
        fetch("/api/projects"),
        fetch(`/api/projects/${id}/assets`),
      ]);
      const projData = await projRes.json();
      const assetsData = await assetsRes.json();
      if (!projRes.ok) throw new Error(projData.error ?? "Failed to load project.");
      if (!assetsRes.ok) throw new Error(assetsData.error ?? "Failed to load assets.");
      const found = (projData.projects as Project[]).find((p) => p.id === id) ?? null;
      setProject(found);
      setAssets(assetsData.assets);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function handleRemove(assetId: string) {
    setAssets((prev) => prev.filter((a) => a.assetId !== assetId));
  }

  const linkedIds = new Set(assets.map((a) => a.assetId));
  const upstream = assets.filter((a) => a.dependencyType === "upstream");
  const downstream = assets.filter((a) => a.dependencyType === "downstream");

  function fmtDate(d: string | null) {
    if (!d) return "—";
    return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (fetchError || !project) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-red-500">
        <AlertTriangle className="h-6 w-6" />
        <p className="text-sm">{fetchError ?? "Project not found."}</p>
        <Button variant="secondary" size="sm" onClick={fetchAll}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      {/* Hero */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-start gap-5 p-6">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50">
            <FolderKanban className="h-7 w-7 text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">{project.name}</h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[project.status]}`}>
                {project.status}
              </span>
            </div>
            {project.description && (
              <p className="mt-1 text-sm text-slate-500">{project.description}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
              <span>Start: <span className="text-slate-600 font-medium">{fmtDate(project.startDate)}</span></span>
              <span>End: <span className="text-slate-600 font-medium">{fmtDate(project.endDate)}</span></span>
              <span>Created by: <span className="text-slate-600 font-medium">{project.createdByName}</span></span>
              <span><span className="text-slate-600 font-medium">{project.assetCount}</span> linked asset{project.assetCount !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Dependencies */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Asset Dependencies</h2>
            <p className="text-xs text-slate-400 mt-0.5">Assets this project consumes (upstream) or produces outputs for (downstream).</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
              <button
                onClick={() => setView("list")}
                className={[
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  view === "list"
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                <List className="h-3.5 w-3.5" /> List
              </button>
              <button
                onClick={() => setView("flow")}
                className={[
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  view === "flow"
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                <GitFork className="h-3.5 w-3.5" /> Flow
              </button>
            </div>
            <Button size="sm" onClick={() => setLinkOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Link asset
            </Button>
          </div>
        </div>

        {assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
            <FolderKanban className="h-8 w-8 text-slate-200" />
            <p className="text-sm">No assets linked yet.</p>
            <Button size="sm" variant="secondary" onClick={() => setLinkOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Link first asset
            </Button>
          </div>
        ) : view === "flow" ? (
          <DependencyFlow project={project} assets={assets} />
        ) : (
          <div className="divide-y divide-slate-100">
            {upstream.length > 0 && (
              <>
                <div className="flex items-center gap-2 bg-violet-50/60 px-5 py-2">
                  <ArrowUpFromLine className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                    Upstream — {upstream.length} asset{upstream.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {upstream.map((pa) => (
                  <AssetRow
                    key={pa.assetId}
                    pa={pa}
                    projectId={project.id}
                    onRemove={handleRemove}
                    onEdit={setEditLink}
                  />
                ))}
              </>
            )}
            {downstream.length > 0 && (
              <>
                <div className="flex items-center gap-2 bg-sky-50/60 px-5 py-2">
                  <ArrowDownToLine className="h-3.5 w-3.5 text-sky-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-sky-600">
                    Downstream — {downstream.length} asset{downstream.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {downstream.map((pa) => (
                  <AssetRow
                    key={pa.assetId}
                    pa={pa}
                    projectId={project.id}
                    onRemove={handleRemove}
                    onEdit={setEditLink}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Link modal */}
      <LinkAssetModal
        isOpen={linkOpen}
        onClose={() => setLinkOpen(false)}
        projectId={project.id}
        linkedAssetIds={linkedIds}
        onLinked={fetchAll}
      />

      {/* Edit link modal */}
      <EditLinkModal
        isOpen={!!editLink}
        onClose={() => setEditLink(null)}
        projectId={project.id}
        asset={editLink}
        onUpdated={fetchAll}
      />
    </div>
  );
}
