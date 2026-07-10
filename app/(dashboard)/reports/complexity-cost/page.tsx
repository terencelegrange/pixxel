"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle, Filter, X, TrendingDown, DollarSign,
  ArrowUpDown, ArrowUp, ArrowDown, Target,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Asset, AssetComplexity, Domain, AssetStrategy, Contract } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function fmt(n: number | null): string {
  return n != null ? USD.format(n) : "—";
}

// Cost data now comes from the Contracts system (contracts.value / contracts.end_date)
// rather than the retired assets.contract_amount / assets.contract_end_date columns.
// An asset may have zero, one, or several linked contracts: total cost sums all linked
// contract values; the displayed end date is the soonest upcoming expiry.
type AssetCost = { amount: number | null; endDate: string | null };

function buildCostMap(contracts: Contract[]): Map<string, AssetCost> {
  const map = new Map<string, AssetCost>();
  for (const c of contracts) {
    if (!c.assetId) continue;
    const existing = map.get(c.assetId) ?? { amount: null, endDate: null };
    if (c.value != null) {
      existing.amount = (existing.amount ?? 0) + c.value;
    }
    if (c.endDate && (!existing.endDate || c.endDate < existing.endDate)) {
      existing.endDate = c.endDate;
    }
    map.set(c.assetId, existing);
  }
  return map;
}

type SortKey = "name" | "complexity" | "cost" | "lifecycle" | "domain" | "strategy";
type SortDir = "asc" | "desc";

