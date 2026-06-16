"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle, Filter, X, TrendingDown, DollarSign,
  ArrowUpDown, ArrowUp, ArrowDown, Target,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Asset, AssetComplexity, Domain, AssetStrategy } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function fmt(n: number | null): string {
  return n != null ? USD.format(n) : "—";
}

type SortKey = "name" | "complexity" | "cost" | "lifecycle" | "domain" | "strategy";
type SortDir = "asc" | "desc";

const LIFECYCLE_STYLES: Record<string, string> = {
  Proposed:         "bg-slate-100 text-slate-600",
  Approved:         "bg-blue-50 text-blue-700",
  "In Development": "bg-amber-50 text-amber-700",
  Production:       "bg-emerald-50 text-emerald-700",
  Sunset:           "bg-orange-50 text-orange-700",
  Retired:          "bg-red-50 text-red-600",
};

// A row is a "replacement candidate" when it has a complexity AND a cost,
// and its cost is in the upper half of all costs AND its complexity is in the
// lower half of all complexity sort orders (or alphabetically first half).
function flagCandidates(
  rows: Asset[],
  complexities: AssetComplexity[],
  costThreshold: number,
  complexityIds: string[],   // ordered low→high by sortOrder
): Set<string> {
  const half = Math.ceil(complexityIds.length / 2);
  const lowComplexityIds = new Set(complexityIds.slice(0, half));
  return new Set(
    rows
      .filter(
        (a) =>
          a.contractAmount != null &&
          a.contractAmount >= costThreshold &&
          a.complexityId != null &&
          lowComplexityIds.has(a.complexityId),
      )
      .map((a) => a.id),
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SortIcon({ col, active, dir }: { col: string; active: SortKey; dir: SortDir }) {
  if (col !== active) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />;
  return dir === "asc"
    ? <ArrowUp className="h-3.5 w-3.5 text-brand-500" />
    : <ArrowDown className="h-3.5 w-3.5 text-brand-500" />;
}

function StatCard({
  label, value, sub, colour,
}: { label: string; value: string | number; sub?: string; colour: string }) {
  return (
    <div className={`rounded-xl border p-4 ${colour}`}>
      <p className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-xs opacity-60">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ComplexityCostReportPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [complexities, setComplexities] = useState<AssetComplexity[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [strategies, setStrategies] = useState<AssetStrategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [filterComplexity, setFilterComplexity] = useState("");
  const [filterLifecycle, setFilterLifecycle] = useState("");
  const [filterDomain, setFilterDomain] = useState("");
  const [filterStrategy, setFilterStrategy] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterCandidatesOnly, setFilterCandidatesOnly] = useState(false);
  const [minCost, setMinCost] = useState("");
  const [maxCost, setMaxCost] = useState("");

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("cost");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [aRes, cRes, dRes, sRes] = await Promise.all([
        fetch("/api/assets"),
        fetch("/api/asset-complexity"),
        fetch("/api/domains"),
        fetch("/api/asset-strategy"),
      ]);
      const [aData, cData, dData, sData] = await Promise.all([
        aRes.json(), cRes.json(), dRes.json(), sRes.json(),
      ]);
      if (!aRes.ok) throw new Error(aData.error ?? "Failed to load assets.");
      setAssets(aData.assets ?? []);
      setComplexities(cData.complexities ?? []);
      setDomains(dData.domains ?? []);
      setStrategies(sData.strategies ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Complexity IDs ordered low→high (by sort_order then name)
  const orderedComplexityIds = useMemo(
    () => complexities.map((c) => c.id),
    [complexities],
  );

  // Cost threshold = median of all assets that have a cost
  const costThreshold = useMemo(() => {
    const costs = assets
      .map((a) => a.contractAmount)
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    if (costs.length === 0) return 0;
    const mid = Math.floor(costs.length / 2);
    return costs.length % 2 === 0 ? (costs[mid - 1] + costs[mid]) / 2 : costs[mid];
  }, [assets]);

  const candidateIds = useMemo(
    () => flagCandidates(assets, complexities, costThreshold, orderedComplexityIds),
    [assets, complexities, costThreshold, orderedComplexityIds],
  );

  // Filtered + sorted rows
  const rows = useMemo(() => {
    let list = assets.filter((a) => {
      if (filterComplexity && a.complexityId !== filterComplexity) return false;
      if (filterLifecycle && a.lifecycleStatus !== filterLifecycle) return false;
      if (filterDomain && a.domainId !== filterDomain) return false;
      if (filterStrategy && a.strategyId !== filterStrategy) return false;
      if (filterType && a.type !== filterType) return false;
      if (filterCandidatesOnly && !candidateIds.has(a.id)) return false;
      if (minCost !== "" && (a.contractAmount == null || a.contractAmount < Number(minCost))) return false;
      if (maxCost !== "" && (a.contractAmount == null || a.contractAmount > Number(maxCost))) return false;
      return true;
    });

    const complexityOrder = Object.fromEntries(
      complexities.map((c, i) => [c.id, i]),
    );

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":       cmp = a.name.localeCompare(b.name); break;
        case "cost":       cmp = (a.contractAmount ?? -1) - (b.contractAmount ?? -1); break;
        case "complexity": cmp = (complexityOrder[a.complexityId ?? ""] ?? 999) - (complexityOrder[b.complexityId ?? ""] ?? 999); break;
        case "lifecycle":  cmp = a.lifecycleStatus.localeCompare(b.lifecycleStatus); break;
        case "domain":     cmp = (a.domainName ?? "").localeCompare(b.domainName ?? ""); break;
        case "strategy":   cmp = (a.strategyName ?? "").localeCompare(b.strategyName ?? ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [assets, filterComplexity, filterLifecycle, filterDomain, filterStrategy, filterType,
      filterCandidatesOnly, minCost, maxCost, sortKey, sortDir, complexities, candidateIds]);

  // Summary stats (over filtered rows)
  const totalCost = useMemo(
    () => rows.reduce((s, a) => s + (a.contractAmount ?? 0), 0),
    [rows],
  );
  const candidatesInView = useMemo(
    () => rows.filter((a) => candidateIds.has(a.id)),
    [rows, candidateIds],
  );
  const candidateCost = useMemo(
    () => candidatesInView.reduce((s, a) => s + (a.contractAmount ?? 0), 0),
    [candidatesInView],
  );

  const hasFilters = !!(filterComplexity || filterLifecycle || filterDomain ||
    filterStrategy || filterType || filterCandidatesOnly || minCost || maxCost);

  function clearFilters() {
    setFilterComplexity("");
    setFilterLifecycle("");
    setFilterDomain("");
    setFilterStrategy("");
    setFilterType("");
    setFilterCandidatesOnly(false);
    setMinCost("");
    setMaxCost("");
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "cost" ? "desc" : "asc");
    }
  }

  const LIFECYCLES = ["Proposed", "Approved", "In Development", "Production", "Sunset", "Retired"];
  const TYPES = ["SaaS", "On-Premise", "Hybrid", "Cloud", "Open Source", "Other"];

  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Complexity vs Licensing Cost
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Identify assets with low complexity and high licensing cost — prime candidates for replacement or rationalisation.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center gap-3 py-32 text-red-500">
          <AlertTriangle className="h-7 w-7" />
          <p className="text-sm">{fetchError}</p>
          <Button variant="secondary" size="sm" onClick={load}>Retry</Button>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Assets shown"
              value={rows.length}
              sub={`of ${assets.length} total`}
              colour="border-slate-200 bg-white text-slate-800"
            />
            <StatCard
              label="Total licence cost"
              value={fmt(totalCost || null)}
              sub={`${rows.filter((a) => a.contractAmount != null).length} with cost data`}
              colour="border-slate-200 bg-white text-slate-800"
            />
            <StatCard
              label="Replacement targets"
              value={candidatesInView.length}
              sub="Low complexity + high cost"
              colour="border-rose-200 bg-rose-50 text-rose-800"
            />
            <StatCard
              label="Target cost exposure"
              value={fmt(candidateCost || null)}
              sub="Potential savings if replaced"
              colour="border-rose-200 bg-rose-50 text-rose-800"
            />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <Target className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Replacement targets</span> are assets with a complexity
              in the lower half of your defined levels <em>and</em> a licensing cost above the median
              ({fmt(costThreshold)}) of assets with cost data.
            </p>
          </div>

          {/* Filters */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </div>
            <div className="flex flex-wrap gap-3">
              {/* Complexity */}
              <select
                value={filterComplexity}
                onChange={(e) => setFilterComplexity(e.target.value)}
                className="rounded-lg border border-slate-300 py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">All complexities</option>
                <option value="__none__">No complexity set</option>
                {complexities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {/* Lifecycle */}
              <select
                value={filterLifecycle}
                onChange={(e) => setFilterLifecycle(e.target.value)}
                className="rounded-lg border border-slate-300 py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">All lifecycles</option>
                {LIFECYCLES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>

              {/* Domain */}
              <select
                value={filterDomain}
                onChange={(e) => setFilterDomain(e.target.value)}
                className="rounded-lg border border-slate-300 py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">All domains</option>
                {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>

              {/* Strategy */}
              <select
                value={filterStrategy}
                onChange={(e) => setFilterStrategy(e.target.value)}
                className="rounded-lg border border-slate-300 py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">All strategies</option>
                {strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>

              {/* Type */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-lg border border-slate-300 py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">All types</option>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              {/* Cost range */}
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-slate-400">$</span>
                <input
                  type="number"
                  placeholder="Min cost"
                  value={minCost}
                  onChange={(e) => setMinCost(e.target.value)}
                  className="w-28 rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <span className="text-sm text-slate-400">–</span>
                <input
                  type="number"
                  placeholder="Max cost"
                  value={maxCost}
                  onChange={(e) => setMaxCost(e.target.value)}
                  className="w-28 rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Candidates only toggle */}
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 py-2 px-3 text-sm hover:border-rose-300 hover:bg-rose-50 transition-colors">
                <input
                  type="checkbox"
                  checked={filterCandidatesOnly}
                  onChange={(e) => setFilterCandidatesOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-rose-600"
                />
                <span className="font-medium text-slate-700">Targets only</span>
              </label>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" /> Clear all
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-20 text-slate-400">
                <TrendingDown className="h-8 w-8" />
                <p className="text-sm font-medium">No assets match the current filters</p>
                {hasFilters && (
                  <button onClick={clearFilters} className="text-sm text-brand-600 hover:underline">
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-3 text-left">
                        <button
                          onClick={() => toggleSort("name")}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                        >
                          Asset <SortIcon col="name" active={sortKey} dir={sortDir} />
                        </button>
                      </th>
                      <th className="px-5 py-3 text-left">
                        <button
                          onClick={() => toggleSort("complexity")}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                        >
                          Complexity <SortIcon col="complexity" active={sortKey} dir={sortDir} />
                        </button>
                      </th>
                      <th className="px-5 py-3 text-right">
                        <button
                          onClick={() => toggleSort("cost")}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                        >
                          <SortIcon col="cost" active={sortKey} dir={sortDir} /> Annual Licence Cost
                        </button>
                      </th>
                      <th className="hidden px-5 py-3 text-left lg:table-cell">
                        <button
                          onClick={() => toggleSort("lifecycle")}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                        >
                          Lifecycle <SortIcon col="lifecycle" active={sortKey} dir={sortDir} />
                        </button>
                      </th>
                      <th className="hidden px-5 py-3 text-left xl:table-cell">
                        <button
                          onClick={() => toggleSort("domain")}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                        >
                          Domain <SortIcon col="domain" active={sortKey} dir={sortDir} />
                        </button>
                      </th>
                      <th className="hidden px-5 py-3 text-left xl:table-cell">
                        <button
                          onClick={() => toggleSort("strategy")}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                        >
                          Strategy <SortIcon col="strategy" active={sortKey} dir={sortDir} />
                        </button>
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Target
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {rows.map((asset) => {
                      const isTarget = candidateIds.has(asset.id);
                      return (
                        <tr
                          key={asset.id}
                          className={[
                            "transition-colors",
                            isTarget
                              ? "bg-rose-50/60 hover:bg-rose-50"
                              : "hover:bg-slate-50",
                          ].join(" ")}
                        >
                          {/* Name */}
                          <td className="px-5 py-4">
                            <Link
                              href={`/assets/${asset.id}`}
                              className="group flex items-center gap-2"
                            >
                              <span className="text-sm font-medium text-slate-900 group-hover:text-brand-600 transition-colors">
                                {asset.name}
                              </span>
                            </Link>
                            <span className="text-xs text-slate-400">{asset.type}</span>
                          </td>

                          {/* Complexity */}
                          <td className="px-5 py-4">
                            {asset.complexityName ? (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                                {asset.complexityName}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300 italic">Not set</span>
                            )}
                          </td>

                          {/* Cost */}
                          <td className="px-5 py-4 text-right">
                            {asset.contractAmount != null ? (
                              <div className="flex flex-col items-end">
                                <span className={[
                                  "text-sm font-semibold tabular-nums",
                                  isTarget ? "text-rose-700" : "text-slate-800",
                                ].join(" ")}>
                                  {fmt(asset.contractAmount)}
                                </span>
                                {asset.contractEndDate && (
                                  <span className="text-xs text-slate-400">
                                    expires {new Date(asset.contractEndDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300 italic">No data</span>
                            )}
                          </td>

                          {/* Lifecycle */}
                          <td className="hidden px-5 py-4 lg:table-cell">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LIFECYCLE_STYLES[asset.lifecycleStatus] ?? "bg-slate-100 text-slate-600"}`}>
                              {asset.lifecycleStatus}
                            </span>
                          </td>

                          {/* Domain */}
                          <td className="hidden px-5 py-4 xl:table-cell text-sm text-slate-600">
                            {asset.domainName ?? <span className="italic text-slate-300">—</span>}
                          </td>

                          {/* Strategy */}
                          <td className="hidden px-5 py-4 xl:table-cell text-sm text-slate-600">
                            {asset.strategyName ?? <span className="italic text-slate-300">—</span>}
                          </td>

                          {/* Target flag */}
                          <td className="px-5 py-4 text-center">
                            {isTarget ? (
                              <span title="Replacement candidate" className="inline-flex items-center justify-center">
                                <Target className="h-4 w-4 text-rose-500" />
                              </span>
                            ) : (
                              <span className="text-slate-200">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Footer totals */}
                  {rows.length > 0 && (
                    <tfoot className="border-t border-slate-200 bg-slate-50">
                      <tr>
                        <td colSpan={2} className="px-5 py-3 text-xs font-semibold text-slate-500">
                          {rows.length} asset{rows.length !== 1 ? "s" : ""}
                          {candidatesInView.length > 0 && (
                            <span className="ml-2 text-rose-600">
                              · {candidatesInView.length} target{candidatesInView.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-semibold text-slate-700 tabular-nums">
                              {fmt(totalCost || null)}
                            </span>
                            {candidateCost > 0 && (
                              <span className="text-xs text-rose-600 tabular-nums">
                                {fmt(candidateCost)} targets
                              </span>
                            )}
                          </div>
                        </td>
                        <td colSpan={4} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400">
            Cost data sourced from the &ldquo;Contract amount&rdquo; field on each asset.
            Assets without a contract amount are included in the report but excluded from cost totals.
          </p>
        </>
      )}
    </div>
  );
}
