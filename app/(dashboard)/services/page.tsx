"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import Link from "next/link";
import { Layers, Pencil, Trash2, AlertTriangle, Plus, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { slugify } from "@/lib/slug";
import { Service, ServiceStatus, Tier, Domain, User } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STATUSES: ServiceStatus[] = ["Planned", "Active", "Degraded", "Retired"];

const STATUS_STYLES: Record<ServiceStatus, string> = {
  "Planned":  "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Active":   "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Degraded": "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Retired":  "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

interface ServiceForm {
  name: string;
  slug: string;
  description: string;
  status: ServiceStatus;
  tierId: string;
  domainId: string;
  businessOwner: string;
  technicalOwner: string;
}

const EMPTY_FORM: ServiceForm = {
  name: "", slug: "", description: "", status: "Planned",
  tierId: "", domainId: "", businessOwner: "", technicalOwner: "",
};

// ---------------------------------------------------------------------------
// Service Modal (create + edit)
// ---------------------------------------------------------------------------
function ServiceModal({
  isOpen, onClose, initial, tiers, domains, users, onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  initial: ServiceForm | null;
  tiers: Tier[];
  domains: Domain[];
  users: User[];
  onSave: (form: ServiceForm) => Promise<void>;
}) {
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [nameError, setNameError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(initial ?? EMPTY_FORM);
      // Editing an existing service: the slug already exists, so treat it
      // as "manually set" — renaming must not silently change it.
      setSlugManuallyEdited(!!initial);
      setNameError(""); setGeneralError("");
    }
  }, [isOpen, initial]);

  function set<K extends keyof ServiceForm>(k: K, v: ServiceForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleNameChange(name: string) {
    setForm((f) => ({
      ...f,
      name,
      slug: slugManuallyEdited ? f.slug : slugify(name),
    }));
  }

  function handleSlugChange(slug: string) {
    setSlugManuallyEdited(true);
    set("slug", slug);
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

  const fieldCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? "Edit Service" : "New Service"} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} noValidate>
        {generalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
            {generalError}
          </div>
        )}
        <div className="flex flex-col gap-4">
          <Input
            label="Service name"
            type="text"
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            error={nameError}
            autoFocus
            required
          />
          <Input
            label="Slug"
            type="text"
            value={form.slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            hint="Used in URLs. Auto-generated from the name until you edit it directly."
            placeholder={slugify(form.name) || "service-slug"}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
              placeholder="What business capability does this service represent?"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value as ServiceStatus)} className={fieldCls}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tier</label>
              <select value={form.tierId} onChange={(e) => set("tierId", e.target.value)} className={fieldCls}>
                <option value="">— Unassigned —</option>
                {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Domain</label>
              <select value={form.domainId} onChange={(e) => set("domainId", e.target.value)} className={fieldCls}>
                <option value="">— Unassigned —</option>
                {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Business owner</label>
              <select value={form.businessOwner} onChange={(e) => set("businessOwner", e.target.value)} className={fieldCls}>
                <option value="">— Unassigned —</option>
                {users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Technical owner</label>
              <select value={form.technicalOwner} onChange={(e) => set("technicalOwner", e.target.value)} className={fieldCls}>
                <option value="">— Unassigned —</option>
                {users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSaving}>{initial ? "Save changes" : "Create service"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ServicesPage() {
  const { user, canWrite } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const [servicesRes, tiersRes, domainsRes, usersRes] = await Promise.all([
        fetch("/api/services"),
        fetch("/api/tiers"),
        fetch("/api/domains"),
        fetch("/api/users"),
      ]);
      const servicesData = await servicesRes.json();
      const tiersData = await tiersRes.json();
      const domainsData = await domainsRes.json();
      const usersData = await usersRes.json();
      if (!servicesRes.ok) throw new Error(servicesData.error ?? "Failed to load services.");
      setServices(servicesData.services);
      setTiers(tiersData.tiers ?? []);
      setDomains(domainsData.domains ?? []);
      setUsers(usersData.users ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = services.filter((s) => {
    if (filterStatus && s.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  function serviceToForm(s: Service): ServiceForm {
    return {
      name: s.name,
      slug: s.slug,
      description: s.description ?? "",
      status: s.status,
      tierId: s.tierId ?? "",
      domainId: s.domainId ?? "",
      businessOwner: s.businessOwner ?? "",
      technicalOwner: s.technicalOwner ?? "",
    };
  }

  async function handleSave(form: ServiceForm) {
    if (!user) return;
    const isEdit = !!editTarget;
    const url = isEdit ? `/api/services/${editTarget!.id}` : "/api/services";
    const method = isEdit ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed.");
    await fetchData();
    setModalOpen(false);
    setEditTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/services/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      await fetchData();
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setIsDeleting(false); }
  }

  const selectCls = "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Business Services</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            The catalogue of business services composed from your assets.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditTarget(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" /> New Service
          </Button>
        )}
      </div>

      {/* Filters */}
      {!isLoading && !fetchError && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search services…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
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
            {filtered.length} of {services.length} service{services.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* List */}
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
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
            <Layers className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium">
              {services.length === 0 ? "No services yet — create one to get started" : "No services match your filters"}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800">
                <th className="px-6 py-3">Name</th>
                <th className="px-3 py-3">Slug</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Tier</th>
                <th className="px-3 py-3">Domain</th>
                <th className="px-3 py-3">Assets</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((s) => (
                <tr key={s.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50">
                        <Layers className="h-4 w-4 text-brand-600" />
                      </div>
                      <div className="min-w-0">
                        <Link href={`/services/${s.id}`} className="font-medium text-slate-900 dark:text-slate-100 hover:text-brand-600 transition-colors">
                          {s.name}
                        </Link>
                        {s.description && (
                          <p className="text-xs text-slate-400 truncate max-w-xs">{s.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-slate-500 dark:text-slate-400 font-mono text-xs">{s.slug}</td>
                  <td className="px-3 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status]}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-slate-600 dark:text-slate-300">{s.tierName ?? "—"}</td>
                  <td className="px-3 py-3.5 text-slate-600 dark:text-slate-300">{s.domainName ?? "—"}</td>
                  <td className="px-3 py-3.5 text-slate-500 dark:text-slate-400">{s.assetCount ?? 0}</td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canWrite && (
                        <>
                          <button
                            onClick={() => { setEditTarget(s); setModalOpen(true); }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                            aria-label={`Edit ${s.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => { setDeleteTarget(s); setDeleteError(null); }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
                            aria-label={`Delete ${s.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <Link
                        href={`/services/${s.id}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                        aria-label={`Open ${s.name}`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Service Modal */}
      <ServiceModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        initial={editTarget ? serviceToForm(editTarget) : null}
        tiers={tiers}
        domains={domains}
        users={users}
        onSave={handleSave}
      />

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Service" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700">
                Delete <span className="font-semibold">{deleteTarget?.name}</span>? This will remove all linked assets from the service. This action cannot be undone.
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
