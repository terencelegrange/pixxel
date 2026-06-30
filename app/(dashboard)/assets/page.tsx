"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, AlertTriangle, ExternalLink } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import AssetModal, { AssetFormState, AssetIcon, LIFECYCLE_STATUSES } from "@/components/assets/AssetModal";
import { Asset, AssetComplexity, AssetStrategy, AssetType, BusinessCapability, Department, Diagram, Domain, IndustrySector, LifecycleStatus, Tier, User, Vendor } from "@/types";

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------
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

function Badge({ label, style }: { label: string; style: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AssetsPage() {
  const { user } = useAuth();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [strategies, setStrategies] = useState<AssetStrategy[]>([]);
  const [complexities, setComplexities] = useState<AssetComplexity[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [capabilities, setCapabilities] = useState<BusinessCapability[]>([]);
  const [sectors, setSectors] = useState<IndustrySector[]>([]);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [filterLifecycle, setFilterLifecycle] = useState<string>("all");
  const [filterDept, setFilterDept] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [assetsRes, deptsRes, strategiesRes, complexitiesRes, domainsRes, tiersRes, vendorsRes, usersRes, capsRes, sectorsRes, diagramsRes] = await Promise.all([
        fetch("/api/assets"),
        fetch("/api/organisations"),
        fetch("/api/asset-strategy"),
        fetch("/api/asset-complexity"),
        fetch("/api/domains"),
        fetch("/api/tiers"),
        fetch("/api/vendors"),
        fetch("/api/users"),
        fetch("/api/business-capabilities"),
        fetch("/api/industry-sectors"),
        fetch("/api/diagrams"),
      ]);
      const [assetsData, deptsData, strategiesData, complexitiesData, domainsData, tiersData, vendorsData, usersData, capsData, sectorsData, diagramsData] = await Promise.all([
        assetsRes.json(),
        deptsRes.json(),
        strategiesRes.json(),
        complexitiesRes.json(),
        domainsRes.json(),
        tiersRes.json(),
        vendorsRes.json(),
        usersRes.json(),
        capsRes.json(),
        sectorsRes.json(),
        diagramsRes.json(),
      ]);
      if (!assetsRes.ok) throw new Error(assetsData.error ?? "Failed to load assets.");
      setAssets(assetsData.assets);
      setDepartments(deptsData.departments ?? []);
      setStrategies(strategiesData.strategies ?? []);
      setComplexities(complexitiesData.complexities ?? []);
      setDomains(domainsData.domains ?? []);
      setTiers(tiersData.tiers ?? []);
      setVendors(vendorsData.vendors ?? []);
      setUsers(usersData.users ?? []);
      setCapabilities(capsData.capabilities ?? []);
      setSectors(sectorsData.sectors ?? []);
      setDiagrams(diagramsData.diagrams ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Filtered assets
  // ---------------------------------------------------------------------------
  const filtered = assets.filter((a) => {
    if (filterLifecycle !== "all" && a.lifecycleStatus !== filterLifecycle) return false;
    if (filterDept !== "all" && !a.departmentIds.includes(filterDept)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !a.name.toLowerCase().includes(q) &&
        !(a.shortCode?.toLowerCase().includes(q)) &&
        !(a.businessOwner?.toLowerCase().includes(q)) &&
        !(a.vendorName?.toLowerCase().includes(q))
      ) return false;
    }
    return true;
  });

  // ---------------------------------------------------------------------------
  // Save handler (called by AssetModal)
  // ---------------------------------------------------------------------------
  async function handleSave(form: AssetFormState) {
    if (!user) return;
    const url = editing ? `/api/assets/${editing.id}` : "/api/assets";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, userId: user.id, userName: user.name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed.");
    await fetchData();
    setModalOpen(false);
    setEditing(null);
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  async function handleDelete() {
    if (!deleteTarget || !user) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/assets/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, userName: user.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      await fetchData();
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsDeleting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Asset Registry</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Enterprise application and technology asset inventory.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" />
          Register Asset
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search by name, code, owner, vendor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        <select
          value={filterLifecycle}
          onChange={(e) => setFilterLifecycle(e.target.value)}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
        >
          <option value="all">All statuses</option>
          {LIFECYCLE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
        >
          <option value="all">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-red-500">
            <AlertTriangle className="h-6 w-6" />
            <p className="text-sm">{fetchError}</p>
            <Button variant="secondary" size="sm" onClick={fetchData}>Retry</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400 dark:text-slate-500">
            <AssetIcon name="Server" className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium">
              {assets.length === 0 ? "No assets registered yet" : "No assets match your filters"}
            </p>
            {assets.length === 0 && (
              <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus className="h-4 w-4" /> Register Asset
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Asset</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Type</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Tier</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Strategy</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Lifecycle</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {filtered.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                          <AssetIcon name={asset.icon ?? ''} className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/assets/${asset.id}`}
                              className="font-medium text-slate-900 hover:text-brand-600 hover:underline dark:text-slate-100"
                            >
                              {asset.name}
                            </Link>
                            {asset.shortCode && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                {asset.shortCode}
                              </span>
                            )}
                            {asset.appUrl && (
                              <a href={asset.appUrl} target="_blank" rel="noopener noreferrer"
                                className="text-slate-400 hover:text-brand-600"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          {asset.vendorName && (
                            <p className="text-xs text-slate-400">{asset.vendorName}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 sm:table-cell">
                      <Badge label={asset.type} style={TYPE_STYLES[asset.type]} />
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-slate-600 dark:text-slate-400 md:table-cell">
                      {asset.tierName || <span className="italic text-slate-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-slate-600 dark:text-slate-400 lg:table-cell">
                      {asset.strategyName || <span className="italic text-slate-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <Badge label={asset.lifecycleStatus} style={LIFECYCLE_STYLES[asset.lifecycleStatus]} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditing(asset); setModalOpen(true); }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors dark:hover:bg-slate-800 dark:hover:text-slate-300"
                          aria-label={`Edit ${asset.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setDeleteTarget(asset); setDeleteError(null); }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          aria-label={`Delete ${asset.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer count */}
      {!isLoading && !fetchError && assets.length > 0 && (
        <p className="text-xs text-slate-400">
          {filtered.length} of {assets.length} asset{assets.length !== 1 ? "s" : ""}
          {assets.filter((a) => a.lifecycleStatus === "Production").length > 0 && (
            <> &middot; {assets.filter((a) => a.lifecycleStatus === "Production").length} in production</>
          )}
        </p>
      )}

      {/* Create / Edit Modal */}
      <AssetModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
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

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Asset"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deleteTarget?.name}</span>?
                This action cannot be undone.
              </p>
              {deleteError && <p className="mt-2 text-sm text-red-500">{deleteError}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" isLoading={isDeleting} onClick={handleDelete}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
