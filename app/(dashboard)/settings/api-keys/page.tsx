"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, AlertTriangle, KeyRound, Copy, Check, Download,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ApiKey } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
interface CreateForm {
  name: string;
  contact: string;
  expiryPreset: "30" | "90" | "365" | "never";
}

const EMPTY_FORM: CreateForm = { name: "", contact: "", expiryPreset: "90" };

function expiryPresetToDays(preset: CreateForm["expiryPreset"]): number | null {
  return preset === "never" ? null : Number(preset);
}

function keyStatus(key: ApiKey): { label: string; className: string } {
  if (key.revokedAt) return { label: "Revoked", className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" };
  if (key.expiresAt && new Date(key.expiresAt).getTime() < Date.now()) {
    return { label: "Expired", className: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  }
  return { label: "Active", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Create-key modal (includes the one-time reveal step)
// ---------------------------------------------------------------------------
function CreateApiKeyModal({
  isOpen, onClose, onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [nameError, setNameError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [revealKey, setRevealKey] = useState<{ rawKey: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_FORM);
      setNameError(""); setGeneralError(""); setRevealKey(null); setCopied(false);
    }
  }, [isOpen]);

  function set<K extends keyof CreateForm>(key: K, value: CreateForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setNameError("Name is required."); return; }
    setNameError(""); setGeneralError("");
    setIsSaving(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          contact: form.contact || undefined,
          expiresInDays: expiryPresetToDays(form.expiryPreset),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create API key.");
      setRevealKey({ rawKey: data.rawKey, name: data.name });
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCopy() {
    if (!revealKey) return;
    navigator.clipboard.writeText(revealKey.rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!revealKey) return;
    const blob = new Blob([revealKey.rawKey + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pixxel-api-key-${revealKey.name.toLowerCase().replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDone() {
    setRevealKey(null);
    onCreated();
    onClose();
  }

  if (revealKey) {
    return (
      <Modal isOpen={isOpen} onClose={handleDone} title="Save your API key" maxWidth="max-w-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">This key won&apos;t be shown again</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Copy it now and store it somewhere safe — you&apos;ll only see the full key this once.
            </p>
          </div>
        </div>

        <div className="mt-4 break-all rounded-lg bg-slate-50 p-4 font-mono text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {revealKey.rawKey}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy key"}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4" /> Download .txt
          </Button>
        </div>

        <Button className="mt-6" onClick={handleDone}>
          I&apos;ve saved this key
        </Button>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate API Key" maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} noValidate>
        {generalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
            {generalError}
          </div>
        )}
        <div className="flex flex-col gap-4">
          <Input
            label="Name" type="text" placeholder="e.g. Reporting integration"
            value={form.name} onChange={(e) => set("name", e.target.value)}
            error={nameError} autoFocus required
          />
          <Input
            label="Contact (optional)" type="text" placeholder="e.g. an email or Slack handle"
            value={form.contact} onChange={(e) => set("contact", e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Expires</label>
            <select
              value={form.expiryPreset}
              onChange={(e) => set("expiryPreset", e.target.value as CreateForm["expiryPreset"])}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
            >
              <option value="30">In 30 days</option>
              <option value="90">In 90 days</option>
              <option value="365">In 365 days</option>
              <option value="never">Never</option>
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSaving}>Generate key</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ApiKeysPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const res = await fetch("/api/api-keys");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load API keys.");
      setApiKeys(data.apiKeys);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Oldest-last-used first, so keys most overdue for rotation surface at the top.
  const sorted = [...apiKeys].sort((a, b) => {
    const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
    const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
    return aTime - bTime;
  });

  async function handleRevoke() {
    if (!revokeTarget) return;
    setIsRevoking(true); setRevokeError(null);
    try {
      const res = await fetch(`/api/api-keys/${revokeTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to revoke API key.");
      await fetchData();
      setRevokeTarget(null);
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setIsRevoking(false); }
  }

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">API Keys</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Generate keys for programmatic API access. Each key inherits its creator&apos;s current role.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4" /> Generate key
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
        ) : apiKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400 dark:text-slate-500">
            <KeyRound className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium">No API keys yet</p>
            {isAdmin && (
              <Button size="sm" onClick={() => setCreateModalOpen(true)}>
                <Plus className="h-4 w-4" /> Generate key
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Prefix</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Created by</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Expires</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Last used</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Uses</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {sorted.map((key) => {
                  const status = keyStatus(key);
                  return (
                    <tr key={key.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                            <KeyRound className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                          </div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">{key.name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{key.keyPrefix}&hellip;</td>
                      <td className="hidden px-6 py-4 text-sm text-slate-600 dark:text-slate-400 lg:table-cell">{key.createdByName}</td>
                      <td className="hidden px-6 py-4 text-sm text-slate-600 dark:text-slate-400 lg:table-cell">
                        {key.contact ?? <span className="italic text-slate-300">—</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{formatDate(key.expiresAt)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{formatDate(key.lastUsedAt)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{key.useCount}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {isAdmin && !key.revokedAt && (
                            <button
                              onClick={() => { setRevokeTarget(key); setRevokeError(null); }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
                              aria-label={`Revoke ${key.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
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

      {!isLoading && !fetchError && apiKeys.length > 0 && (
        <p className="text-xs text-slate-400">
          {apiKeys.length} key{apiKeys.length !== 1 ? "s" : ""}
        </p>
      )}

      <CreateApiKeyModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={fetchData}
      />

      <Modal isOpen={!!revokeTarget} onClose={() => setRevokeTarget(null)} title="Revoke API Key" maxWidth="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-700">
                Are you sure you want to revoke{" "}
                <span className="font-semibold">{revokeTarget?.name}</span>?
                Any requests using this key will start failing immediately.
              </p>
              {revokeError && <p className="mt-2 text-sm text-red-500">{revokeError}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="danger" isLoading={isRevoking} onClick={handleRevoke}>
              <Trash2 className="h-4 w-4" /> Revoke
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
