"use client";

import { FormEvent, useState, useEffect } from "react";
import * as LucideIcons from "lucide-react";
import type { LucideProps } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Asset, AssetCategory, AssetComplexity, AssetType, AssetStrategy, BusinessCapability, Department, Diagram, Domain, IndustrySector, LifecycleStatus, Tier, User, Vendor } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const ASSET_TYPES: AssetType[] = [
  "SaaS", "On-Premise", "Hybrid", "Cloud", "Open Source", "Other",
];

export const LIFECYCLE_STATUSES: LifecycleStatus[] = [
  "Proposed", "Approved", "In Development", "Production", "Sunset", "Retired",
];

export const ASSET_CATEGORIES: AssetCategory[] = [
  "Application", "Platform", "API / Web Service", "Database", "Infrastructure",
  "Integration / Middleware", "Data / Analytics", "Security Tool", "Development Tool", "Other",
];

// Curated set of Lucide icons suited to enterprise technology assets
export const ASSET_ICONS: string[] = [
  // Infrastructure & hosting
  "Server", "Database", "HardDrive", "Cpu", "Network", "Cloud", "Wifi", "Globe",
  // Devices
  "Monitor", "Laptop", "Smartphone", "Tablet", "Printer", "Watch", "Headphones", "Camera",
  // Code & development
  "Code", "Code2", "Terminal", "GitBranch", "Package", "Box", "Layers", "Braces",
  // Security
  "Shield", "ShieldCheck", "Lock", "Key", "Fingerprint", "Eye", "Bug", "AlertTriangle",
  // Data & analytics
  "BarChart", "BarChart2", "LineChart", "PieChart", "Activity", "TrendingUp", "Table", "Search",
  // Documents & comms
  "FileText", "File", "Mail", "MessageSquare", "Bell", "BookOpen", "Rss", "Link",
  // Business
  "Briefcase", "Building2", "Users", "CreditCard", "ShoppingCart", "Zap", "Plug", "Settings",
];

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------
export interface AssetFormState {
  name: string;
  shortCode: string;
  description: string;
  type: AssetType;
  category: AssetCategory;
  icon: string;
  lifecycleStatus: LifecycleStatus;
  departmentIds: string[];
  architectIds: string[];
  capabilityIds: string[];
  tierId: string;
  strategyId: string;
  complexityId: string;
  domainId: string;
  vendorId: string;
  businessOwner: string;
  technicalOwner: string;
  slaAvailability: string;
  slaRto: string;
  slaRpo: string;
  goLiveDate: string;
  retirementDate: string;
  appUrl: string;
  docUrl: string;
  contractEndDate: string;
  contractAmount: string;
  notes: string;
  heroDiagramId: string;
}

export const EMPTY_FORM: AssetFormState = {
  name: "", shortCode: "", description: "",
  type: "SaaS", category: "Application", icon: "Server",
  lifecycleStatus: "Proposed",
  departmentIds: [], architectIds: [], capabilityIds: [], tierId: "", strategyId: "", complexityId: "", domainId: "", vendorId: "",
  businessOwner: "", technicalOwner: "",
  slaAvailability: "", slaRto: "", slaRpo: "",
  goLiveDate: "", retirementDate: "",
  appUrl: "", docUrl: "", contractEndDate: "", contractAmount: "",
  notes: "",
  heroDiagramId: "",
};

export function assetToForm(asset: Asset): AssetFormState {
  return {
    name: asset.name,
    shortCode: asset.shortCode ?? "",
    description: asset.description ?? "",
    type: asset.type,
    category: asset.category,
    icon: asset.icon ?? "Server",
    lifecycleStatus: asset.lifecycleStatus,
    departmentIds: asset.departmentIds,
    architectIds: asset.architectIds,
    capabilityIds: asset.capabilityIds,
    tierId: asset.tierId ?? "",
    strategyId: asset.strategyId ?? "",
    complexityId: asset.complexityId ?? "",
    domainId: asset.domainId ?? "",
    vendorId: asset.vendorId ?? "",
    businessOwner: asset.businessOwner ?? "",
    technicalOwner: asset.technicalOwner ?? "",
    slaAvailability: asset.slaAvailability ?? "",
    slaRto: asset.slaRto ?? "",
    slaRpo: asset.slaRpo ?? "",
    goLiveDate: asset.goLiveDate ?? "",
    retirementDate: asset.retirementDate ?? "",
    appUrl: asset.appUrl ?? "",
    docUrl: asset.docUrl ?? "",
    contractEndDate: asset.contractEndDate ?? "",
    contractAmount: asset.contractAmount != null ? String(asset.contractAmount) : "",
    notes: asset.notes ?? "",
    heroDiagramId: asset.heroDiagramId ?? "",
  };
}

