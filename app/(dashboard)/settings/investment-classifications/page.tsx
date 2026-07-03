"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2, AlertTriangle, MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { InvestmentClassification } from "@/types";

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------
interface ClassificationForm {
  name: string;
  color: string;
  sortOrder: string;
}

const EMPTY_FORM: ClassificationForm = { name: "", color: "#6366f1", sortOrder: "" };

function rowToForm(c: InvestmentClassification): ClassificationForm {
  return {
    name:      c.name,
    color:     c.color,
    sortOrder: c.sortOrder !== null ? String(c.sortOrder) : "",
  };
}

// ---------------------------------------------------------------------------
// Edit/Add modal
// ---------------------------------------------------------------------------
function ClassificationModal({
  isOpen, onClose, editing, onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  editing: InvestmentClassification | null;
  onSave: (form: ClassificationForm) => Promise<void>;
}) {
  const [form, setForm] = useState<ClassificationForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof ClassificationForm, string>>>({});
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(editing ? rowToForm(editing) : EMPTY_FORM);
      setErrors({}); setGeneralError("");
    }
  }, [isOpen, editing]);

  function set<K extends keyof ClassificationForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const newErrors: Partial<Record<keyof ClassificationForm, string>> = {};
    if (!form.name.trim()) newErrors.name = "Name is required.";
    if (!form.color.trim()) newErrors.color = "Color is required.";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
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
      title={editing ? `Edit - ${editing.name}` : "Add Classification"}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} noValidate>
        {generalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
            {generalError}
          </div>
        )}
        <div className="flex flex-col gap-4">
          <Input
            label="Name"
            type="text"
            placeholder="e.g. Invest"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            error={errors.name}
            autoFocus
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Colour
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color}
                onChange={(e) => set("color", e.target.value)}
                className="h-9 w-16 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-800"
              />
              <span className="font-mono text-sm text-slate-600 dark:text-slate-400">{form.color}</span>
            </div>
            {errors.color && <p className="text-xs text-red-500">{errors.color}</p>}
          </div>
          <Input
            label="Sort Order (optional)"
            type="number"
            placeholder="e.g. 1"
            value={form.sortOrder}
            onChange={(e) => set("sortOrder", e.target.value)}
          />
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
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
export default function InvestmentClassificationsPage() {
  const { user, canWrite } = useAuth();
  const [classifications, setClassifications] = useState<InvestmentClassification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentClassification | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<InvestmentClassification | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const res = await fetch("/api/investment-classifications");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load classifications.");
      setClassifications(data.classifications);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSave(form: ClassificationForm) {
    if (!user) return;
    const url    = editing ? `/api/investment-classifications/${editing.id}` : "/api/investment-classifications";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        color: form.color,
        sortOrder: form.sortOrder ? Number(form.sortOrder) : null,
        userId: user.id,
        userName: user.name,
      }),
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
      const res = await fetch(`/api/investment-classifications/${deleteTarget.id}`, {
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
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Investment Classifications</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Configure the investment labels and colours used on the roadmap.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Classification
          </Button>
        )}
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
        ) : classifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400 dark:text-slate-500">
            <MapPin className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium">No classifications yet</p>
            {canWrite && (
              <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus className="h-4 w-4" /> Add Classification
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Colour</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Sort</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {classifications.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-4">
                      <div
                        className="h-6 w-6 rounded-md flex-shrink-0"
                        style={{ backgroundColor: c.color }}
                        title={c.color}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-sm text-slate-900 dark:text-slate-100">{c.name}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {c.sortOrder ?? "-"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {canWrite && (
                          <>
                            <button
                              onClick={() => { setEditing(c); setModalOpen(true); }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                              aria-label={`Edit ${c.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setDeleteTarget(c); setDeleteError(null); }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
                              aria-label={`Delete ${c.name}`}
                            >
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
          </div>
        )}
      </div>

      {!isLoading && !fetchError && classifications.length > 0 && (
        <p className="text-xs text-slate-400">
          {classifications.length} classification{classifications.length !== 1 ? "s" : ""}
        </p>
      )}

      <ClassificationModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        onSave={handleSave}
      />

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Classification" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deleteTarget?.name}</span>?
                This will fail if it is used by any roadmap phases.
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
