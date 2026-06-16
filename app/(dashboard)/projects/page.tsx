"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import Link from "next/link";
import { FolderKanban, Pencil, Trash2, AlertTriangle, Plus, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Project, ProjectStatus } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STATUSES: ProjectStatus[] = ["Active", "On Hold", "Completed", "Cancelled"];

const STATUS_STYLES: Record<ProjectStatus, string> = {
  "Active":    "bg-emerald-50 text-emerald-700",
  "On Hold":   "bg-amber-50 text-amber-700",
  "Completed": "bg-blue-50 text-blue-700",
  "Cancelled": "bg-slate-100 text-slate-500",
};

interface ProjectForm {
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
}

const EMPTY_FORM: ProjectForm = {
  name: "", description: "", status: "Active", startDate: "", endDate: "",
};

// ---------------------------------------------------------------------------
// Project Modal (create + edit)
// ---------------------------------------------------------------------------
function ProjectModal({
  isOpen, onClose, initial, onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  initial: ProjectForm | null;
  onSave: (form: ProjectForm) => Promise<void>;
}) {
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);
  const [nameError, setNameError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(initial ?? EMPTY_FORM);
      setNameError(""); setGeneralError("");
    }
  }, [isOpen, initial]);

  function set<K extends keyof ProjectForm>(k: K, v: ProjectForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
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

  const fieldCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? "Edit Project" : "New Project"} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} noValidate>
        {generalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {generalError}
          </div>
        )}
        <div className="flex flex-col gap-4">
          <Input
            label="Project name"
            type="text"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            error={nameError}
            autoFocus
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 resize-none"
              placeholder="What is this project trying to achieve?"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Status</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value as ProjectStatus)} className={fieldCls}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Start date</label>
              <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={fieldCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">End date</label>
              <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className={fieldCls} />
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSaving}>{initial ? "Save changes" : "Create project"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load projects.");
      setProjects(data.projects);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = projects.filter((p) => {
    if (filterStatus && p.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  function projectToForm(p: Project): ProjectForm {
    return {
      name: p.name,
      description: p.description ?? "",
      status: p.status,
      startDate: p.startDate ?? "",
      endDate: p.endDate ?? "",
    };
  }

  async function handleSave(form: ProjectForm) {
    if (!user) return;
    const isEdit = !!editTarget;
    const url = isEdit ? `/api/projects/${editTarget!.id}` : "/api/projects";
    const method = isEdit ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, userId: user.id, userName: user.name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed.");
    await fetchData();
    setModalOpen(false);
    setEditTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget || !user) return;
    setIsDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/projects/${deleteTarget.id}`, {
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

  function fmtDate(d: string | null) {
    if (!d) return null;
    return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  const selectCls = "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Projects</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Track initiatives that use assets to deliver a solution.
          </p>
        </div>
        <Button onClick={() => { setEditTarget(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </div>

      {/* Filters */}
      {!isLoading && !fetchError && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {(search || filterStatus) && (
            <button onClick={() => { setSearch(""); setFilterStatus(""); }} className="text-xs text-slate-400 hover:text-slate-600 underline">
              Clear
            </button>
          )}
          <span className="ml-auto text-xs text-slate-400">
            {filtered.length} of {projects.length} project{projects.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* List */}
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
            <FolderKanban className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium">
              {projects.length === 0 ? "No projects yet — create one to get started" : "No projects match your filters"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <div key={p.id} className="group flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                {/* Icon */}
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50">
                  <FolderKanban className="h-5 w-5 text-brand-600" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/projects/${p.id}`} className="font-medium text-slate-900 hover:text-brand-600 transition-colors">
                      {p.name}
                    </Link>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status]}`}>
                      {p.status}
                    </span>
                  </div>
                  {p.description && (
                    <p className="mt-0.5 text-sm text-slate-500 truncate">{p.description}</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>{p.assetCount} asset{p.assetCount !== 1 ? "s" : ""}</span>
                    {p.startDate && <span>Start: {fmtDate(p.startDate)}</span>}
                    {p.endDate && <span>End: {fmtDate(p.endDate)}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditTarget(p); setModalOpen(true); }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { setDeleteTarget(p); setDeleteError(null); }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    aria-label={`Delete ${p.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <Link
                    href={`/projects/${p.id}`}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    aria-label={`Open ${p.name}`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project Modal */}
      <ProjectModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        initial={editTarget ? projectToForm(editTarget) : null}
        onSave={handleSave}
      />

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Project" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700">
                Delete <span className="font-semibold">{deleteTarget?.name}</span>? This will remove all linked assets from the project. This action cannot be undone.
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