const LIFECYCLE_STYLES: Record<string, string> = {
  Proposed:         "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  Approved:         "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "In Development": "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Production:       "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  Sunset:           "bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  Retired:          "bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

function flagCandidates(
  rows: Asset[],
  complexities: AssetComplexity[],
  costThreshold: number,
  complexityIds: string[],
  costMap: Map<string, AssetCost>,
): Set<string> {
  const half = Math.ceil(complexityIds.length / 2);
  const lowComplexityIds = new Set(complexityIds.slice(0, half));
  return new Set(
    rows
      .filter((a) => {
        const amount = costMap.get(a.id)?.amount ?? null;
        return (
          amount != null &&
          amount >= costThreshold &&
          a.complexityId != null &&
          lowComplexityIds.has(a.complexityId)
        );
      })
      .map((a) => a.id),
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SortIcon({ col, active, dir }: { col: string; active: SortKey; dir: SortDir }) {
  if (col !== active) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />;
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
  const [contracts, setContracts] = useState<Contract[]>([]);
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
      const [aRes, cRes, dRes, sRes, ctrRes] = await Promise.all([
        fetch("/api/assets"),
        fetch("/api/asset-complexity"),
        fetch("/api/domains"),
        fetch("/api/asset-strategy"),
        fetch("/api/contracts"),
      ]);
      const [aData, cData, dData, sData, ctrData] = await Promise.all([
        aRes.json(), cRes.json(), dRes.json(), sRes.json(), ctrRes.json(),
      ]);
      if (!aRes.ok) throw new Error(aData.error ?? "Failed to load assets.");
      setAssets(aData.assets ?? []);
      setComplexities(cData.complexities ?? []);
      setDomains(dData.domains ?? []);
      setStrategies(sData.strategies ?? []);
      setContracts(ctrData.contracts ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const orderedComplexityIds = useMemo(
    () => complexities.map((c) => c.id),
    [complexities],
  );

  const costMap = useMemo(() => buildCostMap(contracts), [contracts]);

  const costThreshold = useMemo(() => {
    const costs = assets
      .map((a) => costMap.get(a.id)?.amount ?? null)
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    if (costs.length === 0) return 0;
    const mid = Math.floor(costs.length / 2);
    return costs.length % 2 === 0 ? (costs[mid - 1] + costs[mid]) / 2 : costs[mid];
  }, [assets, costMap]);

  const candidateIds = useMemo(
    () => flagCandidates(assets, complexities, costThreshold, orderedComplexityIds, costMap),
    [assets, complexities, costThreshold, orderedComplexityIds, costMap],
  );

  const rows = useMemo(() => {
    const list = assets.filter((a) => {
      if (filterComplexity && a.complexityId !== filterComplexity) return false;
      if (filterLifecycle && a.lifecycleStatus !== filterLifecycle) return false;
      if (filterDomain && a.domainId !== filterDomain) return false;
      if (filterStrategy && a.strategyId !== filterStrategy) return false;
      if (filterType && a.type !== filterType) return false;
      if (filterCandidatesOnly && !candidateIds.has(a.id)) return false;
      const amount = costMap.get(a.id)?.amount ?? null;
      if (minCost !== "" && (amount == null || amount < Number(minCost))) return false;
      if (maxCost !== "" && (amount == null || amount > Number(maxCost))) return false;
      return true;
    });

    const complexityOrder = Object.fromEntries(
      complexities.map((c, i) => [c.id, i]),
    );

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":       cmp = a.name.localeCompare(b.name); break;
        case "cost":       cmp = (costMap.get(a.id)?.amount ?? -1) - (costMap.get(b.id)?.amount ?? -1); break;
        case "complexity": cmp = (complexityOrder[a.complexityId ?? ""] ?? 999) - (complexityOrder[b.complexityId ?? ""] ?? 999); break;
        case "lifecycle":  cmp = a.lifecycleStatus.localeCompare(b.lifecycleStatus); break;
        case "domain":     cmp = (a.domainName ?? "").localeCompare(b.domainName ?? ""); break;
        case "strategy":   cmp = (a.strategyName ?? "").localeCompare(b.strategyName ?? ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [assets, filterComplexity, filterLifecycle, filterDomain, filterStrategy, filterType,
      filterCandidatesOnly, minCost, maxCost, sortKey, sortDir, complexities, candidateIds, costMap]);

  const totalCost = useMemo(
    () => rows.reduce((s, a) => s + (costMap.get(a.id)?.amount ?? 0), 0),
    [rows, costMap],
  );
  const candidatesInView = useMemo(
    () => rows.filter((a) => candidateIds.has(a.id)),
    [rows, candidateIds],
  );
  const candidateCost = useMemo(
    () => candidatesInView.reduce((s, a) => s + (costMap.get(a.id)?.amount ?? 0), 0),
    [candidatesInView, costMap],
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

  const selectCls = "rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";
  const inputCls  = "w-28 rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-700 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500";

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
              colour="border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <StatCard
              label="Total licence cost"
              value={fmt(totalCost || null)}
              sub={`${rows.filter((a) => costMap.get(a.id)?.amount != null).length} with cost data`}
              colour="border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <StatCard
              label="Replacement targets"
              value={candidatesInView.length}
              sub="Low complexity + high cost"
              colour="border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
            />
            <StatCard
              label="Target cost exposure"
              value={fmt(candidateCost || null)}
              sub="Potential savings if replaced"
              colour="border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
            />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
            <Target className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <span className="font-semibold">Replacement targets</span> are assets with a complexity
              in the lower half of your defined levels <em>and</em> a licensing cost above the median
              ({fmt(costThreshold)}) of assets with cost data.
            </p>
          </div>

          {/* Filters */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </div>
            <div className="flex flex-wrap gap-3">
              <select
                value={filterComplexity}
                onChange={(e) => setFilterComplexity(e.target.value)}
                className={selectCls}
              >
                <option value="">All complexities</option>
                <option value="__none__">No complexity set</option>
                {complexities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={filterLifecycle}
                onChange={(e) => setFilterLifecycle(e.target.value)}
                className={selectCls}
              >
                <option value="">All lifecycles</option>
                {LIFECYCLES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>

              <select
                value={filterDomain}
                onChange={(e) => setFilterDomain(e.target.value)}
                className={selectCls}
              >
                <option value="">All domains</option>
                {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>

              <select
                value={filterStrategy}
                onChange={(e) => setFilterStrategy(e.target.value)}
                className={selectCls}
              >
                <option value="">All strategies</option>
                {strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className={selectCls}
              >
                <option value="">All types</option>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              {/* Cost range */}
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-slate-400 dark:text-slate-500">$</span>
                <input
                  type="number"
                  placeholder="Min cost"
                  value={minCost}
                  onChange={(e) => setMinCost(e.target.value)}
                  className={inputCls}
                />
                <span className="text-sm text-slate-400 dark:text-slate-500">–</span>
                <input
                  type="number"
                  placeholder="Max cost"
                  value={maxCost}
                  onChange={(e) => setMaxCost(e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Candidates only toggle */}
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 py-2 px-3 text-sm transition-colors hover:border-rose-300 hover:bg-rose-50 dark:border-slate-600 dark:hover:border-rose-700 dark:hover:bg-rose-900/20">
                <input
                  type="checkbox"
                  checked={filterCandidatesOnly}
                  onChange={(e) => setFilterCandidatesOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-rose-600"
                />
                <span className="font-medium text-slate-700 dark:text-slate-300">Targets only</span>
              </label>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" /> Clear all
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-800">
            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-20 text-slate-400 dark:text-slate-500">
                <TrendingDown className="h-8 w-8" />
                <p className="text-sm font-medium">No assets match the current filters</p>
                {hasFilters && (
                  <button onClick={clearFilters} className="text-sm text-brand-600 hover:underline dark:text-brand-400">
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-5 py-3 text-left">
                        <button
                          onClick={() => toggleSort("name")}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          Asset <SortIcon col="name" active={sortKey} dir={sortDir} />
                        </button>
                      </th>
                      <th className="px-5 py-3 text-left">
                        <button
                          onClick={() => toggleSort("complexity")}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          Complexity <SortIcon col="complexity" active={sortKey} dir={sortDir} />
                        </button>
                      </th>
                      <th className="px-5 py-3 text-right">
                        <button
                          onClick={() => toggleSort("cost")}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          <SortIcon col="cost" active={sortKey} dir={sortDir} /> Annual Licence Cost
                        </button>
                      </th>
                      <th className="hidden px-5 py-3 text-left lg:table-cell">
                        <button
                          onClick={() => toggleSort("lifecycle")}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          Lifecycle <SortIcon col="lifecycle" active={sortKey} dir={sortDir} />
                        </button>
                      </th>
                      <th className="hidden px-5 py-3 text-left xl:table-cell">
                        <button
                          onClick={() => toggleSort("domain")}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          Domain <SortIcon col="domain" active={sortKey} dir={sortDir} />
                        </button>
                      </th>
                      <th className="hidden px-5 py-3 text-left xl:table-cell">
                        <button
                          onClick={() => toggleSort("strategy")}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          Strategy <SortIcon col="strategy" active={sortKey} dir={sortDir} />
                        </button>
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Target
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-700 dark:bg-slate-800">
                    {rows.map((asset) => {
                      const isTarget = candidateIds.has(asset.id);
                      const assetCost = costMap.get(asset.id)?.amount ?? null;
                      const assetContractEndDate = costMap.get(asset.id)?.endDate ?? null;
                      return (
                        <tr
                          key={asset.id}
                          className={[
                            "transition-colors",
                            isTarget
                              ? "bg-rose-50/60 hover:bg-rose-50 dark:bg-rose-900/20 dark:hover:bg-rose-900/30"
                              : "hover:bg-slate-50 dark:hover:bg-slate-700/50",
                          ].join(" ")}
                        >
                          {/* Name */}
                          <td className="px-5 py-4">
                            <Link
                              href={`/assets/${asset.id}`}
                              className="group flex items-center gap-2"
                            >
                              <span className="text-sm font-medium text-slate-900 group-hover:text-brand-600 transition-colors dark:text-slate-100 dark:group-hover:text-brand-400">
                                {asset.name}
                              </span>
                            </Link>
                            <span className="text-xs text-slate-400 dark:text-slate-500">{asset.type}</span>
                          </td>

                          {/* Complexity */}
                          <td className="px-5 py-4">
                            {asset.complexityName ? (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                {asset.complexityName}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300 italic dark:text-slate-600">Not set</span>
                            )}
                          </td>

                          {/* Cost */}
                          <td className="px-5 py-4 text-right">
                            {assetCost != null ? (
                              <div className="flex flex-col items-end">
                                <span className={[
                                  "text-sm font-semibold tabular-nums",
                                  isTarget
                                    ? "text-rose-700 dark:text-rose-400"
                                    : "text-slate-800 dark:text-slate-200",
                                ].join(" ")}>
                                  {fmt(assetCost)}
                                </span>
                                {assetContractEndDate && (
                                  <span className="text-xs text-slate-400 dark:text-slate-500">
                                    expires {new Date(assetContractEndDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300 italic dark:text-slate-600">No data</span>
                            )}
                          </td>

                          {/* Lifecycle */}
                          <td className="hidden px-5 py-4 lg:table-cell">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LIFECYCLE_STYLES[asset.lifecycleStatus] ?? "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                              {asset.lifecycleStatus}
                            </span>
                          </td>

                          {/* Domain */}
                          <td className="hidden px-5 py-4 xl:table-cell text-sm text-slate-600 dark:text-slate-300">
                            {asset.domainName ?? <span className="italic text-slate-300 dark:text-slate-600">—</span>}
                          </td>

                          {/* Strategy */}
                          <td className="hidden px-5 py-4 xl:table-cell text-sm text-slate-600 dark:text-slate-300">
                            {asset.strategyName ?? <span className="italic text-slate-300 dark:text-slate-600">—</span>}
                          </td>

                          {/* Target flag */}
                          <td className="px-5 py-4 text-center">
                            {isTarget ? (
                              <span title="Replacement candidate" className="inline-flex items-center justify-center">
                                <Target className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                              </span>
                            ) : (
                              <span className="text-slate-200 dark:text-slate-700">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Footer totals */}
                  {rows.length > 0 && (
                    <tfoot className="border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                      <tr>
                        <td colSpan={2} className="px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {rows.length} asset{rows.length !== 1 ? "s" : ""}
                          {candidatesInView.length > 0 && (
                            <span className="ml-2 text-rose-600 dark:text-rose-400">
                              · {candidatesInView.length} target{candidatesInView.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-semibold text-slate-700 tabular-nums dark:text-slate-200">
                              {fmt(totalCost || null)}
                            </span>
                            {candidateCost > 0 && (
                              <span className="text-xs text-rose-600 tabular-nums dark:text-rose-400">
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

          <p className="text-xs text-slate-400 dark:text-slate-500">
            Cost data sourced from linked Contracts (contract value, summed per asset).
            Assets without a linked contract are included in the report but excluded from cost totals.
          </p>
        </>
      )}
    </div>
  );
}
