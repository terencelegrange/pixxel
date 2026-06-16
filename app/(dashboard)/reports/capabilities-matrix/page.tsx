"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AssetIcon } from "@/components/assets/AssetModal";
import { LifecycleStatus } from "@/types";

// ---------------------------------------------------------------------------
// Types (mirrors the API response shape)
// ---------------------------------------------------------------------------
interface MatrixAsset { id: string; name: string; type: string; icon: string | null; }
interface MatrixCapability {
  id: string; name: string; sortOrder: number | null; total: number;
  byStatus: Record<LifecycleStatus, MatrixAsset[]>;
}
interface MatrixSector { id: string; name: string; capabilities: MatrixCapability[]; }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STATUSES: LifecycleStatus[] = [
  "Proposed", "Approved", "In Development", "Production", "Sunset", "Retired",
];

const STATUS_HEADER_STYLES: Record<LifecycleStatus, string> = {
  Proposed:         "text-slate-500",
  Approved:         "text-blue-600",
  "In Development": "text-amber-600",
  Production:       "text-emerald-600",
  Sunset:           "text-orange-500",
  Retired:          "text-red-500",
};

// Cell colour by count
function cellStyle(count: number): string {
  if (count === 0) return "";
  if (count <= 2) return "bg-blue-50 text-blue-700 font-semibold";
  if (count <= 5) return "bg-indigo-50 text-indigo-700 font-semibold";
  return "bg-emerald-50 text-emerald-700 font-semibold";
}

// ---------------------------------------------------------------------------
// Drill-down modal
// ---------------------------------------------------------------------------
function DrillDown({
  capability, status, assets, onClose,
}: {
  capability: string;
  status: LifecycleStatus;
  assets: MatrixAsset[];
  onClose: () => void;
}) {
  const STATUS_BADGE: Record<LifecycleStatus, string> = {
    Proposed:         "bg-slate-100 text-slate-600",
    Approved:         "bg-blue-50 text-blue-700",
    "In Development": "bg-amber-50 text-amber-700",
    Production:       "bg-emerald-50 text-emerald-700",
    Sunset:           "bg-orange-50 text-orange-700",
    Retired:          "bg-red-50 text-red-600",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{capability}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}>
                {status}
              </span>
              <span className="text-sm text-slate-500">{assets.length} asset{assets.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {assets.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <AssetIcon name={a.icon || "Server"} className="h-3.5 w-3.5 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{a.name}</p>
                <p className="text-xs text-slate-400">{a.type}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CapabilitiesMatrixPage() {
  const [matrix, setMatrix] = useState<MatrixSector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string>("all");

  // Drill-down state
  const [drillDown, setDrillDown] = useState<{
    capability: string;
    status: LifecycleStatus;
    assets: MatrixAsset[];
  } | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/reports/capabilities-matrix");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load.");
      setMatrix(data.matrix);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const visibleSectors = selectedSector === "all"
    ? matrix
    : matrix.filter((s) => s.id === selectedSector);

  // Summary counts
  const totalCaps = matrix.reduce((n, s) => n + s.capabilities.length, 0);
  const coveredCaps = matrix.reduce(
    (n, s) => n + s.capabilities.filter((c) => c.total > 0).length, 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Capability Coverage Matrix
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Assets assigned per business capability, grouped by lifecycle status.
          </p>
        </div>

        {/* Sector filter */}
        {matrix.length > 1 && (
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 self-start"
          >
            <option value="all">All sectors</option>
            {matrix.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Summary chips */}
      {!isLoading && !fetchError && matrix.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
            <span className="font-semibold text-slate-800">{totalCaps}</span>
            <span className="ml-1.5 text-slate-400">capabilities</span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
            <span className="font-semibold text-emerald-700">{coveredCaps}</span>
            <span className="ml-1.5 text-slate-400">with assets assigned</span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
            <span className="font-semibold text-slate-400">{totalCaps - coveredCaps}</span>
            <span className="ml-1.5 text-slate-400">gaps (no assets)</span>
          </div>
        </div>
      )}

      {/* Matrix */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-red-500">
          <AlertTriangle className="h-6 w-6" />
          <p className="text-sm">{fetchError}</p>
          <Button variant="secondary" size="sm" onClick={fetchData}>Retry</Button>
        </div>
      ) : matrix.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400 rounded-xl border border-slate-200 bg-white shadow-sm">
          <p className="text-sm font-medium">No capabilities or sectors configured yet</p>
          <p className="text-xs">Add industry sectors and business capabilities in Settings first.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleSectors.map((sector) => (
            <div key={sector.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {/* Sector header */}
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 flex items-center gap-3">
                <h2 className="text-sm font-semibold text-slate-700">{sector.name}</h2>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {sector.capabilities.length} capabilities
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  {sector.capabilities.filter((c) => c.total > 0).length} covered
                </span>
              </div>

              {/* Matrix table */}
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 w-56">
                        Capability
                      </th>
                      {STATUSES.map((s) => (
                        <th
                          key={s}
                          className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider w-28 ${STATUS_HEADER_STYLES[s]}`}
                        >
                          {s}
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400 w-16">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sector.capabilities.map((cap) => (
                      <tr key={cap.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-slate-800">
                          {cap.name}
                        </td>
                        {STATUSES.map((status) => {
                          const assets = cap.byStatus[status] ?? [];
                          const count = assets.length;
                          return (
                            <td key={status} className="px-3 py-3 text-center">
                              {count === 0 ? (
                                <span className="text-slate-200 text-sm select-none">—</span>
                              ) : (
                                <button
                                  onClick={() => setDrillDown({ capability: cap.name, status, assets })}
                                  className={`inline-flex items-center justify-center min-w-[2rem] rounded-full px-2.5 py-0.5 text-xs transition-opacity hover:opacity-80 ${cellStyle(count)}`}
                                  title={`${count} asset${count !== 1 ? "s" : ""} — click to view`}
                                >
                                  {count}
                                </button>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 text-center">
                          {cap.total === 0 ? (
                            <span className="text-xs text-slate-300">0</span>
                          ) : (
                            <span className="text-xs font-semibold text-slate-600">{cap.total}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span className="font-medium text-slate-500">Count scale:</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-6 h-5 rounded-full bg-blue-50 text-blue-700 font-semibold text-xs">1</span>
              1–2
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-6 h-5 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-xs">3</span>
              3–5
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-6 h-5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-xs">6</span>
              6+
            </span>
            <span className="ml-2 text-slate-300">Click any count to see the assets</span>
          </div>
        </div>
      )}

      {/* Drill-down modal */}
      {drillDown && (
        <DrillDown
          capability={drillDown.capability}
          status={drillDown.status}
          assets={drillDown.assets}
          onClose={() => setDrillDown(null)}
        />
      )}
    </div>
  );
}
