"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { IndustrySector } from "@/types";

interface FormState { name: string; description: string; }
const EMPTY: FormState = { name: "", description: "" };

export default function IndustrySectorsPage() {
  const { user, canWrite } = useAuth();
  const [sectors, setSectors] = useState<IndustrySector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IndustrySector | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<IndustrySector | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/industry-sectors");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load.");
      setSectors(data.sectors);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() { setEditing(null); setForm(EMPTY); setFormError(null); setModalOpen(true); }
  function openEdit(s: IndustrySector) {
    setEditing(s);
    setForm({ name: s.name, description: s.description ?? "" });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!user) return;
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    setIsSaving(true);
    setFormError(null);
    try {
      const url = editing ? `/api/industry-sectors/${editing.id}` : "/api/industry-sectors";
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
      const res = await fetch(`/api/industry-sectors/${deleteTarget.id}`, {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-2 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Settings
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Industry Sectors</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage industry sectors used to categorise business capabilities.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Sector
          </Button>
        )}
      </div>

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
        ) : sectors.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
            <p className="text-sm font-medium">No industry sectors yet</p>
            {canWrite && (
              <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Add Sector</Button>
            )}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Description</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {sectors.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{s.name}</td>
                  <td className="hidden px-6 py-4 text-sm text-slate-500 md:table-cell">
                    {s.description || <span className="italic text-slate-300">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {canWrite && (
                        <>
                          <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => { setDeleteTarget(s); setDeleteError(null); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" aria-label="Delete">
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

      {!isLoading && !fetchError && sectors.length > 0 && (
        <p className="text-xs text-slate-400">{sectors.length} sector{sectors.length !== 1 ? "s" : ""}</p>
      )}

      {/* Create / Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit — ${editing.name}` : "Add Industry Sector"} maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{formError}</div>
          )}
          <Input label="Sector name" type="text" placeholder="e.g. Financial Services" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description of this industry sector..." className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 resize-none" />
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button isLoading={isSaving} onClick={handleSave}>{editing ? "Save changes" : "Add Sector"}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Industry Sector" maxWidth="max-w-md">
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
