"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { Plus, Pencil, Trash2, AlertTriangle, ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { AssetRisk, RiskCategory, RiskLevel, RiskStatus } from "@/types";
import { maxLevel } from "@/lib/riskAssessment";

interface AssetOption { id: string; name: string; }

const CATEGORIES: RiskCategory[] = ["Operational", "Financial", "Compliance", "Security", "Vendor", "Reputational", "Other"];
const LEVELS: RiskLevel[] = ["Low", "Medium", "High", "Critical"];
const STATUSES: RiskStatus[] = ["Open", "Mitigating", "Accepted", "Closed"];

const SEVERITY_STYLES: Record<RiskLevel, string> = {
  Low:      "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  Medium:   "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  High:     "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",
  Critical: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
};

const STATUS_STYLES: Record<RiskStatus, string> = {
  Open:       "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  Mitigating: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  Accepted:   "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  Closed:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
};

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------
interface RiskForm {
  assetId: string;
  title: string;
  description: string;
  category: RiskCategory;
  likelihood: RiskLevel;
  impact: RiskLevel;
  status: RiskStatus;
  owner: string;
}

const EMPTY: RiskForm = {
  assetId: "", title: "", description: "", category: "Operational",
  likelihood: "Medium", impact: "Medium", status: "Open", owner: "",
};

function riskToForm(r: AssetRisk): RiskForm {
  return {
    assetId: r.assetId,
    title: r.title,
    description: r.description ?? "",
    category: r.category,
    likelihood: r.likelihood,
    impact: r.impact,
    status: r.status,
    owner: r.owner ?? "",
  };
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-2 flex items-center gap-3 pt-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{children}</p>
      <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
    </div>
  );
}

const selectCls = "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100";

// ---------------------------------------------------------------------------
// Risk modal
// ---------------------------------------------------------------------------
function RiskModal({
  isOpen, onClose, editing, assets, onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  editing: AssetRisk | null;
  assets: AssetOption[];
  onSave: (form: RiskForm) => Promise<void>;
}) {
  const [form, setForm] = useState<RiskForm>(EMPTY);
  const [assetError, setAssetError] = useState("");
  const [titleError, setTitleError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(editing ? riskToForm(editing) : EMPTY);
      setAssetError(""); setTitleError(""); setGeneralError("");
    }
  }, [isOpen, editing]);

  function set<K extends keyof RiskForm>(key: K, value: RiskForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    let hasError = false;
    if (!form.assetId) { setAssetError("Asset is required."); hasError = true; } else { setAssetError(""); }
    if (!form.title.trim()) { setTitleError("Title is required."); hasError = true; } else { setTitleError(""); }
    if (hasError) return;
    setGeneralError("");
    setIsSaving(true);
    try { await onSave(form); }
    catch (err) { setGeneralError(err instanceof Error ? err.message : "An error occurred."); }
    finally { setIsSaving(false); }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit — ${editing.title}` : "Log a Risk"}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} noValidate>
        {generalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
            {generalError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-4">

          <SectionHeading>Identity</SectionHeading>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Asset</label>
            <select value={form.assetId} onChange={(e) => set("assetId", e.target.value)} className={selectCls}>
              <option value="">— select an asset —</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {assetError && <p className="text-xs text-red-500">{assetError}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
            <select value={form.category} onChange={(e) => set("category", e.target.value as RiskCategory)} className={selectCls}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="col-span-2">
            <Input label="Title" type="text" placeholder="e.g. Single vendor dependency for payment processing"
              value={form.title} onChange={(e) => set("title", e.target.value)}
              error={titleError} autoFocus required />
          </div>

          <SectionHeading>Assessment</SectionHeading>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Likelihood</label>
            <select value={form.likelihood} onChange={(e) => set("likelihood", e.target.value as RiskLevel)} className={selectCls}>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Impact</label>
            <select value={form.impact} onChange={(e) => set("impact", e.target.value as RiskLevel)} className={selectCls}>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value as RiskStatus)} className={selectCls}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <Input label="Owner" type="text" placeholder="Full name"
            value={form.owner} onChange={(e) => set("owner", e.target.value)} />

          <SectionHeading>Description</SectionHeading>

          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
            <textarea rows={3} value={form.description} placeholder="What the risk is, why it matters, mitigation approach…"
              onChange={(e) => set("description", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSaving}>
            {editing ? "Save changes" : "Log Risk"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function RisksPage() {
  const { canWrite } = useAuth();

  const [risks, setRisks] = useState<AssetRisk[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [assetFilter, setAssetFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AssetRisk | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AssetRisk | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const qs = new URLSearchParams();
      if (statusFilter) qs.set("status", statusFilter);
      if (categoryFilter) qs.set("category", categoryFilter);
      if (assetFilter) qs.set("asset", assetFilter);
      const [risksRes, assetsRes] = await Promise.all([
        fetch(`/api/asset-risks?${qs.toString()}`),
        fetch("/api/assets"),
      ]);
      const risksData = await risksRes.json();
      if (!risksRes.ok) throw new Error(risksData.error ?? "Failed to load risks.");
      const assetsData = await assetsRes.json();
      setRisks(risksData.risks);
      setAssets((assetsData.assets ?? []).map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, [statusFilter, categoryFilter, assetFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSave(form: RiskForm) {
    const url = editing ? `/api/asset-risks/${editing.id}` : "/api/asset-risks";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed.");
    await fetchData();
    setModalOpen(false); setEditing(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/asset-risks/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      await fetchData();
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setIsDeleting(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Risk Register</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Log and track risks against your assets — operational, financial, compliance, and more.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" /> Log Risk
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100">
          <option value="">All assets</option>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-700">
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
        ) : risks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400 dark:text-slate-500">
            <ShieldAlert className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium">No risks logged yet</p>
            {canWrite && (
              <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus className="h-4 w-4" /> Log Risk
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Title</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Asset</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Severity</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Owner</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {risks.map((risk) => {
                  const severity = maxLevel([risk.likelihood, risk.impact]);
                  return (
                    <tr key={risk.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{risk.title}</p>
                      </td>
                      <td className="hidden px-6 py-4 text-sm text-slate-600 sm:table-cell">
                        {risk.assetName || <span className="italic text-slate-300">—</span>}
                      </td>
                      <td className="hidden px-6 py-4 text-sm text-slate-600 md:table-cell">
                        {risk.category}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[severity]}`}>
                          {severity}
                        </span>
                      </td>
                      <td className="hidden px-6 py-4 text-sm text-slate-600 lg:table-cell">
                        {risk.owner || <span className="italic text-slate-300">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[risk.status]}`}>
                          {risk.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {canWrite && (
                            <>
                              <button
                                onClick={() => { setEditing(risk); setModalOpen(true); }}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                                aria-label={`Edit ${risk.title}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => { setDeleteTarget(risk); setDeleteError(null); }}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
                                aria-label={`Delete ${risk.title}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isLoading && !fetchError && risks.length > 0 && (
        <p className="text-xs text-slate-400">
          {risks.length} risk{risks.length !== 1 ? "s" : ""}
        </p>
      )}

      <RiskModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        assets={assets}
        onSave={handleSave}
      />

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Risk" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deleteTarget?.title}</span>?
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
