"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2, AlertTriangle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Role, PermissionLevel } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
interface RoleForm {
  name: string;
  description: string;
  permissionLevel: PermissionLevel;
}

const EMPTY_FORM: RoleForm = { name: "", description: "", permissionLevel: "member" };

function roleToForm(r: Role): RoleForm {
  return { name: r.name, description: r.description ?? "", permissionLevel: r.permissionLevel };
}

const PERMISSION_BADGE: Record<PermissionLevel, string> = {
  "read-only": "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  "member":    "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "admin":     "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  "read-only": "Read-Only",
  "member":    "Member",
  "admin":     "Admin",
};

// ---------------------------------------------------------------------------
// Role modal
// ---------------------------------------------------------------------------
function RoleModal({
  isOpen, onClose, editing, onSave,
}: {
  isOpen: boolean; onClose: () => void; editing: Role | null;
  onSave: (form: RoleForm) => Promise<void>;
}) {
  const [form, setForm] = useState<RoleForm>(EMPTY_FORM);
  const [nameError, setNameError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(editing ? roleToForm(editing) : EMPTY_FORM);
      setNameError(""); setGeneralError("");
    }
  }, [isOpen, editing]);

  function set<K extends keyof RoleForm>(key: K, value: RoleForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setNameError("Role name is required."); return; }
    setNameError(""); setGeneralError("");
    setIsSaving(true);
    try { await onSave(form); }
    catch (err) { setGeneralError(err instanceof Error ? err.message : "An error occurred."); }
    finally { setIsSaving(false); }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? `Edit — ${editing.name}` : "Add Role"} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} noValidate>
        {generalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
            {generalError}
          </div>
        )}
        <div className="flex flex-col gap-4">
          <Input
            label="Role name" type="text" placeholder="e.g. Viewer, Contributor, Owner"
            value={form.name} onChange={(e) => set("name", e.target.value)}
            error={nameError} autoFocus required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
            <textarea
              rows={3} value={form.description}
              placeholder="What can users with this role do?"
              onChange={(e) => set("description", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Permission level</label>
            <select
              value={form.permissionLevel}
              onChange={(e) => set("permissionLevel", e.target.value as PermissionLevel)}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
            >
              <option value="read-only">Read-Only — view only, no changes</option>
              <option value="member">Member — add and manage assets</option>
              <option value="admin">Admin — full access including user management</option>
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSaving}>{editing ? "Save changes" : "Add Role"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function RolesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const res = await fetch("/api/roles");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load roles.");
      setRoles(data.roles);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = roles.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || (r.description?.toLowerCase().includes(q) ?? false);
  });

  async function handleSave(form: RoleForm) {
    if (!user) return;
    const url    = editing ? `/api/roles/${editing.id}` : "/api/roles";
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
      const res = await fetch(`/api/roles/${deleteTarget.id}`, {
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
      {/* Back link */}
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Roles</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Define roles and their permission levels. Assign roles to users from the Users page.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Role
          </Button>
        )}
      </div>

      {/* Search */}
      <div>
        <input
          type="search"
          placeholder="Search by name or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      {/* Table */}
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
            <ShieldCheck className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium">
              {roles.length === 0 ? "No roles defined yet" : "No roles match your search"}
            </p>
            {roles.length === 0 && isAdmin && (
              <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus className="h-4 w-4" /> Add Role
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Role</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Permission</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {filtered.map((role) => (
                  <tr key={role.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                          <ShieldCheck className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        </div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{role.name}</p>
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-slate-600 sm:table-cell max-w-xs">
                      {role.description
                        ? <span className="line-clamp-1">{role.description}</span>
                        : <span className="italic text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PERMISSION_BADGE[role.permissionLevel]}`}>
                        {PERMISSION_LABELS[role.permissionLevel]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => { setEditing(role); setModalOpen(true); }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                              aria-label={`Edit ${role.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setDeleteTarget(role); setDeleteError(null); }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
                              aria-label={`Delete ${role.name}`}
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

      {/* Footer count */}
      {!isLoading && !fetchError && roles.length > 0 && (
        <p className="text-xs text-slate-400">
          {filtered.length} of {roles.length} role{roles.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Create / Edit Modal */}
      <RoleModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Role" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deleteTarget?.name}</span>?
                Any users assigned to this role will be unassigned.
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
