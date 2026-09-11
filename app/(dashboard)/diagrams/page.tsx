"use client";

import { useState, useEffect, useCallback, FormEvent, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, Search, GitBranch, Pencil, Trash2,
  AlertTriangle, Layers, Filter, X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Diagram, DiagramType, Project } from "@/types";

// ---------------------------------------------------------------------------
// Create / edit modal
// ---------------------------------------------------------------------------
interface DiagramForm {
  name: string;
  description: string;
  projectId: string;
  diagramTypeId: string;
}

const EMPTY: DiagramForm = { name: "", description: "", projectId: "", diagramTypeId: "" };

// Badge colours per type name (falls back to slate)
const TYPE_COLOURS: Record<string, string> = {
  Domain:   "bg-blue-50 text-blue-700",
  Program:  "bg-violet-50 text-violet-700",
  Solution: "bg-emerald-50 text-emerald-700",
  Detailed: "bg-amber-50 text-amber-700",
};

function DiagramModal({
  isOpen,
  onClose,
  initial,
  projects,
  diagramTypes,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  initial: DiagramForm | null;
  projects: Project[];
  diagramTypes: DiagramType[];
  onSave: (form: DiagramForm) => Promise<void>;
}) {
  const [form, setForm] = useState<DiagramForm>(EMPTY);
  const [nameError, setNameError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(initial ?? EMPTY);
      setNameError("");
      setGeneralError("");
    }
  }, [isOpen, initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setNameError("Name is required."); return; }
    setIsSaving(true);
    setGeneralError("");
    try {
      await onSave(form);
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initial ? "Edit Diagram" : "New Diagram"}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setNameError(""); }}
          error={nameError}
          placeholder="e.g. Payment Platform Overview"
          required
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">
            Description <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="What does this diagram show?"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Type <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <select
              value={form.diagramTypeId}
              onChange={(e) => setForm((f) => ({ ...f, diagramTypeId: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">— No type —</option>
              {diagramTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Project <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <select
              value={form.projectId}
              onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">— No project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        {generalError && <p className="text-sm text-red-500">{generalError}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSaving}>
            {initial ? "Save Changes" : "Create Diagram"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function DiagramsPage() {
  const { user, canWrite } = useAuth();
  const router = useRouter();

  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [diagramTypes, setDiagramTypes] = useState<DiagramType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterEditor, setFilterEditor] = useState("");

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Diagram | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Diagram | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/diagrams").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/diagram-types").then((r) => r.json()),
    ])
      .then(([diagData, projData, typesData]) => {
        setDiagrams(diagData.diagrams ?? []);
        setProjects(projData.projects ?? []);
        setDiagramTypes(typesData.types ?? []);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived filter options (unique editors from data) ────────────────────
  const editorOptions = useMemo(() => {
    const names = new Set<string>();
    diagrams.forEach((d) => {
      if (d.lastModifiedByName) names.add(d.lastModifiedByName);
      names.add(d.createdByName);
    });
    return Array.from(names).sort();
  }, [diagrams]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return diagrams.filter((d) => {
      if (search && !d.name.toLowerCase().includes(search.toLowerCase()) &&
          !(d.description ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      if (filterProject === "__none__" && d.projectId !== null) return false;
      if (filterProject && filterProject !== "__none__" && d.projectId !== filterProject) return false;
      if (filterType === "__none__" && d.diagramTypeId !== null) return false;
      if (filterType && filterType !== "__none__" && d.diagramTypeId !== filterType) return false;
      if (filterEditor) {
        const match = d.lastModifiedByName === filterEditor || d.createdByName === filterEditor;
        if (!match) return false;
      }
      return true;
    });
  }, [diagrams, search, filterProject, filterType, filterEditor]);

  const hasActiveFilters = !!(filterProject || filterType || filterEditor);

  function clearFilters() {
    setFilterProject("");
    setFilterType("");
    setFilterEditor("");
    setSearch("");
  }

  // ── Create ────────────────────────────────────────────────────────────────
  async function handleCreate(form: DiagramForm) {
    if (!user) return;
    const res = await fetch("/api/diagrams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim() || null,
        projectId: form.projectId || null,
        diagramTypeId: form.diagramTypeId || null,
        userId: user.id,
        userName: user.name,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to create.");
    setCreateOpen(false);
    router.push(`/diagrams/${data.id}`);
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  async function handleEdit(form: DiagramForm) {
    if (!user || !editTarget) return;
    const res = await fetch(`/api/diagrams/${editTarget.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim() || null,
        projectId: form.projectId || null,
        diagramTypeId: form.diagramTypeId || null,
        userId: user.id,
        userName: user.name,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to update.");
    setEditTarget(null);
    load();
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!user || !deleteTarget) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/diagrams/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, userName: user.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsDeleting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Architecture Diagrams</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Create and manage interactive architecture diagrams with asset references.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Diagram
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-52 flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search diagrams…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-slate-300 py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All types</option>
            <option value="__none__">No type</option>
            {diagramTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Project filter */}
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="rounded-lg border border-slate-300 py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All projects</option>
          <option value="__none__">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Editor filter */}
        <select
          value={filterEditor}
          onChange={(e) => setFilterEditor(e.target.value)}
          className="rounded-lg border border-slate-300 py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All editors</option>
          {editorOptions.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        {/* Clear filters */}
        {(hasActiveFilters || search) && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}

        <span className="ml-auto text-sm text-slate-400">
          {filtered.length} diagram{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
            <Layers className="h-10 w-10 text-slate-300" />
            <p className="text-sm">
              {search || hasActiveFilters
                ? "No diagrams match your filters."
                : "No diagrams yet. Create your first one."}
            </p>
            {!search && !hasActiveFilters && canWrite && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> New Diagram
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden sm:table-cell">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Project</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 w-20">Ver.</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 w-20">Assets</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden lg:table-cell">Last Modified By</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Modified</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <Link href={`/diagrams/${d.id}`} className="flex items-center gap-2 group">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                          <GitBranch className="h-4 w-4 text-brand-500" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-slate-900 group-hover:text-brand-600 transition-colors">
                            {d.name}
                          </span>
                          {d.description && (
                            <p className="text-xs text-slate-400 truncate max-w-xs">{d.description}</p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      {d.diagramTypeName ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLOURS[d.diagramTypeName] ?? "bg-slate-100 text-slate-600"}`}>
                          {d.diagramTypeName}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      {d.projectName ? (
                        <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                          {d.projectName}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        v{d.latestVersion}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-sm text-slate-600">{d.assetCount}</span>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <span className="text-sm text-slate-600">
                        {d.lastModifiedByName ?? d.createdByName}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="text-sm text-slate-500">
                        {new Date(d.updatedAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canWrite && (
                          <>
                            <button
                              onClick={() => setEditTarget(d)}
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setDeleteTarget(d); setDeleteError(""); }}
                              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                              title="Delete"
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

      {/* Create modal */}
      <DiagramModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        initial={null}
        projects={projects}
        diagramTypes={diagramTypes}
        onSave={handleCreate}
      />

      {/* Edit modal */}
      <DiagramModal
        isOpen={editTarget !== null}
        onClose={() => setEditTarget(null)}
        initial={
          editTarget
            ? {
                name: editTarget.name,
                description: editTarget.description ?? "",
                projectId: editTarget.projectId ?? "",
                diagramTypeId: editTarget.diagramTypeId ?? "",
              }
            : null
        }
        projects={projects}
        diagramTypes={diagramTypes}
        onSave={handleEdit}
      />

      {/* Delete confirmation */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Diagram"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deleteTarget?.name}</span>?
                All versions and canvas data will be permanently removed.
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
