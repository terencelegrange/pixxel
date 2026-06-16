"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink, UserCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { AssetIcon } from "@/components/assets/AssetModal";
import { Asset, AssetType, LifecycleStatus } from "@/types";

const LIFECYCLE_STYLES: Record<LifecycleStatus, string> = {
  Proposed:         "bg-slate-100 text-slate-600",
  Approved:         "bg-blue-50 text-blue-700",
  "In Development": "bg-amber-50 text-amber-700",
  Production:       "bg-emerald-50 text-emerald-700",
  Sunset:           "bg-orange-50 text-orange-700",
  Retired:          "bg-red-50 text-red-600",
};

const TYPE_STYLES: Record<AssetType, string> = {
  SaaS:           "bg-violet-50 text-violet-700",
  "On-Premise":   "bg-blue-50 text-blue-700",
  Hybrid:         "bg-teal-50 text-teal-700",
  Cloud:          "bg-sky-50 text-sky-700",
  "Open Source":  "bg-emerald-50 text-emerald-700",
  Other:          "bg-slate-100 text-slate-600",
};

function Badge({ label, style }: { label: string; style: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

export default function MyAssetsPage() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/assets/my-assets?userId=${user.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load assets.");
      setAssets(data.assets);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = assets.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      (a.shortCode?.toLowerCase().includes(q) ?? false) ||
      (a.vendorName?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Assets</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Assets where you are listed as an Architect Responsible.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search by name, code, vendor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

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
            <UserCheck className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium">
              {assets.length === 0
                ? "You are not assigned as an architect on any assets yet"
                : "No assets match your search"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Asset</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Type</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Tier</th>
                  <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Strategy</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Lifecycle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filtered.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
                          <AssetIcon name={asset.icon} className="h-4 w-4 text-slate-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/assets/${asset.id}`}
                              className="font-medium text-slate-900 hover:text-brand-600 hover:underline"
                            >
                              {asset.name}
                            </Link>
                            {asset.shortCode && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-500">
                                {asset.shortCode}
                              </span>
                            )}
                            {asset.appUrl && (
                              <a href={asset.appUrl!} target="_blank" rel="noopener noreferrer"
                                className="text-slate-400 hover:text-brand-600"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          {asset.departmentNames.length > 0 && (
                            <p className="text-xs text-slate-400">{asset.departmentNames.join(", ")}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 sm:table-cell">
                      <Badge label={asset.type} style={TYPE_STYLES[asset.type]} />
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-slate-600 md:table-cell">
                      {asset.tierName || <span className="italic text-slate-300">—</span>}
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-slate-600 lg:table-cell">
                      {asset.strategyName || <span className="italic text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <Badge label={asset.lifecycleStatus} style={LIFECYCLE_STYLES[asset.lifecycleStatus]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isLoading && !fetchError && assets.length > 0 && (
        <p className="text-xs text-slate-400">
          {filtered.length} of {assets.length} asset{assets.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
