"use client";

import { useState, useRef, ChangeEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, AlertTriangle, CheckCircle2, XCircle, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { parseCsv } from "@/lib/csv";

// ---------------------------------------------------------------------------
// Column reference (mirrors app/api/assets/bulk/route.ts)
// ---------------------------------------------------------------------------
const REQUIRED_COLUMNS = ["name", "department"];
const OPTIONAL_COLUMNS = [
  "short_code", "description", "type", "category", "lifecycle_status",
  "business_owner", "technical_owner", "domain", "vendor", "tier", "strategy",
  "notes", "app_url", "architects", "capabilities", "complexity", "hero_diagram",
];

const PREVIEW_ROW_LIMIT = 10;

interface RowResult {
  row: number;
  status: "created" | "failed";
  assetId?: string;
  warnings: string[];
  error?: string;
}

interface BulkResponse {
  summary: {
    total: number;
    created: number;
    failed: number;
    departmentsCreated: string[];
  };
  results: RowResult[];
}

export default function BulkUploadAssetsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResponse | null>(null);

  function resetImportState() {
    setImportError(null);
    setResult(null);
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    resetImportState();
    setParseError(null);
    setHeaders([]);
    setRows([]);
    setFileName(null);

    if (!file) return;
    setFileName(file.name);

    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.rows.length === 0) {
        setParseError("No data rows found in this file.");
        return;
      }
      setHeaders(parsed.headers);
      setRows(parsed.rows);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to read file.");
    }
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setIsImporting(true);
    setImportError(null);
    setResult(null);
    try {
      const res = await fetch("/api/assets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setResult(data);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsImporting(false);
    }
  }

  function handleChooseFile() {
    fileInputRef.current?.click();
  }

  function handleReset() {
    setFileName(null);
    setHeaders([]);
    setRows([]);
    setParseError(null);
    resetImportState();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bulk Upload Assets</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Import multiple assets at once from a CSV file.
        </p>
      </div>

      {/* Format description */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">CSV format</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          The first row must be a header row. Column names are matched case-insensitively and spaces/hyphens are
          treated the same as underscores (e.g. &quot;Short Code&quot; and &quot;short_code&quot; both work).
          For columns that accept multiple values (Architects, Capabilities), separate values with{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">;</code> or{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">|</code>.
          Unrecognised departments are created automatically; unrecognised names for other lookup columns
          (Domain, Vendor, Tier, Strategy, Complexity, Hero Diagram, Architects, Capabilities) are skipped with a warning.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Required columns
            </h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {REQUIRED_COLUMNS.map((c) => (
                <li key={c} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Optional columns
            </h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {OPTIONAL_COLUMNS.map((c) => (
                <li key={c} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* File picker */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Choose a file</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button type="button" variant="secondary" onClick={handleChooseFile}>
            <Upload className="h-4 w-4" /> Choose CSV file
          </Button>
          {fileName && (
            <>
              <span className="text-sm text-slate-600 dark:text-slate-300">{fileName}</span>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                Clear
              </button>
            </>
          )}
        </div>
        {parseError && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{parseError}</span>
          </div>
        )}
      </div>

      {/* Preview */}
      {rows.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Preview</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {rows.length} row{rows.length !== 1 ? "s" : ""} found
                {rows.length > PREVIEW_ROW_LIMIT ? ` — showing first ${PREVIEW_ROW_LIMIT}` : ""}.
              </p>
            </div>
            <Button onClick={handleImport} isLoading={isImporting}>
              <Upload className="h-4 w-4" /> Import {rows.length} row{rows.length !== 1 ? "s" : ""}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {rows.slice(0, PREVIEW_ROW_LIMIT).map((row, i) => (
                  <tr key={i}>
                    {headers.map((h) => (
                      <td key={h} className="whitespace-nowrap px-4 py-2 text-sm text-slate-600 dark:text-slate-300">
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {importError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{importError}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Total</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{result.summary.total}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Created</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{result.summary.created}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Failed</p>
              <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">{result.summary.failed}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Departments created</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{result.summary.departmentsCreated.length}</p>
            </div>
          </div>

          {result.summary.departmentsCreated.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                New departments created
              </h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {result.summary.departmentsCreated.map((d) => (
                  <li key={d} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Row results</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Row</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Warnings / Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {result.results.map((r) => (
                    <tr key={r.row}>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-600 dark:text-slate-300">{r.row + 1}</td>
                      <td className="whitespace-nowrap px-4 py-2">
                        {r.status === "created" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Created
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            <XCircle className="h-3.5 w-3.5" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300">
                        {r.error && <p className="text-red-600 dark:text-red-400">{r.error}</p>}
                        {r.warnings.length > 0 && (
                          <ul className="space-y-0.5">
                            {r.warnings.map((w, wi) => (
                              <li key={wi} className="flex items-start gap-1 text-amber-600 dark:text-amber-400">
                                <FileWarning className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                <span>{w}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {!r.error && r.warnings.length === 0 && <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
