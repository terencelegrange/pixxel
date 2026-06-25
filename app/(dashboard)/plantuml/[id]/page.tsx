"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Download, Loader2, Check, History, RotateCcw, Layers, Trash2, Tag } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";

// ── PlantUML participant parser ────────────────────────────────────────────────
function extractParticipants(source: string): string[] {
  const keywords = ["actor", "participant", "boundary", "control", "entity", "database", "collections", "queue"];
  const pattern = new RegExp(
    `^\\s*(?:${keywords.join("|")})\\s+(?:"([^"]+)"|([\\w.\\-/]+))(?:\\s+as\\s+(\\w+))?`,
    "gim"
  );
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const displayName = match[1] ?? match[2];
    if (displayName) names.push(displayName.trim());
    if (match[3]) names.push(match[3].trim());
  }
  return Array.from(new Set(names));
}

interface DiagramVersion {
  id: string;
  version_number: number;
  source: string;
  created_by_name: string;
  created_at: string;
}

interface TaggedAsset {
  id: string;
  name: string;
  shortCode: string | null;
  category: string;
  lifecycleStatus: string;
  matchedOn: string;
}

interface DiagramDetail {
  id: string;
  name: string;
  description: string | null;
  latest_version: number;
  current_source: string;
}

export default function PlantUMLEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [diagram, setDiagram] = useState<DiagramDetail | null>(null);
  const [source, setSource] = useState("");
  const [versions, setVersions] = useState<DiagramVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [renderedSvg, setRenderedSvg] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const [taggedAssets, setTaggedAssets] = useState<TaggedAsset[]>([]);
  const [isTagging, setIsTagging] = useState(false);
  const [unmatchedParticipants, setUnmatchedParticipants] = useState<string[]>([]);

  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch tagged assets ────────────────────────────────────────────────────
  const fetchTaggedAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/plantuml/${id}/assets`);
      if (res.ok) {
        const data = await res.json();
        setTaggedAssets(data.assets ?? []);
      }
    } catch {
      // silently ignore
    }
  }, [id]);

  // ── Load diagram ───────────────────────────────────────────────────────────
  const fetchDiagram = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [diagRes, versRes] = await Promise.all([
        fetch(`/api/plantuml/${id}`),
        fetch(`/api/plantuml/${id}/versions`),
      ]);
      if (!diagRes.ok) throw new Error("Diagram not found.");
      const diagData = await diagRes.json();
      const versData = versRes.ok ? await versRes.json() : { versions: [] };
      setDiagram(diagData.diagram);
      setSource(diagData.latestVersion?.source ?? "");
      setCurrentVersion(diagData.latestVersion?.version_number ?? 0);
      setVersions(versData.versions ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDiagram(); }, [fetchDiagram]);
  useEffect(() => { fetchTaggedAssets(); }, [fetchTaggedAssets]);

  // ── Debounced render ───────────────────────────────────────────────────────
  const renderSvg = useCallback(async (src: string) => {
    if (!src.trim()) {
      setRenderedSvg(null);
      setRenderError(null);
      return;
    }
    setIsRendering(true);
    setRenderError(null);
    try {
      const res = await fetch("/api/plantuml/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: src }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Render failed.");
      setRenderedSvg(data.svg);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : "Render failed.");
      setRenderedSvg(null);
    } finally {
      setIsRendering(false);
    }
  }, []);

  useEffect(() => {
    if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    renderTimerRef.current = setTimeout(() => {
      renderSvg(source);
    }, 600);
    return () => {
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    };
  }, [source, renderSvg]);

  // ── Save new version ───────────────────────────────────────────────────────
  async function handleSave() {
    if (!user || !diagram) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/plantuml/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, userId: user.id, userName: user.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setCurrentVersion(data.versionNumber ?? currentVersion + 1);
      // Refresh version history
      const versRes = await fetch(`/api/plantuml/${id}/versions`);
      if (versRes.ok) {
        const versData = await versRes.json();
        setVersions(versData.versions ?? []);
      }
      // Auto-tag assets from participants
      setIsTagging(true);
      try {
        const participants = extractParticipants(source);
        if (participants.length > 0) {
          const tagRes = await fetch(`/api/plantuml/${id}/assets/auto-tag`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ participantNames: participants }),
          });
          if (tagRes.ok) {
            const tagData = await tagRes.json();
            setUnmatchedParticipants(tagData.unmatched ?? []);
            await fetchTaggedAssets();
          }
        }
      } catch {
        // silently ignore tagging errors
      } finally {
        setIsTagging(false);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Download SVG ───────────────────────────────────────────────────────────
  async function handleDownload() {
    try {
      const res = await fetch("/api/plantuml/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Render failed.");
      const blob = new Blob([data.svg as string], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${diagram?.name ?? "diagram"}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silently fail download
    }
  }

  // ── Remove tagged asset ────────────────────────────────────────────────────
  async function handleRemoveAsset(assetId: string) {
    try {
      await fetch(`/api/plantuml/${id}/assets`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId }),
      });
      setTaggedAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch {
      // silently ignore
    }
  }

  // ── Restore version ────────────────────────────────────────────────────────
  function restoreVersion(v: DiagramVersion) {
    setSource(v.source);
    setShowHistory(false);
  }

  // ── Loading / error ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (loadError || !diagram) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
        <p>{loadError ?? "Diagram not found."}</p>
        <Link href="/plantuml">
          <Button variant="secondary" size="sm"><ArrowLeft className="h-4 w-4" /> Back to PlantUML</Button>
        </Link>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ height: "calc(100vh - 4rem)" }}>
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 flex-shrink-0">
        <Link
          href="/plantuml"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
        <h1 className="flex-1 min-w-0 text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
          {diagram.name}
        </h1>
        <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
          v{currentVersion}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saveError && <span className="text-xs text-red-500">{saveError}</span>}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowHistory((s) => !s)}
            title="Version history"
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAssets((s) => !s)}
            title="Referenced assets"
          >
            <Layers className="h-4 w-4" />
            {taggedAssets.length > 0 && (
              <span className="ml-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-xs text-white leading-none">
                {taggedAssets.length}
              </span>
            )}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDownload} title="Download SVG">
            <Download className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleSave} isLoading={isSaving}>
            {saveSuccess ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saveSuccess ? "Saved!" : "Save New Version"}
          </Button>
        </div>
      </header>

      {/* Main panels */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 min-h-0 min-w-0">
          <textarea
            className="w-full h-full resize-none p-4 font-mono text-sm bg-slate-950 text-green-400 focus:outline-none"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            spellCheck={false}
            placeholder="@startuml&#10;...&#10;@enduml"
          />
        </div>

        {/* Divider */}
        <div className="w-px bg-slate-200 dark:bg-slate-800 flex-shrink-0" />

        {/* SVG Preview */}
        <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-slate-900 flex items-start justify-center p-4">
          {isRendering ? (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : renderError ? (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 w-full">
              <p className="text-sm text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap">{renderError}</p>
            </div>
          ) : renderedSvg ? (
            <div
              className="max-w-full"
              dangerouslySetInnerHTML={{ __html: renderedSvg }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-slate-600 text-sm">
              Start typing PlantUML code to see a preview
            </div>
          )}
        </div>

        {/* Version History Sidebar */}
        {showHistory && (
          <>
            <div className="w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
            <aside className="w-52 flex-shrink-0 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-y-auto">
              <div className="border-b border-slate-100 dark:border-slate-800 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Version History
                </p>
              </div>
              {versions.length === 0 ? (
                <p className="px-3 py-4 text-xs text-slate-400 dark:text-slate-500">No saved versions yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {versions.map((v) => (
                    <div key={v.id} className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">v{v.version_number}</span>
                        <button
                          onClick={() => restoreVersion(v)}
                          className="rounded p-1 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                          title="Restore this version"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{v.created_by_name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {new Date(v.created_at).toLocaleDateString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </>
        )}

        {/* Referenced Assets Sidebar */}
        {showAssets && (
          <>
            <div className="w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
            <aside className="w-64 flex-shrink-0 bg-white dark:bg-slate-900 overflow-y-auto flex flex-col">
              <div className="border-b border-slate-100 dark:border-slate-800 px-3 py-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  Referenced Assets
                </p>
                {isTagging && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
              </div>

              {taggedAssets.length === 0 ? (
                <div className="px-3 py-4 text-xs text-slate-400 dark:text-slate-500">
                  <p>No assets tagged yet.</p>
                  <p className="mt-1">Save a version to auto-match participants to assets by name or short code.</p>
                </div>
              ) : (
                <div className="flex-1 divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto">
                  {taggedAssets.map((a) => (
                    <div key={a.id} className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/assets/${a.id}`}
                            className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors block truncate"
                          >
                            {a.name}
                          </Link>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {a.shortCode && (
                              <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{a.shortCode}</span>
                            )}
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              matched by {a.matchedOn === "short_code" ? "short code" : "name"}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveAsset(a.id)}
                          className="rounded p-0.5 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove tag"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {unmatchedParticipants.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">No asset match found for:</p>
                  <ul className="space-y-0.5">
                    {unmatchedParticipants.map((p) => (
                      <li key={p} className="text-xs text-slate-400 dark:text-slate-500 font-mono truncate">{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
