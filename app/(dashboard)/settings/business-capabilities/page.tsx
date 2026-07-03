"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, AlertTriangle, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { BusinessCapability, IndustrySector } from "@/types";

interface FormState {
  name: string;
  description: string;
  industrySectorId: string;
  sortOrder: string;
}

const EMPTY: FormState = { name: "", description: "", industrySectorId: "", sortOrder: "" };

export default function BusinessCapabilitiesPage() {
  const { user, canWrite } = useAuth();
  const [capabilities, setCapabilities] = useState<BusinessCapability[]>([]);
  const [sectors, setSectors] = useState<IndustrySector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessCapability | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<BusinessCapability | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Track which sector groups are collapsed
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [capsRes, sectorsRes] = await Promise.all([
        fetch("/api/business-capabilities"),
        fetch("/api/industry-sectors"),
      ]);
      const [capsData, sectorsData] = await Promise.all([capsRes.json(), sectorsRes.json()]);
      if (!capsRes.ok) throw new Error(capsData.error ?? "Failed to load.");
      setCapabilities(capsData.capabilities);
      setSectors(sectorsData.sectors ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate(sectorId?: string) {
    setEditing(null);
    setForm({ ...EMPTY, industrySectorId: sectorId ?? (sectors[0]?.id ?? "") });
    setFormError(null);
    setModalOpen(true);
  }
  function openEdit(c: BusinessCapability) {
    setEditing(c);
    setForm({
      name: c.name,
      description: c.description ?? "",
      industrySectorId: c.industrySectorId,
      sortOrder: c.sortOrder != null ? String(c.sortOrder) : "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!user) return;
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    if (!form.industrySectorId) { setFormError("Industry sector is required."); return; }
    setIsSaving(true);
    setFormError(null);
    try {
      const url = editing ? `/api/business-capabilities/${editing.id}` : "/api/business-capabilities";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          industrySectorId: form.industrySectorId,
          sortOrder: form.sortOrder !== "" ? Number(form.sortOrder) : null,
          userId: user.id,
          userName: user.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      await fetchData();
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !user) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/business-capabilities/${deleteTarget.id}`, {
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

  // Group capabilities by sector
  const grouped = sectors.map((sector) => ({
    sector,
    caps: capabilities.filter((c) => c.industrySectorId === sector.id),
  }));
  // Any capabilities whose sector is not in sectors list (shouldn't happen, but safe)
  const ungrouped = capabilities.filter((c) => !sectors.find((s) => s.id === c.industrySectorId));

  const totalCount = capabilities.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-2 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Settings
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Business Capabilities</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Define business capabilities grouped by industry sector.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4" /> Add Capability
          </Button>
        )}
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
      ) : totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400 rounded-xl border border-slate-200 bg-white shadow-sm">
          <p className="text-sm font-medium">No business capabilities yet</p>
          {canWrite && (
            <Button size="sm" onClick={() => openCreate()}><Plus className="h-4 w-4" /> Add Capability</Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ sector, caps }) => {
            if (caps.length === 0) return null;
            const isCollapsed = collapsed[sector.id] ?? false;
            return (
              <div key={sector.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
                  <button
                    onClick={() => setCollapsed((c) => ({ ...c, [sector.id]: !c[sector.id] }))}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <h2 className="text-sm font-semibold text-slate-700">{sector.name}</h2>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {caps.length}
                    </span>
                    {isCollapsed
                      ? <ChevronDown className="h-4 w-4 text-slate-400 ml-auto" />
                      : <ChevronUp className="h-4 w-4 text-slate-400 ml-auto" />
                    }
                  </button>
                  {canWrite && (
                    <button
                      onClick={() => openCreate(sector.id)}
                      className="ml-4 flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  )}
                </div>
                {!isCollapsed && (
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Capability</th>
                        <th className="hidden px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 md:table-cell">Description</th>
                        <th className="hidden px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 sm:table-cell w-20">Order</th>
                        <th className="px-6 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {caps.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-3 font-medium text-slate-900 text-sm">{c.name}</td>
                          <td className="hidden px-6 py-3 text-sm text-slate-500 md:table-cell">
                            {c.description || <span className="italic text-slate-300">—</span>}
                          </td>
                          <td className="hidden px-6 py-3 text-sm text-slate-400 sm:table-cell">
                            {c.sortOrder ?? <span className="italic text-slate-300">—</span>}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {canWrite && (
                                <>
                                  <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" aria-label="Edit">
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => { setDeleteTarget(c); setDeleteError(null); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" aria-label="Delete">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
          {ungrouped.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                <h2 className="text-sm font-semibold text-slate-500 italic">Unassigned</h2>
              </div>
              <table className="min-w-full divide-y divide-slate-100">
                <tbody className="divide-y divide-slate-100 bg-white">
                  {ungrouped.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-900 text-sm">{c.name}</td>
                      <td className="hidden px-6 py-3 text-sm text-slate-500 md:table-cell">{c.description || <span className="italic text-slate-300">—</span>}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {canWrite && (
                            <>
                              <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"><Pencil className="h-4 w-4" /></button>
                              <button onClick={() => { setDeleteTarget(c); setDeleteError(null); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 className="h-4 w-4" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!isLoading && !fetchError && totalCount > 0 && (
        <p className="text-xs text-slate-400">{totalCount} capability{totalCount !== 1 ? "s" : ""} across {sectors.filter(s => capabilities.some(c => c.industrySectorId === s.id)).length} sector{sectors.length !== 1 ? "s" : ""}</p>
      )}

      {/* Create / Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit — ${editing.name}` : "Add Business Capability"} maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{formError}</div>
          )}
          <Input label="Capability name" type="text" placeholder="e.g. Customer Management" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description of this capability..." className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 resize-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Industry sector<span className="ml-0.5 text-red-500">*</span></label>
            <select value={form.industrySectorId} onChange={(e) => setForm((f) => ({ ...f, industrySectorId: e.target.value }))} className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1">
              <option value="">— Select a sector —</option>
              {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <Input label="Sort order" type="number" placeholder="e.g. 1" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} hint="Controls display order within the sector" />
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button isLoading={isSaving} onClick={handleSave}>{editing ? "Save changes" : "Add Capability"}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Business Capability" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700">
                Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name}</span>? This cannot be undone.
              </p>
              {deleteError && <p className="mt-2 text-sm text-red-500">{deleteError}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" isLoading={isDeleting} onClick={handleDelete}><Trash2 className="h-4 w-4" /> Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
