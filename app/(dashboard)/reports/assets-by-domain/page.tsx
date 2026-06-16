"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Asset, AssetStrategy, Tier } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ASSET_TYPES = ["SaaS", "On-Premise", "Hybrid", "Cloud", "Open Source", "Other"];
const LIFECYCLE_STATUSES = ["Proposed", "Approved", "In Development", "Production", "Sunset", "Retired"];

// ---------------------------------------------------------------------------
// Data grouping
// ---------------------------------------------------------------------------
interface DomainGroup {
  domainId: string | null;
  domainName: string;
  assets: Asset[];
}

function groupByDomain(assets: Asset[]): DomainGroup[] {
  const map = new Map<string, DomainGroup>();
  for (const asset of assets) {
    const key = asset.domainId ?? "__none__";
    if (!map.has(key)) {
      map.set(key, { domainId: asset.domainId, domainName: asset.domainName ?? "No Domain", assets: [] });
    }
    map.get(key)!.assets.push(asset);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.domainId === null) return 1;
    if (b.domainId === null) return -1;
    return a.domainName.localeCompare(b.domainName);
  });
}

// ---------------------------------------------------------------------------
// Strategy column colours
// ---------------------------------------------------------------------------
const STRATEGY_COLOURS = [
  "bg-violet-100 text-violet-700 ring-violet-200",
  "bg-sky-100 text-sky-700 ring-sky-200",
  "bg-emerald-100 text-emerald-700 ring-emerald-200",
  "bg-amber-100 text-amber-700 ring-amber-200",
  "bg-rose-100 text-rose-700 ring-rose-200",
  "bg-teal-100 text-teal-700 ring-teal-200",
  "bg-indigo-100 text-indigo-700 ring-indigo-200",
  "bg-orange-100 text-orange-700 ring-orange-200",
];
function strategyColour(index: number) {
  return STRATEGY_COLOURS[index % STRATEGY_COLOURS.length];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AssetsByDomainReport() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [strategies, setStrategies] = useState<AssetStrategy[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [filterTier, setFilterTier] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStrategy, setFilterStrategy] = useState("");
  const [filterLifecycle, setFilterLifecycle] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const [assetsRes, strategiesRes, tiersRes] = await Promise.all([
        fetch("/api/assets"),
        fetch("/api/asset-strategy"),
        fetch("/api/tiers"),
      ]);
      const [assetsData, strategiesData, tiersData] = await Promise.all([
        assetsRes.json(), strategiesRes.json(), tiersRes.json(),
      ]);
      if (!assetsRes.ok) throw new Error(assetsData.error ?? "Failed to load assets.");
      setAssets(assetsData.assets);
      setStrategies(strategiesData.strategies ?? []);
      setTiers(tiersData.tiers ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Apply filters
  const filtered = assets.filter((a) => {
    if (filterTier      && a.tierId           !== filterTier)      return false;
    if (filterType      && a.type             !== filterType)      return false;
    if (filterStrategy  && a.strategyId       !== filterStrategy)  return false;
    if (filterLifecycle && a.lifecycleStatus  !== filterLifecycle) return false;
    return true;
  });

  const groups = groupByDomain(filtered);
  const totalFiltered = filtered.length;
  const hasActiveFilter = filterTier || filterType || filterStrategy || filterLifecycle;

  const selectCls = "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Asset Strategy</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            All registered assets grouped by domain, showing strategic position across each column.
          </p>
        </div>
        {!isLoading && !fetchError && assets.length > 0 && (
          <p className="text-xs text-slate-400 sm:text-right">
            {totalFiltered} of {assets.length} asset{assets.length !== 1 ? "s" : ""}
            {hasActiveFilter && " (filtered)"}
          </p>
        )}
      </div>

      {/* Filters */}
      {!isLoading && !fetchError && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Tier */}
          <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className={selectCls}>
            <option value="">All tiers</option>
            {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          {/* Type */}
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={selectCls}>
            <option value="">All types</option>
            {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Strategy */}
          <select value={filterStrategy} onChange={(e) => setFilterStrategy(e.target.value)} className={selectCls}>
            <option value="">All strategies</option>
            {strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          {/* Lifecycle */}
          <select value={filterLifecycle} onChange={(e) => setFilterLifecycle(e.target.value)} className={selectCls}>
            <option value="">All lifecycle statuses</option>
            {LIFECYCLE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {hasActiveFilter && (
            <button
              onClick={() => { setFilterTier(""); setFilterType(""); setFilterStrategy(""); setFilterLifecycle(""); }}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Matrix */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
            <LayoutGrid className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium">No assets registered yet</p>
          </div>
        ) : strategies.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
            <LayoutGrid className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium">No strategies configured</p>
            <p className="text-xs text-slate-400">Add strategies in Asset Strategy to populate columns</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
            <LayoutGrid className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium">No assets match your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="sticky left-0 z-10 bg-slate-50 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 min-w-[220px]">
                    Asset
                  </th>
                  {strategies.map((s, i) => (
                    <th key={s.id} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 min-w-[140px]">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${strategyColour(i)}`}>
                        {s.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <>
                    <tr key={`domain-${group.domainId ?? "none"}`} className="bg-slate-50/70 border-y border-slate-200">
                      <td colSpan={strategies.length + 1} className="sticky left-0 px-6 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            {group.domainName}
                          </span>
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
                            {group.assets.length}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {group.assets
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((asset) => (
                        <tr key={asset.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="sticky left-0 bg-white px-6 py-3 hover:bg-slate-50">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-800">{asset.name}</span>
                              {asset.shortCode && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-400">
                                  {asset.shortCode}
                                </span>
                              )}
                            </div>
                          </td>
                          {strategies.map((s, i) => (
                            <td key={s.id} className="px-4 py-3 text-center">
                              {asset.strategyId === s.id && (
                                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-inset mx-auto ${strategyColour(i)}`}>
                                  <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
                                    <circle cx="6" cy="6" r="4" />
                                  </svg>
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
