"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2, AlertTriangle, ScrollText } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ChangelogEntry, ChangelogType } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
interface ChangelogForm {
  version: string;
  title: string;
  description: string;
  type: ChangelogType;
  releasedAt: string;
}

const EMPTY_FORM: ChangelogForm = {
  version: "", title: "", description: "", type: "feature",
  releasedAt: new Date().toISOString().slice(0, 10),
};

function entryToForm(e: ChangelogEntry): ChangelogForm {
  return {
    version:     e.version,
    title:       e.title,
    description: e.description ?? "",
    type:        e.type,
    releasedAt:  e.releasedAt,
  };
}

const TYPE_BADGE: Record<ChangelogType, string> = {
  feature:     "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400",
  fix:         "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  improvement: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  breaking:    "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const TYPE_LABELS: Record<ChangelogType, string> = {
  feature:     "Feature",
  fix:         "Fix",
  improvement: "Improvement",
  breaking:    "Breaking",
};

// ---------------------------------------------------------------------------
// Entry modal
// ---------------------------------------------------------------------------
function EntryModal({
  isOpen, onClose, editing, onSave,
}: {
  isOpen: boolean; onClose: () => void; editing: ChangelogEntry | null;
  onSave: (form: ChangelogForm) => Promise<void>;
}) {
  const [form, setForm] = useState<ChangelogForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof ChangelogForm, string>>>({});
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(editing ? entryToForm(editing) : EMPTY_FORM);
      setErrors({}); setGeneralError("");
    }
  }, [isOpen, editing]);

  function set<K extends keyof ChangelogForm>(key: K, value: ChangelogForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const newErrors: Partial<Record<keyof ChangelogForm, string>> = {};
    if (!form.version.trim()) newErrors.version = "Version is required.";
    if (!form.title.trim())   newErrors.title   = "Title is required.";
    if (!form.releasedAt)     newErrors.releasedAt = "Release date is required.";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setGeneralError("");
    setIsSaving(true);
    try { await onSave(form); }
    catch (err) { setGeneralError(err instanceof Error ? err.message : "An error occurred."); }
    finally { setIsSaving(false); }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? `Edit — ${editing.version}` : "Add Changelog Entry"} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} noValidate>
        {generalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
            {generalError}
          </div>
        )}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Version" type="text" placeholder="e.g. v1.2.0"
              value={form.version} onChange={(e) => set("version", e.target.value)}
              error={errors.version} autoFocus required
            />
            <Input
              label="Release date" type="date"
              value={form.releasedAt} onChange={(e) => set("releasedAt", e.target.value)}
              error={errors.releasedAt} required
            />
          </div>
          <Input
            label="Title" type="text" placeholder="Brief description of what changed"
            value={form.title} onChange={(e) => set("title", e.target.value)}
            error={errors.title} required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Type</label>
            <select
              value={form.type}
              onChange={(e) => set("type", e.target.value as ChangelogType)}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
            >
              <option value="feature">Feature - new functionality</option>
              <option value="improvement">Improvement - enhancement to existing feature</option>
              <option value="fix">Fix - bug or defect correction</option>
              <option value="breaking">Breaking - change that requires action</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
            <textarea
              rows={4} value={form.description}
              placeholder="Detailed notes about this release (optional)"
              onChange={(e) => set("description", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSaving}>{editing ? "Save changes" : "Add Entry"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ChangelogPage() {
  const { user, canWrite } = useAuth();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ChangelogEntry | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ChangelogEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const res = await fetch("/api/changelog");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load changelog.");
      setEntries(data.entries);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSave(form: ChangelogForm) {
    if (!user) return;
    const url    = editing ? `/api/changelog/${editing.id}` : "/api/changelog";
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
      const res = await fetch(`/api/changelog/${deleteTarget.id}`, {
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Changelog</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Record and communicate what has changed in each release of this platform.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Entry
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
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400 dark:text-slate-500">
            <ScrollText className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium">No changelog entries yet</p>
            {canWrite && (
              <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus className="h-4 w-4" /> Add Entry
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Version</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Title</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Released</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                          <ScrollText className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        </div>
                        <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{entry.version}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${TYPE_BADGE[entry.type]}`}>
                        {TYPE_LABELS[entry.type]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{entry.title}</p>
                        {entry.description && (
                          <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{entry.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-slate-500 sm:table-cell">
                      {new Date(entry.releasedAt).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {canWrite && (
                          <>
                            <button
                              onClick={() => { setEditing(entry); setModalOpen(true); }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                              aria-label={`Edit ${entry.version}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setDeleteTarget(entry); setDeleteError(null); }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
                              aria-label={`Delete ${entry.version}`}
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

      {!isLoading && !fetchError && entries.length > 0 && (
        <p className="text-xs text-slate-400">
          {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
        </p>
      )}

      <EntryModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        onSave={handleSave}
      />

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Entry" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Are you sure you want to delete the changelog entry for{" "}
                <span className="font-semibold font-mono">{deleteTarget?.version}</span>?
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
