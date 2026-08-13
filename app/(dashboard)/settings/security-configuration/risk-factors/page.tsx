"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2, AlertTriangle, ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ASSET_CATEGORIES } from "@/components/assets/AssetModal";
import { RiskFactor, RiskFactorKind, RiskLevel, AssetCategory } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_KINDS: RiskFactorKind[] = ["Attribute", "Characteristic"];
const VALID_LEVELS: RiskLevel[] = ["Low", "Medium", "High", "Critical"];

interface RiskFactorForm {
  name: string;
  description: string;
  kind: RiskFactorKind;
  severity: RiskLevel;
  likelihood: RiskLevel;
  impact: RiskLevel;
  categories: AssetCategory[];
}

const EMPTY_FORM: RiskFactorForm = {
  name: "", description: "", kind: "Attribute",
  severity: "Medium", likelihood: "Medium", impact: "Medium", categories: [],
};

function factorToForm(f: RiskFactor): RiskFactorForm {
  return {
    name: f.name, description: f.description ?? "", kind: f.kind,
    severity: f.severity, likelihood: f.likelihood, impact: f.impact,
    categories: f.categories,
  };
}

const KIND_BADGE: Record<RiskFactorKind, string> = {
  Attribute:      "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Characteristic: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

const LEVEL_BADGE: Record<RiskLevel, string> = {
  Low:      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  Medium:   "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  High:     "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Critical: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
function RiskFactorModal({
  isOpen, onClose, editing, onSave,
}: {
  isOpen: boolean; onClose: () => void; editing: RiskFactor | null;
  onSave: (form: RiskFactorForm) => Promise<void>;
}) {
  const [form, setForm] = useState<RiskFactorForm>(EMPTY_FORM);
  const [nameError, setNameError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(editing ? factorToForm(editing) : EMPTY_FORM);
      setNameError(""); setGeneralError("");
    }
  }, [isOpen, editing]);

  function set<K extends keyof RiskFactorForm>(key: K, value: RiskFactorForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleCategory(category: AssetCategory) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(category)
        ? f.categories.filter((c) => c !== category)
        : [...f.categories, category],
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setNameError("Name is required."); return; }
    setNameError(""); setGeneralError("");
    setIsSaving(true);
    try { await onSave(form); }
    catch (err) { setGeneralError(err instanceof Error ? err.message : "An error occurred."); }
    finally { setIsSaving(false); }
  }

  const selectCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100";
  const labelCls = "text-sm font-medium text-slate-700 dark:text-slate-300";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? `Edit — ${editing.name}` : "Add Attribute / Characteristic"} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} noValidate>
        {generalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
            {generalError}
          </div>
        )}
        <div className="flex flex-col gap-4">
          <Input
            label="Name" type="text" placeholder="e.g. Automated Patching, PII Data"
            value={form.name} onChange={(e) => set("name", e.target.value)}
            error={nameError} autoFocus required
          />
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Description</label>
            <textarea
              rows={2} value={form.description}
              placeholder="What does this attribute or characteristic mean?"
              onChange={(e) => set("description", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Kind</label>
            <select value={form.kind} onChange={(e) => set("kind", e.target.value as RiskFactorKind)} className={selectCls}>
              <option value="Attribute">Attribute — a fixable gap (something to remediate)</option>
              <option value="Characteristic">Characteristic — an inherent trait (something to monitor)</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Severity</label>
              <select value={form.severity} onChange={(e) => set("severity", e.target.value as RiskLevel)} className={selectCls}>
                {VALID_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Likelihood</label>
              <select value={form.likelihood} onChange={(e) => set("likelihood", e.target.value as RiskLevel)} className={selectCls}>
                {VALID_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Impact</label>
              <select value={form.impact} onChange={(e) => set("impact", e.target.value as RiskLevel)} className={selectCls}>
                {VALID_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Applies to asset categories</label>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              {ASSET_CATEGORIES.map((category) => (
                <label key={category} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.categories.includes(category)}
                    onChange={() => toggleCategory(category)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
                  />
                  {category}
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-400">You can also manage this later from Asset Category Mapping.</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSaving}>{editing ? "Save changes" : "Add"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function RiskFactorsPage() {
  const { user } = useAuth();
  const [factors, setFactors] = useState<RiskFactor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"" | RiskFactorKind>("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RiskFactor | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<RiskFactor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const res = await fetch("/api/risk-factors");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load attributes and characteristics.");
      setFactors(data.riskFactors);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = factors.filter((f) => {
    if (kindFilter && f.kind !== kindFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return f.name.toLowerCase().includes(q) || (f.description?.toLowerCase().includes(q) ?? false);
  });

  async function handleSave(form: RiskFactorForm) {
    if (!user) return;
    const url    = editing ? `/api/risk-factors/${editing.id}` : "/api/risk-factors";
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
    if (!deleteTarget || !user) return;
    setIsDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/risk-factors/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      await fetchData();
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setIsDeleting(false); }
  }

  const selectCls = "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200";

  return (
    <div className="space-y-6">
      <Link href="/settings/security-configuration" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Security Configuration
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Attributes & Characteristics</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Define what gets assessed on each asset, and how severe, likely, and impactful a gap is.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search by name or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as "" | RiskFactorKind)} className={selectCls}>
          <option value="">All kinds</option>
          {VALID_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

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
            <ShieldAlert className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium">
              {factors.length === 0 ? "No attributes or characteristics defined yet" : "Nothing matches your search"}
            </p>
            {factors.length === 0 && (
              <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Kind</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Severity</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Likelihood</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Impact</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {filtered.map((factor) => (
                  <tr key={factor.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{factor.name}</p>
                      {factor.description && (
                        <p className="mt-0.5 text-xs text-slate-500 line-clamp-1 dark:text-slate-400">{factor.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${KIND_BADGE[factor.kind]}`}>
                        {factor.kind}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_BADGE[factor.severity]}`}>
                        {factor.severity}
                      </span>
                    </td>
                    <td className="hidden px-6 py-4 md:table-cell">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_BADGE[factor.likelihood]}`}>
                        {factor.likelihood}
                      </span>
                    </td>
                    <td className="hidden px-6 py-4 md:table-cell">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_BADGE[factor.impact]}`}>
                        {factor.impact}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditing(factor); setModalOpen(true); }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                          aria-label={`Edit ${factor.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setDeleteTarget(factor); setDeleteError(null); }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
                          aria-label={`Delete ${factor.name}`}
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

      {!isLoading && !fetchError && factors.length > 0 && (
        <p className="text-xs text-slate-400">
          {filtered.length} of {factors.length} item{factors.length !== 1 ? "s" : ""}
        </p>
      )}

      <RiskFactorModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        onSave={handleSave}
      />

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Item" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deleteTarget?.name}</span>?
                Category mappings and any existing asset assessments for it will also be removed.
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
