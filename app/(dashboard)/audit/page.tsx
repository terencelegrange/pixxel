"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardList, AlertTriangle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AuditLog } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const TABLE_LABELS: Record<string, string> = {
  departments:      "Departments",
  domains:          "Domains",
  asset_strategies: "Asset Strategy",
  tiers:            "Tiers",
  assets:           "Assets",
  vendors:          "Vendors",
  users:            "Users",
};

const ACTION_STYLES: Record<AuditLog["action"], string> = {
  CREATE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  UPDATE: "bg-amber-50  text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  DELETE: "bg-red-50    text-red-600 dark:bg-red-950/50 dark:text-red-400",
};

// ---------------------------------------------------------------------------
// Diff helpers
// ---------------------------------------------------------------------------
const FIELD_LABELS: Record<string, string> = {
  name: "Name", shortCode: "Short Code", description: "Description",
  type: "Hosting Type", category: "Asset Category",
  lifecycleStatus: "Lifecycle Status", departmentId: "Department ID",
  businessOwner: "Business Owner", technicalOwner: "Technical Owner",
  vendor: "Vendor", slaAvailability: "Availability SLA",
  slaRto: "RTO", slaRpo: "RPO", goLiveDate: "Go Live Date",
  retirementDate: "Retirement Date", appUrl: "Application URL", notes: "Notes",
  status: "Status",
};

interface FieldDiff { field: string; label: string; from: unknown; to: unknown; }

function getDiff(
  oldValues: Record<string, unknown> | null,
  newValues:  Record<string, unknown> | null,
): FieldDiff[] {
  if (!oldValues || !newValues) return [];
  const seen = new Set<string>();
  const keys = [...Object.keys(oldValues), ...Object.keys(newValues)].filter((k) => {
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return keys
    .filter((k) => JSON.stringify(oldValues[k]) !== JSON.stringify(newValues[k]))
    .map((k) => ({ field: k, label: FIELD_LABELS[k] ?? k, from: oldValues[k], to: newValues[k] }));
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------
function AuditRow({ entry }: { entry: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const diff = getDiff(entry.oldValues, entry.newValues);
  const hasDiff = entry.action === "UPDATE" && diff.length > 0;

  return (
    <>
      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
        <td className="px-4 py-3 whitespace-nowrap">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ACTION_STYLES[entry.action]}`}>
            {entry.action}
          </span>
        </td>
        <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {TABLE_LABELS[entry.tableName] ?? entry.tableName}
        </td>
        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{entry.performedByName}</td>
        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {new Date(entry.performedAt).toLocaleString("en-GB", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </td>
        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
          {entry.action === "CREATE" && "Record created"}
          {entry.action === "DELETE" && "Record deleted"}
          {entry.action === "UPDATE" && (
            hasDiff ? (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline"
              >
                {diff.length} field{diff.length !== 1 ? "s" : ""} changed
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            ) : "No tracked changes"
          )}
        </td>
      </tr>
      {hasDiff && expanded && (
        <tr>
          <td colSpan={5} className="px-4 pb-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 overflow-hidden">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 w-40">Field</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Before</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {diff.map((d) => (
                    <tr key={d.field}>
                      <td className="px-3 py-2 font-medium text-slate-600 dark:text-slate-300">{d.label}</td>
                      <td className="px-3 py-2 text-red-600 dark:text-red-400 line-through break-all">
                        {d.from != null && d.from !== ""
                          ? String(d.from)
                          : <span className="no-underline italic text-slate-400 dark:text-slate-500" style={{ textDecoration: "none" }}>empty</span>}
                      </td>
                      <td className="px-3 py-2 text-emerald-700 dark:text-emerald-400 break-all">
                        {d.to != null && d.to !== ""
                          ? String(d.to)
                          : <span className="italic text-slate-400 dark:text-slate-500">empty</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AuditPage() {
  const [entries, setEntries]       = useState<AuditLog[]>([]);
  const [total, setTotal]           = useState(0);
  const [isLoading, setIsLoading]   = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [filterTable,     setFilterTable]     = useState("");
  const [filterAction,    setFilterAction]    = useState("");
  const [filterPerformer, setFilterPerformer] = useState("");
  const [draftPerformer,  setDraftPerformer]  = useState(""); // debounced

  // Pagination
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const qs = new URLSearchParams({
        page:      String(page),
        pageSize:  String(pageSize),
        ...(filterTable     && { table:     filterTable }),
        ...(filterAction    && { action:    filterAction }),
        ...(filterPerformer && { performer: filterPerformer }),
      });
      const res  = await fetch(`/api/audit?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load audit log.");
      setEntries(data.entries);
      setTotal(data.total);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, filterTable, filterAction, filterPerformer]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset to page 1 when filters change
  function applyFilters() {
    setFilterPerformer(draftPerformer);
    setPage(1);
  }

  function handleFilterChange(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Audit Log</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Read-only record of all create, update, and delete operations.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Performer search */}
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Search by user..."
            value={draftPerformer}
            onChange={(e) => setDraftPerformer(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
            className="h-9 w-48 rounded-lg border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <Button size="sm" variant="secondary" onClick={applyFilters}>Search</Button>
        </div>

        {/* Table filter */}
        <select
          value={filterTable}
          onChange={(e) => handleFilterChange(setFilterTable, e.target.value)}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
        >
          <option value="">All tables</option>
          <option value="departments">Departments</option>
          <option value="domains">Domains</option>
          <option value="asset_strategies">Asset Strategy</option>
          <option value="tiers">Tiers</option>
          <option value="assets">Assets</option>
          <option value="vendors">Vendors</option>
          <option value="users">Users</option>
        </select>

        {/* Action filter */}
        <select
          value={filterAction}
          onChange={(e) => handleFilterChange(setFilterAction, e.target.value)}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
        >
          <option value="">All actions</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>

        {/* Page size */}
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n} per page</option>
          ))}
        </select>

        {/* Clear filters */}
        {(filterTable || filterAction || filterPerformer || draftPerformer) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFilterTable(""); setFilterAction("");
              setFilterPerformer(""); setDraftPerformer("");
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-700">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-red-500 dark:text-red-400">
            <AlertTriangle className="h-6 w-6" />
            <p className="text-sm">{fetchError}</p>
            <Button variant="secondary" size="sm" onClick={fetchData}>Retry</Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400 dark:text-slate-500">
            <ClipboardList className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium">No audit events found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800/50 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-24">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-32">Table</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Performed by</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Date &amp; Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 dark:bg-slate-900">
                {entries.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination footer */}
      {!isLoading && !fetchError && total > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <p>
            Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total} event{total !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors dark:hover:bg-slate-800"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {/* Page number buttons — show at most 5 */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
              .reduce<(number | "…")[]>((acc, n, idx, arr) => {
                if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("…");
                acc.push(n);
                return acc;
              }, [])
              .map((n, idx) =>
                n === "…" ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 dark:text-slate-500">…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n as number)}
                    className={[
                      "min-w-[2rem] rounded-lg px-2 py-1 text-sm font-medium transition-colors",
                      n === page
                        ? "bg-brand-600 text-white"
                        : "hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-800 dark:text-slate-300",
                    ].join(" ")}
                  >
                    {n}
                  </button>
                )
              )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors dark:hover:bg-slate-800"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
