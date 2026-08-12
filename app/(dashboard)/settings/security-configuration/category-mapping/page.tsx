"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Check, LayoutGrid } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { ASSET_CATEGORIES } from "@/components/assets/AssetModal";
import { RiskFactor, RiskFactorKind } from "@/types";

const KIND_SECTIONS: { kind: RiskFactorKind; label: string; hint: string }[] = [
  { kind: "Attribute", label: "Attributes", hint: "Fixable gaps that apply to this category." },
  { kind: "Characteristic", label: "Characteristics", hint: "Inherent traits that apply to this category." },
];

export default function CategoryMappingPage() {
  const { user } = useAuth();
  const [factors, setFactors] = useState<RiskFactor[]>([]);
  const [category, setCategory] = useState(ASSET_CATEGORIES[0]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMapping, setIsLoadingMapping] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const fetchFactors = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const res = await fetch("/api/risk-factors");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load attributes and characteristics.");
      setFactors(data.riskFactors);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, []);

  const fetchMapping = useCallback(async (cat: string) => {
    setIsLoadingMapping(true); setSaveError(null);
    try {
      const res = await fetch(`/api/risk-factor-mappings?category=${encodeURIComponent(cat)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load mapping.");
      setSelectedIds(new Set<string>(data.riskFactorIds));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoadingMapping(false); }
  }, []);

  useEffect(() => { fetchFactors(); }, [fetchFactors]);
  useEffect(() => { fetchMapping(category); }, [category, fetchMapping]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!user) return;
    setIsSaving(true); setSaveError(null); setSavedAt(null);
    try {
      const res = await fetch("/api/risk-factor-mappings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category, riskFactorIds: Array.from(selectedIds),
          userId: user.id, userName: user.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setSavedAt(Date.now());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "An error occurred.");
    } finally { setIsSaving(false); }
  }

  const selectCls = "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200";

  return (
    <div className="space-y-6">
      <Link href="/settings/security-configuration" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Security Configuration
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Asset Category Mapping</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Choose which attributes and characteristics get assessed for each asset category.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Asset category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value as typeof ASSET_CATEGORIES[number])} className={selectCls}>
          {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {isLoading || fetchError ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-red-500">
              <AlertTriangle className="h-6 w-6" />
              <p className="text-sm">{fetchError}</p>
              <Button variant="secondary" size="sm" onClick={fetchFactors}>Retry</Button>
            </div>
          )}
        </div>
      ) : factors.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-20 text-slate-400 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
          <LayoutGrid className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium">No attributes or characteristics defined yet</p>
          <Link href="/settings/security-configuration/risk-factors" className="text-xs text-brand-600 hover:underline">
            Add some first →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {KIND_SECTIONS.map(({ kind, label, hint }) => {
            const items = factors.filter((f) => f.kind === kind);
            return (
              <div key={kind} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h2 className="font-semibold text-slate-800 dark:text-slate-200">{label}</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
                <div className="mt-3 flex flex-col gap-2">
                  {isLoadingMapping ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-5 w-5 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
                    </div>
                  ) : items.length === 0 ? (
                    <p className="py-4 text-sm italic text-slate-400">None defined.</p>
                  ) : (
                    items.map((f) => (
                      <label key={f.id} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(f.id)}
                          onChange={() => toggle(f.id)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
                        />
                        <span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">{f.name}</span>
                          {f.description && (
                            <span className="block text-xs text-slate-500 dark:text-slate-400">{f.description}</span>
                          )}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && !fetchError && factors.length > 0 && (
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} isLoading={isSaving}>Save mapping</Button>
          {saveError && <p className="text-sm text-red-500">{saveError}</p>}
          {savedAt && !saveError && (
            <p className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" /> Saved
            </p>
          )}
        </div>
      )}
    </div>
  );
}
