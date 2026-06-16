"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------
interface FeedbackRequest {
  id: string;
  userId: string;
  userName: string;
  type: string;
  subject: string;
  description: string | null;
  status: SupportStatus;
  createdAt: string;
}

type SupportStatus =
  | "New"
  | "Acknowledged"
  | "Under Review"
  | "Will Fix"
  | "Will Not Implement"
  | "Completed";

const STATUSES: SupportStatus[] = [
  "New", "Acknowledged", "Under Review", "Will Fix", "Will Not Implement", "Completed",
];

const STATUS_STYLES: Record<SupportStatus, string> = {
  "New":                  "bg-blue-50 text-blue-700",
  "Acknowledged":         "bg-amber-50 text-amber-700",
  "Under Review":         "bg-violet-50 text-violet-700",
  "Will Fix":             "bg-emerald-50 text-emerald-700",
  "Will Not Implement":   "bg-red-50 text-red-600",
  "Completed":            "bg-slate-100 text-slate-500",
};

const TYPE_STYLES: Record<string, string> = {
  "Feature Request": "bg-violet-50 text-violet-700",
  "Report Request":  "bg-sky-50 text-sky-700",
  "Bug":             "bg-red-50 text-red-600",
  "Other":           "bg-slate-100 text-slate-500",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function FeedbackPage() {
  const [requests, setRequests] = useState<FeedbackRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const res = await fetch("/api/support");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load feedback.");
      setRequests(data.requests);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function updateStatus(id: string, status: SupportStatus) {
    setUpdating(id);
    try {
      const res = await fetch(`/api/support/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    } catch {
      // silently revert — optimistic update wasn't applied
    } finally { setUpdating(null); }
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  const filtered = requests.filter((r) => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterType   && r.type   !== filterType)   return false;
    return true;
  });

  const hasFilter = filterStatus || filterType;

  const selectCls = "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Feedback</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          All feature requests, report requests, and bug reports submitted by users.
        </p>
      </div>

      {/* Filters */}
      {!isLoading && !fetchError && (
        <div className="flex flex-wrap items-center gap-3">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={selectCls}>
            <option value="">All types</option>
            {["Feature Request", "Report Request", "Bug", "Other"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {hasFilter && (
            <button
              onClick={() => { setFilterStatus(""); setFilterType(""); }}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Clear filters
            </button>
          )}
          <span className="ml-auto text-xs text-slate-400">
            {filtered.length} of {requests.length} submission{requests.length !== 1 ? "s" : ""}
            {hasFilter && " (filtered)"}
          </span>
        </div>
      )}

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
            <MessageSquare className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium">
              {requests.length === 0 ? "No feedback submitted yet" : "No items match your filters"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((r) => (
              <div key={r.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left: subject + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_STYLES[r.type] ?? "bg-slate-100 text-slate-500"}`}>
                        {r.type}
                      </span>
                      <p className="text-sm font-medium text-slate-900 truncate">{r.subject}</p>
                    </div>
                    {r.description && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{r.description}</p>
                    )}
                    <p className="mt-1.5 text-xs text-slate-400">
                      {r.userName} &middot; {fmtDate(r.createdAt)}
                    </p>
                  </div>

                  {/* Right: status select */}
                  <div className="flex-shrink-0 sm:ml-6">
                    <select
                      value={r.status}
                      disabled={updating === r.id}
                      onChange={(e) => updateStatus(r.id, e.target.value as SupportStatus)}
                      className={[
                        "h-8 rounded-full px-3 text-xs font-medium border-0 ring-1 ring-inset cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50",
                        r.status === "New"                ? "bg-blue-50 text-blue-700 ring-blue-200"
                        : r.status === "Acknowledged"     ? "bg-amber-50 text-amber-700 ring-amber-200"
                        : r.status === "Under Review"     ? "bg-violet-50 text-violet-700 ring-violet-200"
                        : r.status === "Will Fix"         ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : r.status === "Will Not Implement" ? "bg-red-50 text-red-600 ring-red-200"
                        : "bg-slate-100 text-slate-500 ring-slate-200",
                      ].join(" ")}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
