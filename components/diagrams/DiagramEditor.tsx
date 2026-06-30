"use client";

import "@excalidraw/excalidraw/index.css";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft, Save, History, Search, Plus, RotateCcw,
  Check, Loader2, Grid3x3, ImagePlus,
} from "lucide-react";
import { Asset } from "@/types";
import { STENCIL_GROUPS, type StencilItem } from "./stencils";

/** Grid size in px — shapes and placements snap to this interval */
const GRID = 20;
const snapToGrid = (v: number) => Math.round(v / GRID) * GRID;

// Dynamically import Excalidraw — browser-only, no SSR
const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((m) => ({ default: m.Excalidraw })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    ),
  }
);

interface VersionSummary {
  id: string;
  versionNumber: number;
  createdByName: string;
  createdAt: string;
}

export interface DiagramEditorProps {
  diagramId: string;
  initialName: string;
  initialContent: string;
  initialVersionNumber: number;
  userId: string;
  userName: string;
}

export default function DiagramEditor({
  diagramId,
  initialName,
  initialContent,
  initialVersionNumber,
  userId,
  userName,
}: DiagramEditorProps) {
  // ── Name state ───────────────────────────────────────────────────────────
  const [name, setName] = useState(initialName);
  const [editingName, setEditingName] = useState(false);

  // ── Canvas state ──────────────────────────────────────────────────────────
  const [hasChanges, setHasChanges] = useState(false);
  const [versionNumber, setVersionNumber] = useState(initialVersionNumber);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Auto-save timer ref ───────────────────────────────────────────────────
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Grid toggle ───────────────────────────────────────────────────────────
  const [gridEnabled, setGridEnabled] = useState(true);

  // ── Excalidraw API ref ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const setApiCallback = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api: any) => setExcalidrawAPI(api),
    []
  );

  // ── Left panel ───────────────────────────────────────────────────────────
  const [leftTab, setLeftTab] = useState<"assets" | "shapes">("assets");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetSearch, setAssetSearch] = useState("");

  // ── Version history ───────────────────────────────────────────────────────
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // ── File input ref (image import) ─────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Initial data (parsed once) ────────────────────────────────────────────
  const initialData = useMemo(() => {
    try {
      const parsed = JSON.parse(initialContent);
      return {
        elements: parsed.elements ?? [],
        appState: {
          viewBackgroundColor: "#ffffff",
          gridSize: GRID,
          ...(parsed.appState ?? {}),
          gridModeEnabled: false,
          objectsSnapModeEnabled: true,
          currentItemArrowType: "elbow" as const,
          collaborators: new Map(),
        },
        files: parsed.files ?? {},
        scrollToContent: true,
      };
    } catch {
      return {
        elements: [],
        appState: {
          viewBackgroundColor: "#ffffff",
          gridSize: GRID,
          gridModeEnabled: false,
          objectsSnapModeEnabled: true,
          currentItemArrowType: "elbow" as const,
          collaborators: new Map(),
        },
        files: {},
      };
    }
  }, [initialContent]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load assets ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((d) => setAssets(d.assets ?? []))
      .catch(console.error);
  }, []);

  // ── Load version history ──────────────────────────────────────────────────
  const loadVersions = useCallback(() => {
    setLoadingVersions(true);
    fetch(`/api/diagrams/${diagramId}/versions`)
      .then((r) => r.json())
      .then((d) => setVersions(d.versions ?? []))
      .catch(console.error)
      .finally(() => setLoadingVersions(false));
  }, [diagramId]);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  // ── onChange: mark unsaved ────────────────────────────────────────────────
  const onCanvasChange = useCallback(() => {
    setHasChanges(true);
  }, []);

  // ── Grid toggle ───────────────────────────────────────────────────────────
  const handleGridToggle = useCallback(() => {
    if (!excalidrawAPI) return;
    const next = !gridEnabled;
    setGridEnabled(next);
    excalidrawAPI.updateScene({
      appState: { gridSize: next ? GRID : null },
    });
  }, [excalidrawAPI, gridEnabled]);

  // ── Place an asset node on canvas ─────────────────────────────────────────
  const placeAsset = useCallback(
    (asset: Asset) => {
      if (!excalidrawAPI) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elements: any[] = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();

      // Position near viewport centre, snapped to grid, with a cascade offset
      const cascade = (elements.length % 6) * GRID;
      const offsetX = snapToGrid(-(appState.scrollX ?? 0) + 200 + cascade);
      const offsetY = snapToGrid(-(appState.scrollY ?? 0) + 200 + cascade);

      const W = 200, H = 80; // multiples of GRID
      const shapeId = `asset_${asset.id}_${Date.now()}`;
      const textId = `text_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const rng = () => Math.floor(Math.random() * 999999);
      const now = Date.now();

      const rect = {
        id: shapeId,
        type: "rectangle",
        x: offsetX, y: offsetY,
        width: W, height: H,
        angle: 0,
        strokeColor: "#1971c2",
        backgroundColor: "#e7f5ff",
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 0,
        opacity: 100,
        isDeleted: false,
        groupIds: [],
        frameId: null,
        roundness: { type: 3, value: 8 },
        seed: rng(), version: 1, versionNonce: rng(),
        updated: now, link: null, locked: false,
        boundElements: [{ id: textId, type: "text" }],
        customData: {
          assetId: asset.id,
          assetName: asset.name,
          assetType: asset.type,
        },
      };

      const txt = {
        id: textId,
        type: "text",
        x: offsetX, y: offsetY,
        width: W, height: H,
        angle: 0,
        strokeColor: "#1971c2",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 0,
        opacity: 100,
        isDeleted: false,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: rng(), version: 1, versionNonce: rng(),
        updated: now, link: null, locked: false,
        boundElements: null,
        containerId: shapeId,
        text: asset.name,
        originalText: asset.name,
        fontSize: 14,
        fontFamily: 2,
        textAlign: "center",
        verticalAlign: "middle",
        baseline: 14,
        autoResize: true,
        lineHeight: 1.25,
      };

      excalidrawAPI.updateScene({ elements: [...elements, rect, txt] });
      setHasChanges(true);
    },
    [excalidrawAPI]
  );

  // ── Place a stencil element on canvas ─────────────────────────────────────
  const placeStencil = useCallback(
    (stencil: StencilItem) => {
      if (!excalidrawAPI) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elements: any[] = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const cascade = (elements.length % 6) * GRID;
      const offsetX = snapToGrid(-(appState.scrollX ?? 0) + 200 + cascade);
      const offsetY = snapToGrid(-(appState.scrollY ?? 0) + 200 + cascade);
      const newEls = stencil.createElement(offsetX, offsetY);
      excalidrawAPI.updateScene({ elements: [...elements, ...newEls] });
      setHasChanges(true);
    },
    [excalidrawAPI]
  );

  // ── Import image from file ────────────────────────────────────────────────
  const importImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !excalidrawAPI) return;
      e.target.value = "";

      const dataURL = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { w: naturalW, h: naturalH } = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.src = dataURL;
      });

      const MAX_DIM = 320;
      const scale = Math.min(1, MAX_DIM / Math.max(naturalW, naturalH));
      const W = snapToGrid(Math.round(naturalW * scale));
      const H = snapToGrid(Math.round(naturalH * scale));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elements: any[] = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const cascade = (elements.length % 6) * GRID;
      const offsetX = snapToGrid(-(appState.scrollX ?? 0) + 200 + cascade);
      const offsetY = snapToGrid(-(appState.scrollY ?? 0) + 200 + cascade);

      const fileId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const elId = `el_${fileId}`;
      const rng = () => Math.floor(Math.random() * 999999);
      const now = Date.now();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      excalidrawAPI.addFiles([{
        id: fileId as any,
        mimeType: file.type as any,
        dataURL: dataURL as any,
        created: now,
        lastRetrieved: now,
      }]);

      excalidrawAPI.updateScene({
        elements: [
          ...elements,
          {
            type: "image",
            id: elId,
            x: offsetX,
            y: offsetY,
            width: W,
            height: H,
            angle: 0,
            strokeColor: "transparent",
            backgroundColor: "transparent",
            fillStyle: "solid",
            strokeWidth: 2,
            strokeStyle: "solid",
            roughness: 1,
            opacity: 100,
            isDeleted: false,
            groupIds: [],
            frameId: null,
            roundness: null,
            seed: rng(),
            version: 1,
            versionNonce: rng(),
            updated: now,
            link: null,
            locked: false,
            boundElements: null,
            status: "saved",
            fileId,
            scale: [1, 1],
          },
        ],
      });
      setHasChanges(true);
    },
    [excalidrawAPI]
  );

  // ── Save current scene as a new version ───────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!excalidrawAPI) return;
    setIsSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elements: any[] = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      // Extract referenced asset IDs from element customData
      const assetIds: string[] = Array.from(
        new Set(
          elements
            .filter((el) => !el.isDeleted && el.customData?.assetId)
            .map((el) => el.customData.assetId as string)
        )
      );

      const content = JSON.stringify({
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor ?? "#ffffff",
          gridSize: appState.gridSize ?? GRID,
          gridModeEnabled: appState.gridModeEnabled ?? false,
          objectsSnapModeEnabled: appState.objectsSnapModeEnabled ?? true,
          currentItemArrowType: appState.currentItemArrowType ?? "elbow",
        },
        files,
      });

      const res = await fetch(`/api/diagrams/${diagramId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, assetIds, userId, userName }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setVersionNumber(data.versionNumber);
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      loadVersions();
    } catch {
      setSaveError("Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [excalidrawAPI, diagramId, userId, userName, loadVersions]);

  // ── Auto-save: debounce 800ms after last change ───────────────────────────
  useEffect(() => {
    if (!hasChanges) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      setIsAutoSaving(true);
      await handleSave();
      setIsAutoSaving(false);
    }, 800);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [hasChanges, handleSave]);

  // ── Update diagram name ───────────────────────────────────────────────────
  const handleNameSave = useCallback(async () => {
    setEditingName(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === initialName) {
      setName(initialName);
      return;
    }
    try {
      await fetch(`/api/diagrams/${diagramId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, userId, userName }),
      });
    } catch {
      setName(initialName);
    }
  }, [name, initialName, diagramId, userId, userName]);

  // ── Restore a version ─────────────────────────────────────────────────────
  const handleRestore = useCallback(
    async (versionId: string) => {
      if (!excalidrawAPI) return;
      setRestoringId(versionId);
      try {
        const res = await fetch(`/api/diagrams/${diagramId}/versions/${versionId}`);
        if (!res.ok) throw new Error("Failed");
        const { version } = await res.json();
        const parsed = JSON.parse(version.content);
        const restoredGridSize = parsed.appState?.gridSize ?? null;
        setGridEnabled(restoredGridSize !== null);
        if (parsed.files && Object.keys(parsed.files).length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          excalidrawAPI.addFiles(Object.values(parsed.files) as any[]);
        }
        excalidrawAPI.updateScene({
          elements: parsed.elements ?? [],
          appState: {
            ...(parsed.appState ?? {}),
            collaborators: new Map(),
          },
        });
        setHasChanges(true);
      } catch {
        // silent fail — user can retry
      } finally {
        setRestoringId(null);
      }
    },
    [diagramId, excalidrawAPI]
  );

  // ── Filtered assets ───────────────────────────────────────────────────────
  const filteredAssets = useMemo(
    () =>
      assetSearch
        ? assets.filter((a) =>
            a.name.toLowerCase().includes(assetSearch.toLowerCase())
          )
        : assets,
    [assets, assetSearch]
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-slate-200 bg-white shrink-0 z-10 shadow-sm">
        <Link
          href="/diagrams"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Diagrams
        </Link>

        <div className="h-5 w-px bg-slate-200" />

        {/* Editable name */}
        {editingName ? (
          <input
            autoFocus
            className="text-base font-semibold text-slate-800 border-b-2 border-brand-500 bg-transparent outline-none px-1 min-w-40 max-w-xs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameSave();
              if (e.key === "Escape") { setName(initialName); setEditingName(false); }
            }}
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="text-base font-semibold text-slate-800 hover:text-brand-600 px-1 truncate max-w-xs"
            title="Click to rename"
          >
            {name}
          </button>
        )}

        <span className="text-xs text-slate-400 ml-0.5 shrink-0">
          {hasChanges ? "· Unsaved changes" : `· v${versionNumber}`}
        </span>

        <div className="flex-1" />

        <button
          onClick={handleGridToggle}
          disabled={!excalidrawAPI}
          title={gridEnabled ? "Disable grid snap" : "Enable grid snap"}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            gridEnabled
              ? "bg-slate-100 text-slate-800 ring-1 ring-slate-300"
              : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <Grid3x3 className="h-4 w-4" />
          Grid
        </button>

        {isAutoSaving && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Auto-saving…
          </span>
        )}
        {saveError && (
          <span className="text-xs text-red-600">{saveError}</span>
        )}
        {saveSuccess && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <Check className="h-3.5 w-3.5" />
            Saved
          </span>
        )}

        <button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </button>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left Panel ──────────────────────────────────────────────── */}
        <aside className="w-64 flex flex-col border-r border-slate-200 bg-white shrink-0 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setLeftTab("assets")}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                leftTab === "assets"
                  ? "border-b-2 border-brand-600 text-brand-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Assets
            </button>
            <button
              onClick={() => setLeftTab("shapes")}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                leftTab === "shapes"
                  ? "border-b-2 border-brand-600 text-brand-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Shapes
            </button>
          </div>

          {/* Assets tab */}
          {leftTab === "assets" && (
            <div className="flex flex-col flex-1 overflow-hidden p-2 gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search assets…"
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 -mt-1 px-0.5">
                Click to place on canvas
              </p>
              <button
                onClick={importImage}
                disabled={!excalidrawAPI}
                className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs font-medium text-slate-600 rounded border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ImagePlus className="h-3.5 w-3.5 shrink-0" />
                Import image
              </button>
              <div className="flex-1 overflow-y-auto space-y-0.5">
                {filteredAssets.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => placeAsset(a)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-left rounded hover:bg-slate-50 group transition-colors"
                  >
                    <Plus className="h-3 w-3 text-slate-300 group-hover:text-brand-500 shrink-0 transition-colors" />
                    <span className="text-xs text-slate-700 truncate">{a.name}</span>
                    <span className="ml-auto text-[10px] text-slate-400 shrink-0">{a.type}</span>
                  </button>
                ))}
                {filteredAssets.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">No assets found</p>
                )}
              </div>
            </div>
          )}

          {/* Shapes tab */}
          {leftTab === "shapes" && (
            <div className="flex-1 overflow-y-auto p-2 space-y-4">
              {STENCIL_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1 mb-1.5">
                    {group.title}
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => placeStencil(item)}
                        title={item.label}
                        className="flex flex-col items-center gap-1 p-2 rounded border border-slate-200 hover:border-brand-300 hover:bg-brand-50 text-center transition-colors"
                      >
                        <span className="text-xl leading-none">{item.emoji}</span>
                        <span className="text-[10px] text-slate-600 leading-tight">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* ── Canvas ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
          <Excalidraw
            excalidrawAPI={setApiCallback}
            initialData={initialData}
            onChange={onCanvasChange}
            UIOptions={{
              canvasActions: {
                saveToActiveFile: false,
                loadScene: false,
                export: { saveFileToDisk: true },
                changeViewBackgroundColor: true,
                toggleTheme: true,
              },
            }}
          />
        </div>

        {/* ── Right Panel ─────────────────────────────────────────────── */}
        <aside className="w-56 flex flex-col border-l border-slate-200 bg-white shrink-0 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200">
            <History className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Versions
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {loadingVersions ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            ) : versions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No saved versions yet
              </p>
            ) : (
              versions.map((v, i) => (
                <div
                  key={v.id}
                  className={`rounded-lg p-2.5 ${
                    i === 0
                      ? "bg-brand-50 border border-brand-200"
                      : "bg-slate-50 border border-slate-100 hover:border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-bold text-slate-700">v{v.versionNumber}</span>
                    {i === 0 && (
                      <span className="text-[10px] bg-brand-100 text-brand-700 font-semibold px-1.5 py-0.5 rounded-full">
                        current
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium truncate">{v.createdByName}</p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(v.createdAt).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {i > 0 && (
                    <button
                      onClick={() => handleRestore(v.id)}
                      disabled={restoringId === v.id}
                      className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-brand-600 disabled:opacity-50 transition-colors"
                    >
                      {restoringId === v.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      Restore
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
