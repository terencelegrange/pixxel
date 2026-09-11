"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2, AlertTriangle, FileText, ExternalLink } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Contract, ContractStatus, Vendor } from "@/types";
import { getContractUrgency, ContractUrgency } from "@/lib/contracts";

interface AssetOption { id: string; name: string; }

const STATUSES: ContractStatus[] = ["Active", "Terminated"];

const URGENCY_STYLES: Record<ContractUrgency, { label: string; className: string }> = {
  terminated: { label: "Terminated", className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
  overdue:    { label: "Overdue",    className: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400" },
  critical:   { label: "Expiring soon", className: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400" },
  warning:    { label: "Renewal upcoming", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" },
  active:     { label: "Active", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
};

function formatCurrency(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------
interface ContractForm {
  vendorId: string;
  assetId: string;
  title: string;
  value: string;
  startDate: string;
  endDate: string;
  noticePeriodDays: string;
  autoRenews: boolean;
  owner: string;
  status: ContractStatus;
  docUrl: string;
  notes: string;
}

const EMPTY: ContractForm = {
  vendorId: "", assetId: "", title: "", value: "", startDate: "", endDate: "",
  noticePeriodDays: "", autoRenews: false, owner: "", status: "Active", docUrl: "", notes: "",
};

function contractToForm(c: Contract): ContractForm {
  return {
    vendorId: c.vendorId ?? "",
    assetId: c.assetId ?? "",
    title: c.title,
    value: c.value != null ? String(c.value) : "",
    startDate: c.startDate ?? "",
    endDate: c.endDate ?? "",
    noticePeriodDays: c.noticePeriodDays != null ? String(c.noticePeriodDays) : "",
    autoRenews: c.autoRenews,
    owner: c.owner ?? "",
    status: c.status,
    docUrl: c.docUrl ?? "",
    notes: c.notes ?? "",
  };
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-2 flex items-center gap-3 pt-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{children}</p>
      <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contract modal
// ---------------------------------------------------------------------------
function ContractModal({
  isOpen, onClose, editing, vendors, assets, onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  editing: Contract | null;
  vendors: Vendor[];
  assets: AssetOption[];
  onSave: (form: ContractForm) => Promise<void>;
}) {
  const [form, setForm] = useState<ContractForm>(EMPTY);
  const [titleError, setTitleError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(editing ? contractToForm(editing) : EMPTY);
      setTitleError(""); setGeneralError("");
    }
  }, [isOpen, editing]);

  function set<K extends keyof ContractForm>(key: K, value: ContractForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setTitleError("Contract title is required."); return; }
    setTitleError(""); setGeneralError("");
    setIsSaving(true);
    try { await onSave(form); }
    catch (err) { setGeneralError(err instanceof Error ? err.message : "An error occurred."); }
    finally { setIsSaving(false); }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit — ${editing.title}` : "Add Contract"}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} noValidate>
        {generalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
            {generalError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-4">

          <SectionHeading>Identity</SectionHeading>

          <div className="col-span-2">
            <Input label="Contract title" type="text" placeholder="e.g. Salesforce Enterprise License"
              value={form.title} onChange={(e) => set("title", e.target.value)}
              error={titleError} autoFocus required />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Vendor</label>
            <select
              value={form.vendorId}
              onChange={(e) => set("vendorId", e.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
            >
              <option value="">— no vendor —</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Linked asset</label>
            <select
              value={form.assetId}
              onChange={(e) => set("assetId", e.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
            >
              <option value="">— no asset —</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <SectionHeading>Value &amp; Dates</SectionHeading>

          <Input label="Annual value (USD)" type="number" placeholder="e.g. 50000"
            value={form.value} onChange={(e) => set("value", e.target.value)} />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as ContractStatus)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <Input label="Start date" type="date"
            value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />

          <Input label="End date" type="date"
            value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />

          <Input label="Notice period (days)" type="number" placeholder="e.g. 30"
            value={form.noticePeriodDays} onChange={(e) => set("noticePeriodDays", e.target.value)}
            hint="Days before end date that cancellation notice is due" />

          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="autoRenews"
              checked={form.autoRenews}
              onChange={(e) => set("autoRenews", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="autoRenews" className="text-sm text-slate-700 dark:text-slate-300">
              Auto-renews unless cancelled
            </label>
          </div>

          <SectionHeading>Ownership &amp; Links</SectionHeading>

          <Input label="Owner" type="text" placeholder="Full name"
            value={form.owner} onChange={(e) => set("owner", e.target.value)} />

          <Input label="Document URL" type="url" placeholder="https://..."
            value={form.docUrl} onChange={(e) => set("docUrl", e.target.value)} />

          <SectionHeading>Notes</SectionHeading>

          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
            <textarea rows={3} value={form.notes} placeholder="Renewal terms, negotiation history, additional context…"
              onChange={(e) => set("notes", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSaving}>
            {editing ? "Save changes" : "Add Contract"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ContractsPage() {
  const { user, canWrite } = useAuth();
  const searchParams = useSearchParams();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [vendorFilter, setVendorFilter] = useState(searchParams.get("vendor") ?? "");
  const [statusFilter, setStatusFilter] = useState("");
  const expiringFilter = searchParams.get("expiring");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const qs = new URLSearchParams();
      if (vendorFilter) qs.set("vendor", vendorFilter);
      if (expiringFilter) qs.set("expiring", expiringFilter);
      const [contractsRes, vendorsRes, assetsRes] = await Promise.all([
        fetch(`/api/contracts?${qs.toString()}`),
        fetch("/api/vendors"),
        fetch("/api/assets"),
      ]);
      const contractsData = await contractsRes.json();
      if (!contractsRes.ok) throw new Error(contractsData.error ?? "Failed to load contracts.");
      const vendorsData = await vendorsRes.json();
      const assetsData = await assetsRes.json();
      setContracts(contractsData.contracts);
      setVendors(vendorsData.vendors ?? []);
      setAssets((assetsData.assets ?? []).map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, [vendorFilter, expiringFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = contracts.filter((c) => !statusFilter || c.status === statusFilter);

  async function handleSave(form: ContractForm) {
    if (!user) return;
    const url = editing ? `/api/contracts/${editing.id}` : "/api/contracts";
    const method = editing ? "PUT" : "POST";
    const payload = {
      ...form,
      vendorId: form.vendorId || null,
      assetId: form.assetId || null,
    };
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed.");
    await fetchData();
    setModalOpen(false); setEditing(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/contracts/${deleteTarget.id}`, { method: "DELETE" });
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Contracts</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Vendor contracts, renewal terms, and upcoming expirations.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Contract
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
        >
          <option value="">All vendors</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-700">
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
            <FileText className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium">
              {contracts.length === 0 ? "No contracts added yet" : "No contracts match your filters"}
            </p>
            {contracts.length === 0 && canWrite && (
              <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus className="h-4 w-4" /> Add Contract
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Title</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Vendor</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Asset</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">End Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {filtered.map((contract) => {
                  const urgency = getContractUrgency(contract);
                  const style = URGENCY_STYLES[urgency];
                  return (
                    <tr key={contract.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{contract.title}</p>
                          {contract.docUrl && (
                            <a href={contract.docUrl} target="_blank" rel="noopener noreferrer"
                              className="text-slate-400 hover:text-brand-600" aria-label="Open document">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="hidden px-6 py-4 text-sm text-slate-600 sm:table-cell">
                        {contract.vendorName ?? <span className="italic text-slate-300">—</span>}
                      </td>
                      <td className="hidden px-6 py-4 text-sm text-slate-600 md:table-cell">
                        {contract.assetName ?? <span className="italic text-slate-300">—</span>}
                      </td>
                      <td className="hidden px-6 py-4 text-sm text-slate-600 lg:table-cell">
                        {formatCurrency(contract.value)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatDate(contract.endDate)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {canWrite && (
                            <>
                              <button
                                onClick={() => { setEditing(contract); setModalOpen(true); }}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                                aria-label={`Edit ${contract.title}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => { setDeleteTarget(contract); setDeleteError(null); }}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
                                aria-label={`Delete ${contract.title}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isLoading && !fetchError && contracts.length > 0 && (
        <p className="text-xs text-slate-400">
          {filtered.length} of {contracts.length} contract{contracts.length !== 1 ? "s" : ""}
        </p>
      )}

      <ContractModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        vendors={vendors}
        assets={assets}
        onSave={handleSave}
      />

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Contract" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deleteTarget?.title}</span>?
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