// ---------------------------------------------------------------------------
// Icon resolver helper (shared with list/detail pages)
// ---------------------------------------------------------------------------
export function AssetIcon({
  name, ...props
}: { name: string | null } & LucideProps) {
  const Icon = name
    ? (LucideIcons as unknown as Record<string, React.ComponentType<LucideProps>>)[name]
    : null;
  return Icon ? <Icon {...props} /> : <LucideIcons.Server {...props} />;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-2 flex items-center gap-3 pt-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{children}</p>
      <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
    </div>
  );
}

function SelectField({
  label, value, onChange, children, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  children: React.ReactNode; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        {children}
      </select>
    </div>
  );
}

function TextAreaField({
  label, value, onChange, placeholder, rows = 3,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <div className="col-span-2 flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 resize-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icon picker
// ---------------------------------------------------------------------------
function IconPicker({
  value, onChange,
}: {
  value: string; onChange: (icon: string) => void;
}) {
  return (
    <div className="col-span-2 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Asset icon</label>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <AssetIcon name={value} className="h-3.5 w-3.5" />
          {value}
        </span>
      </div>
      <div className="grid grid-cols-8 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-2 max-h-48 overflow-y-auto dark:border-slate-700 dark:bg-slate-800/50">
        {ASSET_ICONS.map((iconName) => {
          const isSelected = value === iconName;
          return (
            <button
              key={iconName}
              type="button"
              title={iconName}
              onClick={() => onChange(iconName)}
              className={[
                "flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition-colors",
                isSelected
                  ? "bg-brand-600 text-white ring-2 ring-brand-600 ring-offset-1"
                  : "text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200",
              ].join(" ")}
            >
              <AssetIcon name={iconName} className="h-4 w-4 flex-shrink-0" />
              <span className="text-[9px] leading-tight truncate w-full text-center">
                {iconName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AssetModal
// ---------------------------------------------------------------------------
interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  editing: Asset | null;
  departments: Department[];
  strategies: AssetStrategy[];
  complexities: AssetComplexity[];
  domains: Domain[];
  tiers: Tier[];
  vendors: Vendor[];
  users: User[];
  sectors: IndustrySector[];
  capabilities: BusinessCapability[];
  diagrams?: Diagram[];
  onSave: (form: AssetFormState) => Promise<void>;
}

export default function AssetModal({
  isOpen, onClose, editing, departments, strategies, complexities, domains, tiers, vendors, users, sectors, capabilities, diagrams = [], onSave,
}: AssetModalProps) {
  const [form, setForm] = useState<AssetFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<{ name?: string; departmentIds?: string; general?: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(editing ? assetToForm(editing) : EMPTY_FORM);
      setErrors({});
    }
  }, [isOpen, editing]);

  function set(key: keyof AssetFormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = "Asset name is required.";
    if (form.departmentIds.length === 0) errs.departmentIds = "Select at least one department.";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setIsSaving(true);
    setErrors({});
    try {
      await onSave(form);
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : "An error occurred." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit — ${editing.name}` : "Register New Asset"}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} noValidate>
        {errors.general && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
            {errors.general}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-4">

          {/* ── Basic Info ─────────────────────────────────────────────── */}
          <SectionHeading>Basic Information</SectionHeading>

          <div className="col-span-2 sm:col-span-1">
            <Input
              label="Asset name"
              type="text"
              placeholder="e.g. Salesforce CRM"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              error={errors.name}
              autoFocus
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <Input
              label="Short code / acronym"
              type="text"
              placeholder="e.g. SFCRM"
              value={form.shortCode}
              onChange={(e) => set("shortCode", e.target.value)}
              hint="Optional identifier used in diagrams"
            />
          </div>

          <TextAreaField
            label="Description"
            value={form.description}
            onChange={(v) => set("description", v)}
            placeholder="Brief description of what this asset does..."
            rows={2}
          />

          <SelectField label="Hosting type" value={form.type} onChange={(v) => set("type", v as AssetType)} required>
            {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </SelectField>

          <SelectField label="Asset category" value={form.category} onChange={(v) => set("category", v as AssetCategory)} required>
            {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </SelectField>

          <SelectField label="Lifecycle status" value={form.lifecycleStatus} onChange={(v) => set("lifecycleStatus", v as LifecycleStatus)} required>
            {LIFECYCLE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </SelectField>

          {/* ── Ownership ─────────────────────────────────────────────── */}
          <SectionHeading>Ownership</SectionHeading>

          <div className="col-span-2">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Departments<span className="ml-0.5 text-red-500">*</span>
                </label>
                {form.departmentIds.length > 0 && (
                  <span className="text-xs text-slate-400">
                    {form.departmentIds.length} selected
                  </span>
                )}
              </div>
              <div className={[
                "max-h-40 overflow-y-auto rounded-lg border bg-white p-2 dark:bg-slate-800",
                errors.departmentIds ? "border-red-400 dark:border-red-500" : "border-slate-300 dark:border-slate-600",
              ].join(" ")}>
                {departments.length === 0 ? (
                  <p className="px-2 py-1 text-sm italic text-slate-400">No departments available</p>
                ) : (
                  departments.map((d) => {
                    const checked = form.departmentIds.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setForm((f) => ({
                              ...f,
                              departmentIds: checked
                                ? f.departmentIds.filter((id) => id !== d.id)
                                : [...f.departmentIds, d.id],
                            }));
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600 dark:border-slate-500"
                        />
                        <span className="text-sm text-slate-800 dark:text-slate-200">{d.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
              {errors.departmentIds && (
                <p className="text-xs text-red-500">{errors.departmentIds}</p>
              )}
            </div>
          </div>

          <div className="col-span-2">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Architect Responsible</label>
                {form.architectIds.length > 0 && (
                  <span className="text-xs text-slate-400">{form.architectIds.length} selected</span>
                )}
              </div>
              <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-800">
                {users.length === 0 ? (
                  <p className="px-2 py-1 text-sm italic text-slate-400">No users available</p>
                ) : (
                  users.map((u) => {
                    const checked = form.architectIds.includes(u.id);
                    return (
                      <label key={u.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setForm((f) => ({
                              ...f,
                              architectIds: checked
                                ? f.architectIds.filter((id) => id !== u.id)
                                : [...f.architectIds, u.id],
                            }));
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600 dark:border-slate-500"
                        />
                        <span className="text-sm text-slate-800 dark:text-slate-200">{u.name}</span>
                        <span className="ml-auto text-xs text-slate-400">{u.role}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="col-span-2">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Business Capabilities</label>
                {form.capabilityIds.length > 0 && (
                  <span className="text-xs text-slate-400">{form.capabilityIds.length} selected</span>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-800">
                {capabilities.length === 0 ? (
                  <p className="px-2 py-1 text-sm italic text-slate-400">No capabilities available</p>
                ) : (
                  sectors.map((sector) => {
                    const sectorCaps = capabilities.filter((c) => c.industrySectorId === sector.id);
                    if (sectorCaps.length === 0) return null;
                    return (
                      <div key={sector.id} className="mb-2 last:mb-0">
                        <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{sector.name}</p>
                        {sectorCaps.map((cap) => {
                          const checked = form.capabilityIds.includes(cap.id);
                          return (
                            <label key={cap.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setForm((f) => ({
                                    ...f,
                                    capabilityIds: checked
                                      ? f.capabilityIds.filter((id) => id !== cap.id)
                                      : [...f.capabilityIds, cap.id],
                                  }));
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600 dark:border-slate-500"
                              />
                              <span className="text-sm text-slate-800 dark:text-slate-200">{cap.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <SelectField label="Business owner" value={form.businessOwner} onChange={(v) => set("businessOwner", v)}>
            <option value="">— Unassigned —</option>
            {users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
          </SelectField>

          <SelectField label="Technical owner" value={form.technicalOwner} onChange={(v) => set("technicalOwner", v)}>
            <option value="">— Unassigned —</option>
            {users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
          </SelectField>

          <SelectField label="Strategy" value={form.strategyId} onChange={(v) => set("strategyId", v)}>
            <option value="">— Unassigned —</option>
            {strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectField>

          <SelectField label="Complexity" value={form.complexityId} onChange={(v) => set("complexityId", v)}>
            <option value="">— Unassigned —</option>
            {complexities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>

          <SelectField label="Domain" value={form.domainId} onChange={(v) => set("domainId", v)}>
            <option value="">— Unassigned —</option>
            {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectField>

          <SelectField label="Tier" value={form.tierId} onChange={(v) => set("tierId", v)}>
            <option value="">— Unassigned —</option>
            {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </SelectField>

          <SelectField label="Vendor / Supplier" value={form.vendorId} onChange={(v) => set("vendorId", v)}>
            <option value="">— Unassigned —</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </SelectField>

          {/* ── SLA & Dates ───────────────────────────────────────────── */}
          <SectionHeading>SLA &amp; Dates</SectionHeading>

          <Input
            label="Availability SLA"
            type="text"
            placeholder="e.g. 99.9%"
            value={form.slaAvailability}
            onChange={(e) => set("slaAvailability", e.target.value)}
          />

          <Input
            label="RTO (Recovery Time Objective)"
            type="text"
            placeholder="e.g. 4 hours"
            value={form.slaRto}
            onChange={(e) => set("slaRto", e.target.value)}
          />

          <Input
            label="RPO (Recovery Point Objective)"
            type="text"
            placeholder="e.g. 1 hour"
            value={form.slaRpo}
            onChange={(e) => set("slaRpo", e.target.value)}
          />

          <Input
            label="Go live / purchase date"
            type="date"
            value={form.goLiveDate}
            onChange={(e) => set("goLiveDate", e.target.value)}
          />

          <div className="col-span-2 sm:col-span-1">
            <Input
              label="Planned retirement date"
              type="date"
              value={form.retirementDate}
              onChange={(e) => set("retirementDate", e.target.value)}
            />
          </div>

          <Input
            label="Contract end date"
            type="date"
            value={form.contractEndDate}
            onChange={(e) => set("contractEndDate", e.target.value)}
          />

          <Input
            label="Contract amount"
            type="number"
            placeholder="e.g. 50000"
            value={form.contractAmount}
            onChange={(e) => set("contractAmount", e.target.value)}
            hint="Annual contract value"
          />

          {/* ── Links & Notes ─────────────────────────────────────────── */}
          <SectionHeading>Links &amp; Notes</SectionHeading>

          <div className="col-span-2 sm:col-span-1">
            <Input
              label="Application URL"
              type="url"
              placeholder="https://app.example.com"
              value={form.appUrl}
              onChange={(e) => set("appUrl", e.target.value)}
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <Input
              label="Documentation URL"
              type="url"
              placeholder="https://docs.example.com"
              value={form.docUrl}
              onChange={(e) => set("docUrl", e.target.value)}
            />
          </div>

          <TextAreaField
            label="Notes"
            value={form.notes}
            onChange={(v) => set("notes", v)}
            placeholder="Any additional context, known issues, or important notes..."
            rows={3}
          />

          {diagrams.length > 0 && (
            <div className="col-span-2 sm:col-span-1">
              <SelectField label="Main diagram" value={form.heroDiagramId} onChange={(v) => set("heroDiagramId", v)}>
                <option value="">— None —</option>
                {diagrams.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </SelectField>
              <p className="mt-1 text-xs text-slate-400">Featured architecture diagram shown at the top of the asset detail page.</p>
            </div>
          )}

          {/* ── Appearance ────────────────────────────────────────────── */}
          <SectionHeading>Appearance</SectionHeading>
          <IconPicker value={form.icon} onChange={(v) => set("icon", v)} />

        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSaving}>
            {editing ? "Save changes" : "Register Asset"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
