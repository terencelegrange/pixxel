"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Asset, RiskFactor, RiskLevel } from "@/types";
import { AssetRiskSummary, summarizeAssetRisk } from "@/lib/riskAssessment";

interface RawAssessment { assetId: string; riskFactorId: string; status: "Met" | "Not Met" | "Partial"; }

const LEVEL_BADGE: Record<RiskLevel, string> = {
  Low:      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  Medium:   "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  High:     "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Critical: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function StatusCell({ summary }: { summary: AssetRiskSummary | null }) {
  if (!summary) {
    return <span className="text-xs italic text-slate-300 dark:text-slate-600">Not configured</span>;
  }
  if (summary.openCount === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <ShieldCheck className="h-3.5 w-3.5" /> Well managed
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_BADGE[summary.worstSeverity!]}`}>
      {summary.openCount} open · {summary.worstSeverity}
      {summary.isWellManaged && " (no critical gaps)"}
    </span>
  );
}

export default function AssetSecurityListPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [riskFactors, setRiskFactors] = useState<RiskFactor[]>([]);
  const [assessments, setAssessments] = useState<RawAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const [assetsRes, factorsRes, assessmentsRes] = await Promise.all([
        fetch("/api/assets"),
        fetch("/api/risk-factors"),
        fetch("/api/risk-assessments"),
      ]);
      const [assetsData, factorsData, assessmentsData] = await Promise.all([
        assetsRes.json(), factorsRes.json(), assessmentsRes.json(),
      ]);
      if (!assetsRes.ok) throw new Error(assetsData.error ?? "Failed to load assets.");
      setAssets(assetsData.assets);
      setRiskFactors(factorsData.riskFactors ?? []);
      setAssessments(assessmentsData.assessments ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = assets.filter((a) => {
    if (!search.trim()) return true;
    return a.name.toLowerCase().includes(search.toLowerCase());
  });

  const rows = filtered
    .map((asset) => ({
      asset,
      attributes: summarizeAssetRisk(asset, riskFactors, assessments, "Attribute"),
      characteristics: summarizeAssetRisk(asset, riskFactors, assessments, "Characteristic"),
    }))
    .sort((a, b) => {
      const score = (s: typeof a.attributes) => s ? s.openCount : -1;
      return (score(b.attributes) + score(b.characteristics)) - (score(a.attributes) + score(a.characteristics));
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Asset Security</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Assess each asset against the attributes and characteristics mapped to its category.
        </p>
      </div>

      <input
        type="search"
        placeholder="Search assets…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
      />

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
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400 dark:text-slate-500">
            <ShieldAlert className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium">No assets match your search</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Asset</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Category</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Domain</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Open Attributes</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Open Characteristics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {rows.map(({ asset, attributes, characteristics }) => (
                  <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/assets/security/${asset.id}`} className="font-medium text-slate-900 hover:text-brand-600 dark:text-slate-100 dark:hover:text-brand-400">
                        {asset.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{asset.category}</td>
                    <td className="hidden px-6 py-4 text-sm text-slate-600 dark:text-slate-400 sm:table-cell">
                      {asset.domainName ?? <span className="italic text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <StatusCell summary={attributes} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusCell summary={characteristics} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
