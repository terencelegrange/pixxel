"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Check, ShieldAlert, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Asset, RiskFactorKind, RiskLevel } from "@/types";

interface AssessedFactor {
  id: string;
  name: string;
  description: string | null;
  kind: RiskFactorKind;
  severity: RiskLevel;
  likelihood: RiskLevel;
  impact: RiskLevel;
  status: "Met" | "Not Met" | "Partial";
  notes: string | null;
}

const LEVEL_BADGE: Record<RiskLevel, string> = {
  Low:      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  Medium:   "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  High:     "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Critical: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_STYLES: Record<AssessedFactor["status"], string> = {
  Met:        "bg-emerald-600 text-white",
  Partial:    "bg-amber-500 text-white",
  "Not Met":  "bg-red-600 text-white",
};

function FactorRow({
  factor, onSave,
}: {
  factor: AssessedFactor;
  onSave: (id: string, status: AssessedFactor["status"], notes: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState(factor.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStatusChange(status: AssessedFactor["status"]) {
    setIsSaving(true); setError(null);
    try { await onSave(factor.id, status, notes); setSavedAt(Date.now()); }
    catch (err) { setError(err instanceof Error ? err.message : "Save failed."); }
    finally { setIsSaving(false); }
  }

  async function handleNotesBlur() {
    if (notes === (factor.notes ?? "")) return;
    setIsSaving(true); setError(null);
    try { await onSave(factor.id, factor.status, notes); setSavedAt(Date.now()); }
    catch (err) { setError(err instanceof Error ? err.message : "Save failed."); }
    finally { setIsSaving(false); }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">{factor.name}</p>
          {factor.description && (
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{factor.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_BADGE[factor.severity]}`}>Severity: {factor.severity}</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_BADGE[factor.likelihood]}`}>Likelihood: {factor.likelihood}</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_BADGE[factor.impact]}`}>Impact: {factor.impact}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
          {(["Met", "Partial", "Not Met"] as const).map((status) => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              className={[
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                factor.status === status ? STATUS_STYLES[status] : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
              ].join(" ")}
            >
              {status}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <textarea
          rows={1}
          placeholder="Notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        {isSaving && <div className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />}
        {!isSaving && savedAt && <Check className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function AssetSecurityDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [factors, setFactors] = useState<AssessedFactor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const [assetRes, factorsRes] = await Promise.all([
        fetch(`/api/assets/${params.id}`),
        fetch(`/api/assets/${params.id}/risk-assessments`),
      ]);
      const [assetData, factorsData] = await Promise.all([assetRes.json(), factorsRes.json()]);
      if (!assetRes.ok) throw new Error(assetData.error ?? "Failed to load asset.");
      if (!factorsRes.ok) throw new Error(factorsData.error ?? "Failed to load risk assessments.");
      setAsset(assetData.asset);
      setFactors(factorsData.riskFactors);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data.");
    } finally { setIsLoading(false); }
  }, [params.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSave(riskFactorId: string, status: AssessedFactor["status"], notes: string) {
    if (!user) return;
    const res = await fetch(`/api/assets/${params.id}/risk-assessments/${riskFactorId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed.");
    setFactors((prev) => prev.map((f) => f.id === riskFactorId ? { ...f, status, notes } : f));
  }

  const attributes = factors.filter((f) => f.kind === "Attribute");
  const characteristics = factors.filter((f) => f.kind === "Characteristic");

  return (
    <div className="space-y-6">
      <Link href="/assets/security" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Asset Security
      </Link>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-red-500">
          <AlertTriangle className="h-6 w-6" />
          <p className="text-sm">{fetchError}</p>
        </div>
      ) : asset ? (
        <>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{asset.name}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {asset.category} · {asset.domainName ?? "No domain"}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                <ShieldAlert className="h-4 w-4" /> Attributes
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Fixable gaps for this asset&apos;s category.</p>
              <div className="mt-4 flex flex-col gap-3">
                {attributes.length === 0 ? (
                  <p className="py-6 text-center text-sm italic text-slate-400">No attributes mapped to this category.</p>
                ) : (
                  attributes.map((f) => <FactorRow key={f.id} factor={f} onSave={handleSave} />)
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                <ShieldCheck className="h-4 w-4" /> Characteristics
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Inherent traits to track exposure for.</p>
              <div className="mt-4 flex flex-col gap-3">
                {characteristics.length === 0 ? (
                  <p className="py-6 text-center text-sm italic text-slate-400">No characteristics mapped to this category.</p>
                ) : (
                  characteristics.map((f) => <FactorRow key={f.id} factor={f} onSave={handleSave} />)
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
