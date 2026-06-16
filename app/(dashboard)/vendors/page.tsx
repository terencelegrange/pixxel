"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { Plus, Pencil, Trash2, AlertTriangle, ExternalLink, Package2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Vendor } from "@/types";

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------
const CONTACT_ROLES = [
  "Account Manager",
  "Customer Success Manager",
  "Solution Architect",
  "Technical Account Manager",
  "Sales Representative",
  "Support Engineer",
  "Implementation Consultant",
  "Professional Services",
  "Partner Manager",
  "Other",
] as const;

interface VendorForm {
  name: string;
  website: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  country: string;
  postalCode: string;
  primaryContactName: string;
  primaryContactRole: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  notes: string;
}

const EMPTY: VendorForm = {
  name: "", website: "", email: "", phone: "",
  addressLine1: "", addressLine2: "", city: "", stateProvince: "",
  country: "", postalCode: "",
  primaryContactName: "", primaryContactRole: "", primaryContactEmail: "", primaryContactPhone: "",
  notes: "",
};

function vendorToForm(v: Vendor): VendorForm {
  return {
    name:                v.name,
    website:             v.website             ?? "",
    email:               v.email               ?? "",
    phone:               v.phone               ?? "",
    addressLine1:        v.addressLine1        ?? "",
    addressLine2:        v.addressLine2        ?? "",
    city:                v.city                ?? "",
    stateProvince:       v.stateProvince       ?? "",
    country:             v.country             ?? "",
    postalCode:          v.postalCode          ?? "",
    primaryContactName:  v.primaryContactName  ?? "",
    primaryContactRole:  v.primaryContactRole  ?? "",
    primaryContactEmail: v.primaryContactEmail ?? "",
    primaryContactPhone: v.primaryContactPhone ?? "",
    notes:               v.notes               ?? "",
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-2 flex items-center gap-3 pt-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{children}</p>
      <div className="flex-1 border-t border-slate-100" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vendor modal
// ---------------------------------------------------------------------------
function VendorModal({
  isOpen, onClose, editing, onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  editing: Vendor | null;
  onSave: (form: VendorForm) => Promise<void>;
}) {
  const [form, setForm] = useState<VendorForm>(EMPTY);
  const [nameError, setNameError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(editing ? vendorToForm(editing) : EMPTY);
      setNameError(""); setGeneralError("");
    }
  }, [isOpen, editing]);

  function set(key: keyof VendorForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setNameError("Vendor name is required."); return; }
    setNameError(""); setGeneralError("");
    setIsSaving(true);
    try { await onSave(form); }
    catch (err) { setGeneralError(err instanceof Error ? err.message : "An error occurred."); }
    finally { setIsSaving(false); }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit — ${editing.name}` : "Add Vendor"}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} noValidate>
        {generalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {generalError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-4">

          {/* Identity */}
          <SectionHeading>Identity</SectionHeading>

          <div className="col-span-2 sm:col-span-1">
            <Input label="Vendor name" type="text" placeholder="e.g. Salesforce Inc."
              value={form.name} onChange={(e) => set("name", e.target.value)}
              error={nameError} autoFocus required />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <Input label="Website" type="url" placeholder="https://example.com"
              value={form.website} onChange={(e) => set("website", e.target.value)} />
          </div>

          <Input label="General email" type="email" placeholder="info@example.com"
            value={form.email} onChange={(e) => set("email", e.target.value)} />

          <Input label="General phone" type="text" placeholder="+1 555 000 0000"
            value={form.phone} onChange={(e) => set("phone", e.target.value)} />

          {/* Address */}
          <SectionHeading>Address</SectionHeading>

          <div className="col-span-2">
            <Input label="Address line 1" type="text" placeholder="Street address"
              value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} />
          </div>

          <div className="col-span-2">
            <Input label="Address line 2" type="text" placeholder="Suite, floor, building…"
              value={form.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} />
          </div>

          <Input label="City" type="text" placeholder="City"
            value={form.city} onChange={(e) => set("city", e.target.value)} />

          <Input label="State / Province" type="text" placeholder="State or province"
            value={form.stateProvince} onChange={(e) => set("stateProvince", e.target.value)} />

          <Input label="Country" type="text" placeholder="Country"
            value={form.country} onChange={(e) => set("country", e.target.value)} />

          <Input label="Postal code" type="text" placeholder="Postal / ZIP code"
            value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />

          {/* Primary contact */}
          <SectionHeading>Primary Contact</SectionHeading>

          <Input label="Contact name" type="text" placeholder="Full name"
            value={form.primaryContactName} onChange={(e) => set("primaryContactName", e.target.value)} />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Role</label>
            <select
              value={form.primaryContactRole}
              onChange={(e) => set("primaryContactRole", e.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— select role —</option>
              {CONTACT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <Input label="Contact phone" type="text" placeholder="+1 555 000 0000"
            value={form.primaryContactPhone} onChange={(e) => set("primaryContactPhone", e.target.value)} />

          <div className="col-span-2">
            <Input label="Contact email" type="email" placeholder="contact@example.com"
              value={form.primaryContactEmail} onChange={(e) => set("primaryContactEmail", e.target.value)} />
          </div>

          {/* Notes */}
          <SectionHeading>Notes</SectionHeading>

          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Notes</label>
            <textarea rows={3} value={form.notes} placeholder="Contract details, account numbers, additional context…"
              onChange={(e) => set("notes", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 resize-none"
            />
          </div>

        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSaving}>
            {editing ? "Save changes" : "Add Vendor"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function VendorsPage() {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const res = await fetch("/api/vendors");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load vendors.");
      setVendors(data.vendors);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = vendors.filter((v) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      (v.primaryContactName?.toLowerCase().includes(q)) ||
      (v.email?.toLowerCase().includes(q)) ||
      (v.country?.toLowerCase().includes(q))
    );
  });

  async function handleSave(form: VendorForm) {
    if (!user) return;
    const url    = editing ? `/api/vendors/${editing.id}` : "/api/vendors";
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
      const res = await fetch(`/api/vendors/${deleteTarget.id}`, {
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Vendors</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage software and technology suppliers.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Vendor
        </Button>
      </div>

      {/* Search */}
      <div>
        <input
          type="search"
          placeholder="Search by name, contact, email, country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Table */}
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
            <Package2 className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium">
              {vendors.length === 0 ? "No vendors added yet" : "No vendors match your search"}
            </p>
            {vendors.length === 0 && (
              <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus className="h-4 w-4" /> Add Vendor
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Vendor</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Primary Contact</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Email</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Phone</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 xl:table-cell">Role</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filtered.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
                          <Package2 className="h-4 w-4 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{vendor.name}</p>
                          {vendor.website && (
                            <a href={vendor.website} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {vendor.website.replace(/^https?:\/\//, "")}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 sm:table-cell">
                      {vendor.primaryContactName
                        ? (
                          <div>
                            <p className="text-sm text-slate-600">{vendor.primaryContactName}</p>
                            {vendor.primaryContactRole && (
                              <p className="text-xs text-slate-400">{vendor.primaryContactRole}</p>
                            )}
                          </div>
                        )
                        : <span className="italic text-sm text-slate-300">—</span>
                      }
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-slate-600 md:table-cell">
                      {vendor.primaryContactEmail
                        ? <a href={`mailto:${vendor.primaryContactEmail}`} className="hover:text-brand-600 hover:underline">{vendor.primaryContactEmail}</a>
                        : <span className="italic text-slate-300">—</span>
                      }
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-slate-600 lg:table-cell">
                      {vendor.primaryContactPhone || <span className="italic text-slate-300">—</span>}
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-slate-600 xl:table-cell">
                      {vendor.primaryContactRole || <span className="italic text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditing(vendor); setModalOpen(true); }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                          aria-label={`Edit ${vendor.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setDeleteTarget(vendor); setDeleteError(null); }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          aria-label={`Delete ${vendor.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
      {!isLoading && !fetchError && vendors.length > 0 && (
        <p className="text-xs text-slate-400">
          {filtered.length} of {vendors.length} vendor{vendors.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Create / Edit Modal */}
      <VendorModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Vendor" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deleteTarget?.name}</span>?
                Any assets linked to this vendor will be unassigned.
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
