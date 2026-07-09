"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft, Layers, Plus, Trash2, AlertTriangle,
  Pencil, List, GitFork,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AssetIcon } from "@/components/assets/AssetModal";
import { Service, ServiceAsset, ServiceStatus, ServiceRole } from "@/types";

const ServiceFlow = dynamic(() => import("@/components/services/ServiceFlow"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STATUS_STYLES: Record<ServiceStatus, string> = {
  "Planned":  "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Active":   "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Degraded": "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Retired":  "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const LIFECYCLE_STYLES: Record<string, string> = {
  Proposed:         "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  Approved:         "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "In Development": "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Production:       "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Sunset:           "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Retired:          "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const ROLES: ServiceRole[] = ["Core", "Supporting", "Dependency"];

const ROLE_STYLES: Record<ServiceRole, string> = {
  Core:       "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  Supporting: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  Dependency: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const ROLE_SECTION_STYLES: Record<ServiceRole, string> = {
  Core:       "bg-violet-50/60",
  Supporting: "bg-sky-50/60",
  Dependency: "bg-slate-50",
};

const ROLE_TEXT_STYLES: Record<ServiceRole, string> = {
  Core:       "text-violet-600",
  Supporting: "text-sky-600",
  Dependency: "text-slate-500",
};

// ---------------------------------------------------------------------------
// Link Asset Modal
// ---------------------------------------------------------------------------
interface AvailableAsset { id: string; name: string; type: string; icon: string | null; lifecycleStatus: string; }

function LinkAssetModal({
  isOpen, onClose, serviceId, linkedAssetIds, onLinked,
}: {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string;
  linkedAssetIds: Set<string>;
  onLinked: () => void;
}) {
  const [assets, setAssets] = useState<AvailableAsset[]>([]);
  const [selected, setSelected] = useState("");
  const [role, setRole] = useState<ServiceRole>("Supporting");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setSelected(""); setRole("Supporting"); setNotes(""); setError("");
    fetch("/api/assets")
      .then((r) => r.json())
      .then((d) => setAssets((d.assets ?? []).filter((a: AvailableAsset) => !linkedAssetIds.has(a.id))))
      .catch(() => {});
  }, [isOpen, linkedAssetIds]);

  async function handleSubmit() {
    if (!selected) { setError("Please select an asset."); return; }
    setError(""); setIsSaving(true);
    try {
      const res = await fetch(`/api/services/${serviceId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: selected, role, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to link asset.");
      onLinked();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setIsSaving(false); }
  }

  const fieldCls = "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Link Asset" maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">{error}</div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Asset</label>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className={fieldCls}>
            <option value="">— Select an asset —</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={[
                  "rounded-lg border-2 px-2 py-2.5 text-sm font-medium transition-colors text-center",
                  role === r
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
                ].join(" ")}
              >
                {r}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {role === "Core"
              ? "A primary, load-bearing component of this service."
              : role === "Supporting"
              ? "Helps deliver the service but isn't the core function."
              : "Something this service depends on to operate."}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span></label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
            placeholder="Describe the relationship…"
          />
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button isLoading={isSaving} onClick={handleSubmit}>Link asset</Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Edit member modal
// ---------------------------------------------------------------------------
function EditMemberModal({
  isOpen, onClose, serviceId, member, onUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string;
  member: ServiceAsset | null;
  onUpdated: () => void;
}) {
  const [role, setRole] = useState<ServiceRole>("Supporting");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && member) {
      setRole(member.role);
      setNotes(member.notes ?? "");
      setError("");
    }
  }, [isOpen, member]);

  async function handleSubmit() {
    setError(""); setIsSaving(true);
    try {
      const res = await fetch(`/api/services/${serviceId}/assets/${member!.assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update.");
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setIsSaving(false); }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit — ${member?.assetName ?? ""}`} maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">{error}</div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={[
                  "rounded-lg border-2 px-2 py-2.5 text-sm font-medium transition-colors text-center",
                  role === r
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
                ].join(" ")}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span></label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button isLoading={isSaving} onClick={handleSubmit}>Save changes</Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Member row
// ---------------------------------------------------------------------------
function MemberRow({
  member, serviceId, canWrite, onRemove, onEdit,
}: {
  member: ServiceAsset;
  serviceId: string;
  canWrite: boolean;
  onRemove: (assetId: string) => void;
  onEdit: (member: ServiceAsset) => void;
}) {
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    try {
      await fetch(`/api/services/${serviceId}/assets/${member.assetId}`, { method: "DELETE" });
      onRemove(member.assetId);
    } finally { setRemoving(false); }
  }

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <AssetIcon name={member.assetIcon ?? "Server"} className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/assets/${member.assetId}`} className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-brand-600 transition-colors">
            {member.assetName}
          </Link>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${LIFECYCLE_STYLES[member.lifecycleStatus] ?? "bg-slate-100 text-slate-500"}`}>
            {member.lifecycleStatus}
          </span>
          {member.tierName && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {member.tierName}
            </span>
          )}
        </div>
        {member.notes && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 truncate">{member.notes}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_STYLES[member.role]}`}>
          {member.role}
        </span>
        {canWrite && (
          <>
            <button
              onClick={() => onEdit(member)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              aria-label="Edit member"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleRemove}
              disabled={removing}
              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
              aria-label={`Remove ${member.assetName}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { canWrite } = useAuth();

  const [service, setService] = useState<Service | null>(null);
  const [members, setMembers] = useState<ServiceAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [view, setView] = useState<"list" | "flow">("list");
  const [linkOpen, setLinkOpen] = useState(false);
  const [editMember, setEditMember] = useState<ServiceAsset | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const res = await fetch(`/api/services/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load service.");
      setService(data);
      setMembers(data.members ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function handleRemove(assetId: string) {
    setMembers((prev) => prev.filter((m) => m.assetId !== assetId));
  }

  const linkedIds = new Set(members.map((m) => m.assetId));
  const membersByRole = (role: ServiceRole) => members.filter((m) => m.role === role);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (fetchError || !service) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-red-500">
        <AlertTriangle className="h-6 w-6" />
        <p className="text-sm">{fetchError ?? "Service not found."}</p>
        <Button variant="secondary" size="sm" onClick={fetchAll}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/services" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Business Services
      </Link>

      {/* Hero */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-start gap-5 p-6">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50">
            <Layers className="h-7 w-7 text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">{service.name}</h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[service.status]}`}>
                {service.status}
              </span>
              <span className="font-mono text-xs text-slate-400">{service.slug}</span>
            </div>
            {service.description && (
              <p className="mt-1 text-sm text-slate-500">{service.description}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
              <span>Tier: <span className="text-slate-600 font-medium">{service.tierName ?? "—"}</span></span>
              <span>Domain: <span className="text-slate-600 font-medium">{service.domainName ?? "—"}</span></span>
              <span>Business owner: <span className="text-slate-600 font-medium">{service.businessOwner ?? "—"}</span></span>
              <span>Technical owner: <span className="text-slate-600 font-medium">{service.technicalOwner ?? "—"}</span></span>
              <span><span className="text-slate-600 font-medium">{members.length}</span> linked asset{members.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Service Composition */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Service Composition</h2>
            <p className="text-xs text-slate-400 mt-0.5">Assets that make up this service, grouped by their role.</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
              <button
                onClick={() => setView("list")}
                className={[
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  view === "list"
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                <List className="h-3.5 w-3.5" /> List
              </button>
              <button
                onClick={() => setView("flow")}
                className={[
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  view === "flow"
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                <GitFork className="h-3.5 w-3.5" /> Flow
              </button>
            </div>
            {canWrite && (
              <Button size="sm" onClick={() => setLinkOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Link asset
              </Button>
            )}
          </div>
        </div>

        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
            <Layers className="h-8 w-8 text-slate-200" />
            <p className="text-sm">No assets linked yet.</p>
            {canWrite && (
              <Button size="sm" variant="secondary" onClick={() => setLinkOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Link first asset
              </Button>
            )}
          </div>
        ) : view === "flow" ? (
          <ServiceFlow service={service} members={members} />
        ) : (
          <div className="divide-y divide-slate-100">
            {ROLES.map((role) => {
              const roleMembers = membersByRole(role);
              if (roleMembers.length === 0) return null;
              return (
                <div key={role}>
                  <div className={`flex items-center gap-2 px-5 py-2 ${ROLE_SECTION_STYLES[role]}`}>
                    <span className={`text-xs font-semibold uppercase tracking-wider ${ROLE_TEXT_STYLES[role]}`}>
                      {role} — {roleMembers.length} asset{roleMembers.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {roleMembers.map((m) => (
                    <MemberRow
                      key={m.assetId}
                      member={m}
                      serviceId={service.id}
                      canWrite={canWrite}
                      onRemove={handleRemove}
                      onEdit={setEditMember}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Link modal */}
      <LinkAssetModal
        isOpen={linkOpen}
        onClose={() => setLinkOpen(false)}
        serviceId={service.id}
        linkedAssetIds={linkedIds}
        onLinked={fetchAll}
      />

      {/* Edit member modal */}
      <EditMemberModal
        isOpen={!!editMember}
        onClose={() => setEditMember(null)}
        serviceId={service.id}
        member={editMember}
        onUpdated={fetchAll}
      />
    </div>
  );
}
