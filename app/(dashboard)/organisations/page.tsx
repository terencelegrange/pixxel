"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { Plus, Pencil, Trash2, Building2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Department } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DeptStatus = "Published" | "Unpublished";

interface FormState {
  name: string;
  description: string;
  status: DeptStatus;
}

interface FormErrors {
  name?: string;
  general?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: DeptStatus }) {
  return status === "Published" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Published
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Unpublished
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function OrganisationsPage() {
  const { user, canWrite } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", description: "", status: "Unpublished" });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------
  const fetchDepartments = useCallback(async () => {
    setIsLoadingData(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/organisations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load.");
      setDepartments(data.departments);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load departments.");
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  // ---------------------------------------------------------------------------
  // Create / Edit modal
  // ---------------------------------------------------------------------------
  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", status: "Unpublished" });
    setFormErrors({});
    setModalOpen(true);
  }

  function openEdit(dept: Department) {
    setEditing(dept);
    setForm({ name: dept.name, description: dept.description ?? "", status: dept.status });
    setFormErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setFormErrors({});
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormErrors({ name: "Department name is required." });
      return;
    }
    if (!user) return;

    setIsSaving(true);
    setFormErrors({});

    try {
      const url = editing ? `/api/organisations/${editing.id}` : "/api/organisations";
      const method = editing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          status: form.status,
          userId: user.id,
          userName: user.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");

      await fetchDepartments();
      closeModal();
    } catch (err) {
      setFormErrors({
        general: err instanceof Error ? err.message : "An error occurred.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  function openDelete(dept: Department) {
    setDeleteTarget(dept);
    setDeleteError(null);
  }

  function closeDelete() {
    setDeleteTarget(null);
    setDeleteError(null);
  }

  async function handleDelete() {
    if (!deleteTarget || !user) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/organisations/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, userName: user.name }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");

      await fetchDepartments();
      closeDelete();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsDeleting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Departments</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Configure the organisational departments that own applications.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate} size="md">
            <Plus className="h-4 w-4" />
            Add Department
          </Button>
        )}
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
        {isLoadingData ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-red-500">
            <AlertTriangle className="h-6 w-6" />
            <p className="text-sm">{fetchError}</p>
            <Button variant="secondary" size="sm" onClick={fetchDepartments}>Retry</Button>
          </div>
        ) : departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400 dark:text-slate-500">
            <Building2 className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium">No departments yet</p>
            <p className="text-xs text-slate-400">Add your first department to get started.</p>
            {canWrite && (
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add Department
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Name
                  </th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">
                    Last Modified
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {departments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50">
                          <Building2 className="h-4 w-4 text-brand-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">{dept.name}</p>
                          <p className="text-xs text-slate-400 sm:hidden">
                            {dept.description ?? <span className="italic">No description</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 sm:table-cell">
                      <span className="text-sm text-slate-500">
                        {dept.description ?? (
                          <span className="italic text-slate-300">No description</span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={dept.status} />
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-slate-500 lg:table-cell whitespace-nowrap">
                      {formatDateTime(dept.updatedAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {canWrite && (
                          <>
                            <button
                              onClick={() => openEdit(dept)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                              aria-label={`Edit ${dept.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openDelete(dept)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
                              aria-label={`Delete ${dept.name}`}
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

      {/* Count footer */}
      {!isLoadingData && !fetchError && departments.length > 0 && (
        <p className="text-xs text-slate-400">
          {departments.length} department{departments.length !== 1 ? "s" : ""} &middot;{" "}
          {departments.filter((d) => d.status === "Published").length} published
        </p>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Create / Edit Modal                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? "Edit Department" : "Add Department"}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
          {formErrors.general && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
              {formErrors.general}
            </div>
          )}

          <Input
            label="Department name"
            type="text"
            placeholder="e.g. Engineering"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            error={formErrors.name}
            autoFocus
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Description <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Brief description of this department's responsibilities..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as DeptStatus }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
            >
              <option value="Unpublished">Unpublished</option>
              <option value="Published">Published</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {editing ? "Save changes" : "Add Department"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Delete Confirmation Modal                                           */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={closeDelete}
        title="Delete Department"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deleteTarget?.name}</span>?
                This action cannot be undone.
              </p>
              {deleteError && (
                <p className="mt-2 text-sm text-red-500">{deleteError}</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={closeDelete}>Cancel</Button>
            <Button variant="danger" isLoading={isDeleting} onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
