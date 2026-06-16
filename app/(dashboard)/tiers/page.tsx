"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { Plus, Pencil, Trash2, AlertTriangle, Gauge } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Tier } from "@/types";

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------
interface TierForm {
  name: string;
  description: string;
  slaAvailability: string;
  supportHours: string;
  responseTime: string;
  resolutionTime: string;
}

const EMPTY: TierForm = {
  name: "", description: "",
  slaAvailability: "", supportHours: "",
  responseTime: "", resolutionTime: "",
};

function tierToForm(t: Tier): TierForm {
  return {
    name:            t.name,
    description:     t.description     ?? "",
    slaAvailability: t.slaAvailability ?? "",
    supportHours:    t.supportHours    ?? "",
    responseTime:    t.responseTime    ?? "",
    resolutionTime:  t.resolutionTime  ?? "",
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-2 flex items-center gap-3 pt-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{children}</p>
      <div className="flex-1 border-t border-slate-100" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier modal
// ---------------------------------------------------------------------------
function TierModal({
  isOpen, onClose, editing, onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  editing: Tier | null;
  onSave: (form: TierForm) => Promise<void>;
}) {
  const [form, setForm] = useState<TierForm>(EMPTY);
  const [nameError, setNameError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(editing ? tierToForm(editing) : EMPTY);
      setNameError(""); setGeneralError("");
    }
  }, [isOpen, editing]);

  function set(key: keyof TierForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setNameError("Tier name is required."); return; }
    setNameError(""); setGeneralError("");
    setIsSaving(true);
    try { await onSave(form); }
    catch (err) { setGeneralError(err instanceof Error ? err.message : "An error occurred."); }
    finally { setIsSaving(false); }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit — ${editing.name}` : "Add Tier"}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} noValidate>
        {generalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {generalError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-4">

          {/* Identity */}
          <SectionHeading>Identity</SectionHeading>

          <div className="col-span-2 sm:col-span-1">
            <Input label="Tier name" type="text" placeholder="e.g. Tier 1, Gold, Critical"
              value={form.name} onChange={(e) => set("name", e.target.value)}
              error={nameError} autoFocus required />
          </div>

          <div className="col-span-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Description</label>
              <textarea
                rows={2}
                value={form.description}
                placeholder="What does this tier represent?"
                onChange={(e) => set("description", e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 resize-none"
              />
            </div>
          </div>

          {/* SLA */}
          <SectionHeading>Service Level Agreement</SectionHeading>

          <Input label="Availability SLA" type="text" placeholder="e.g. 99.9%"
            value={form.slaAvailability} onChange={(e) => set("slaAvailability", e.target.value)} />

          <Input label="Hours of support" type="text" placeholder="e.g. 24x7, Business Hours (8x5)"
            value={form.supportHours} onChange={(e) => set("supportHours", e.target.value)} />

          <Input label="Initial response time" type="text" placeholder="e.g. 15 minutes, 1 hour"
            value={form.responseTime} onChange={(e) => set("responseTime", e.target.value)} />

          <Input label="Resolution time" type="text" placeholder="e.g. 4 hours, Next business day"
            value={form.resolutionTime} onChange={(e) => set("resolutionTime", e.target.value)} />

        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSaving}>
            {editing ? "Save changes" : "Add Tier"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function TiersPage() {
  const { user } = useAuth();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tier | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Tier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const res = await fetch("/api/tiers");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load tiers.");
      setTiers(data.tiers);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = tiers.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || (t.description?.toLowerCase().includes(q));
  });

  async function handleSave(form: TierForm) {
    if (!user) return;
    const url    = editing ? `/api/tiers/${editing.id}` : "/api/tiers";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, userId: user.id, userName: user.name }),
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
      const res = await fetch(`/api/tiers/${deleteTarget.id}`, {
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Tiers</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Define application tiers with associated SLA and support commitments.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Tier
        </Button>
      </div>

      {/* Search */}
      <div>
        <input
          type="search"
          placeholder="Search by name or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
            <Gauge className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium">
              {tiers.length === 0 ? "No tiers defined yet" : "No tiers match your search"}
            </p>
            {tiers.length === 0 && (
              <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus className="h-4 w-4" /> Add Tier
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Tier</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">SLA</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Support hours</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Response</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Resolution</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filtered.map((tier) => (
                  <tr key={tier.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
                          <Gauge className="h-4 w-4 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{tier.name}</p>
                          {tier.description && (
                            <p className="text-xs text-slate-400 line-clamp-1">{tier.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-slate-600 sm:table-cell">
                      {tier.slaAvailability || <span className="italic text-slate-300">—</span>}
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-slate-600 md:table-cell">
                      {tier.supportHours || <span className="italic text-slate-300">—</span>}
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-slate-600 lg:table-cell">
                      {tier.responseTime || <span className="italic text-slate-300">—</span>}
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-slate-600 lg:table-cell">
                      {tier.resolutionTime || <span className="italic text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditing(tier); setModalOpen(true); }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                          aria-label={`Edit ${tier.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setDeleteTarget(tier); setDeleteError(null); }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
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

      {/* Footer count */}
      {!isLoading && !fetchError && tiers.length > 0 && (
        <p className="text-xs text-slate-400">
          {filtered.length} of {tiers.length} tier{tiers.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Create / Edit Modal */}
      <TierModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Tier" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deleteTarget?.name}</span>?
                Any assets assigned to this tier will be unassigned.
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
