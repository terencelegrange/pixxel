"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2, AlertTriangle, Check, Blocks } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useFeatureTier } from "@/context/FeatureTierContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { FEATURES, FEATURE_CATEGORIES } from "@/config/features";
import { FeatureTier } from "@/types";

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------
interface TierForm {
  name: string;
  description: string;
  sortOrder: string;
  isDefault: boolean;
  features: string[];
}

const EMPTY_FORM: TierForm = { name: "", description: "", sortOrder: "", isDefault: false, features: [] };

function tierToForm(t: FeatureTier): TierForm {
  return {
    name: t.name, description: t.description ?? "",
    sortOrder: t.sortOrder != null ? String(t.sortOrder) : "",
    isDefault: t.isDefault, features: t.features,
  };
}

function TierModal({
  isOpen, onClose, editing, onSave,
}: {
  isOpen: boolean; onClose: () => void; editing: FeatureTier | null;
  onSave: (form: TierForm) => Promise<void>;
}) {
  const [form, setForm] = useState<TierForm>(EMPTY_FORM);
  const [nameError, setNameError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(editing ? tierToForm(editing) : EMPTY_FORM);
      setNameError(""); setGeneralError("");
    }
  }, [isOpen, editing]);

  function set<K extends keyof TierForm>(key: K, value: TierForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleFeature(key: string) {
    setForm((f) => ({
      ...f,
      features: f.features.includes(key) ? f.features.filter((k) => k !== key) : [...f.features, key],
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

  const labelCls = "text-sm font-medium text-slate-700 dark:text-slate-300";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? `Edit — ${editing.name}` : "Add Feature Tier"} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} noValidate>
        {generalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
            {generalError}
          </div>
        )}
        <div className="flex flex-col gap-4">
          <Input
            label="Name" type="text" placeholder="e.g. Basic, Advanced, Enterprise"
            value={form.name} onChange={(e) => set("name", e.target.value)}
            error={nameError} autoFocus required
          />
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Description</label>
            <textarea
              rows={2} value={form.description}
              placeholder="What kind of customer is this tier for?"
              onChange={(e) => set("description", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Sort order</label>
              <input
                type="number" value={form.sortOrder}
                onChange={(e) => set("sortOrder", e.target.value)}
                placeholder="e.g. 1"
                className="h-9 w-28 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
              />
            </div>
            <label className="mt-5 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => set("isDefault", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
              />
              Set as default tier
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelCls}>Included features</label>
            <p className="text-xs text-slate-400">
              Asset Registry, My Assets, the Asset Strategy report, and core lookups are always included.
            </p>
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              {FEATURE_CATEGORIES.map((category) => (
                <div key={category}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{category}</p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {FEATURES.filter((f) => f.category === category).map((f) => (
                      <label key={f.key} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={form.features.includes(f.key)}
                          onChange={() => toggleFeature(f.key)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
                        />
                        {f.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
export default function PlatformSettingsPage() {
  const { user } = useAuth();
  const { refresh: refreshFeatureTier } = useFeatureTier();

  const [tiers, setTiers] = useState<FeatureTier[]>([]);
  const [activeTierId, setActiveTierId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FeatureTier | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<FeatureTier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const [tiersRes, activeRes] = await Promise.all([
        fetch("/api/feature-tiers"),
        fetch("/api/feature-tier/active"),
      ]);
      const [tiersData, activeData] = await Promise.all([tiersRes.json(), activeRes.json()]);
      if (!tiersRes.ok) throw new Error(tiersData.error ?? "Failed to load feature tiers.");
      setTiers(tiersData.tiers);
      setActiveTierId(activeData.tierId ?? null);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleActivate(tierId: string) {
    if (tierId === activeTierId) return;
    setIsSwitching(tierId); setSwitchError(null);
    try {
      const res = await fetch("/api/feature-tier/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to switch tier.");
      setActiveTierId(tierId);
      await refreshFeatureTier();
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setIsSwitching(null); }
  }

  async function handleSave(form: TierForm) {
    if (!user) return;
    const url    = editing ? `/api/feature-tiers/${editing.id}` : "/api/feature-tiers";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        sortOrder: form.sortOrder.trim() === "" ? null : Number(form.sortOrder),
        userId: user.id, userName: user.name,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed.");
    await fetchData();
    await refreshFeatureTier();
    setModalOpen(false); setEditing(null);
  }

  async function handleDelete() {
    if (!deleteTarget || !user) return;
    setIsDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/feature-tiers/${deleteTarget.id}`, {
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
    } finally { setIsDeleting(false); }
  }

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Platform</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Choose which feature set is enabled for this install, and manage the available feature tiers.
        </p>
      </div>

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
      ) : (
        <>
          {/* Active tier switcher */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
              Active Tier
            </h2>
            {switchError && <p className="mb-3 text-sm text-red-500">{switchError}</p>}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tiers.map((tier) => {
                const isActive = tier.id === activeTierId;
                return (
                  <button
                    key={tier.id}
                    onClick={() => handleActivate(tier.id)}
                    disabled={isSwitching !== null}
                    className={[
                      "flex flex-col items-start gap-2 rounded-xl border p-5 text-left shadow-sm transition-colors disabled:cursor-not-allowed",
                      isActive
                        ? "border-brand-400 bg-brand-50 dark:border-brand-500 dark:bg-brand-900/20"
                        : "border-slate-200 bg-white hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-600",
                    ].join(" ")}
                  >
                    <div className="flex w-full items-center justify-between">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">{tier.name}</h3>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">
                          <Check className="h-3 w-3" /> Active
                        </span>
                      )}
                      {!isActive && isSwitching === tier.id && (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                      )}
                    </div>
                    {tier.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">{tier.description}</p>
                    )}
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {tier.features.length} additional feature{tier.features.length !== 1 ? "s" : ""}
                      {tier.isDefault && " · Default"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manage tiers */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Manage Tiers
              </h2>
              <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus className="h-4 w-4" /> Add Tier
              </Button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
              {tiers.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400 dark:text-slate-500">
                  <Blocks className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium">No feature tiers defined yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Features</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Default</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                      {tiers.map((tier) => (
                        <tr key={tier.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              {tier.name}
                              {tier.id === activeTierId && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                                  Active
                                </span>
                              )}
                            </p>
                            {tier.description && (
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{tier.description}</p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                            {tier.features.length === 0 ? <span className="italic text-slate-300 dark:text-slate-600">None</span> : tier.features.length}
                          </td>
                          <td className="px-6 py-4">
                            {tier.isDefault && (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                Default
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => { setEditing(tier); setModalOpen(true); }}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                                aria-label={`Edit ${tier.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => { setDeleteTarget(tier); setDeleteError(null); }}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
                                aria-label={`Delete ${tier.name}`}
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
          </div>
        </>
      )}

      <TierModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        onSave={handleSave}
      />

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Feature Tier" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name}</span>?
              </p>
              {deleteError && <p className="mt-2 text-sm text-red-500 dark:text-red-400">{deleteError}</p>}
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
