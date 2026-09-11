"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ExternalLink } from "lucide-react";
import { Contract } from "@/types";

function formatCurrency(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function AssetContractsList({ assetId }: { assetId: string }) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/contracts?asset=${assetId}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setContracts(d.contracts ?? []); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [assetId]);

  if (isLoading) {
    return <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />;
  }

  if (contracts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 py-6 text-slate-400 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500">
        <FileText className="h-6 w-6 text-slate-300 dark:text-slate-600" />
        <p className="text-sm">No contracts linked to this asset</p>
        <Link href="/contracts" className="text-xs text-brand-600 hover:underline">
          Add one on the Contracts page
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {contracts.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{c.title}</p>
            {c.docUrl && (
              <a href={c.docUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-brand-600">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span>{formatCurrency(c.value)}</span>
            <span>Ends {formatDate(c.endDate)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
