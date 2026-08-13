"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ReferenceArea, ReferenceLine, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { AlertTriangle, LayoutGrid, Radar as RadarIcon, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/context/ThemeContext";
import { Asset, RiskFactor, RiskFactorKind, RiskLevel } from "@/types";
import { LEVEL_ORDER, summarizeAssetRisk } from "@/lib/riskAssessment";

interface RawAssessment { assetId: string; riskFactorId: string; status: "Met" | "Not Met" | "Partial"; }

const LEVEL_LABELS: RiskLevel[] = ["Low", "Medium", "High", "Critical"];
// Saturated, higher-contrast ramp — legible on both white and near-black chart backgrounds.
const SEVERITY_COLOURS: Record<RiskLevel, string> = {
  Low:      "#2563eb", // blue-600
  Medium:   "#ca8a04", // yellow-600
  High:     "#ea580c", // orange-600
  Critical: "#dc2626", // red-600
};
const WELL_MANAGED_COLOUR = "#16a34a"; // green-600

// Zone tints for the quadrant background — same hues as severity, higher opacity in dark mode
// since dark surfaces need more saturation to read as a tint at all.
const ZONE_COLOURS = { wellManaged: "#22c55e", monitor: "#eab308", needsAttention: "#f97316", critical: "#ef4444" };

function labelFor(asset: Asset): string {
  const code = asset.shortCode?.trim();
  if (code) return code;
  const initials = asset.name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase();
  return initials.slice(0, 4);
}

interface RiskPoint {
  assetId: string;
  name: string;
  label: string;
  category: string;
  domainName: string;
  x: number; // Likelihood, 1-4
  y: number; // Impact, 1-4
  ring: number; // 0 (well managed) .. 4 (worst = Critical), used by the radar view
  severity: RiskLevel | null; // null = nothing outstanding
  isWellManaged: boolean;
  openCount: number;
  worstFactorName: string | null;
}

function buildPoints(
  assets: Asset[], riskFactors: RiskFactor[], assessments: RawAssessment[], kind: RiskFactorKind
): { points: RiskPoint[]; notConfiguredCount: number } {
  const points: RiskPoint[] = [];
  let notConfiguredCount = 0;

  for (const asset of assets) {
    const summary = summarizeAssetRisk(asset, riskFactors, assessments, kind);
    if (!summary) { notConfiguredCount++; continue; }

    points.push({
      assetId: asset.id,
      name: asset.name,
      label: labelFor(asset),
      category: asset.category,
      domainName: asset.domainName ?? "No Domain",
      x: summary.worstLikelihood ? LEVEL_ORDER[summary.worstLikelihood] : 1,
      y: summary.worstImpact ? LEVEL_ORDER[summary.worstImpact] : 1,
      ring: summary.openCount === 0 ? 0 : LEVEL_ORDER[summary.worstSeverity!],
      severity: summary.worstSeverity,
      isWellManaged: summary.isWellManaged,
      openCount: summary.openCount,
      worstFactorName: summary.worstFactorName,
    });
  }

  // Spread points that land on the exact same quadrant cell so they don't fully overlap
  const buckets = new Map<string, RiskPoint[]>();
  for (const p of points) {
    const key = `${p.x}-${p.y}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  }
  for (const bucket of Array.from(buckets.values())) {
    if (bucket.length === 1) continue;
    bucket.forEach((p: RiskPoint, i: number) => {
      p.x += ((i % 3) - 1) * 0.14;
      p.y += (Math.floor(i / 3) - 1) * 0.14;
    });
  }

  return { points, notConfiguredCount };
}

function useChartTheme(isDark: boolean) {
  return {
    grid:    isDark ? "#334155" : "#e2e8f0",
    tick:    isDark ? "#94a3b8" : "#64748b",
    text:    isDark ? "#e2e8f0" : "#334155",
    dotStroke: isDark ? "#0f172a" : "#ffffff",
    zoneOpacity: isDark ? 0.22 : 0.12,
    labelStyle: (colour: string) => ({ fontSize: 11, fontWeight: 700, fill: colour }),
    tooltip: {
      backgroundColor: isDark ? "#0f172a" : "#ffffff",
      border:          `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
      color:           isDark ? "#f1f5f9" : "#1e293b",
      borderRadius:    "8px",
      fontSize:        "12px",
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tooltipFormatter = (_value: any, _name: any, item: any) => {
  const p: RiskPoint | undefined = item?.payload;
  if (!p) return ["", ""];
  const status = p.openCount === 0 ? "Well managed" : `${p.openCount} open · worst: ${p.worstFactorName}`;
  return [`${status} · ${p.domainName}`, p.name];
};

// ---------------------------------------------------------------------------
// Gartner-style quadrant view
// ---------------------------------------------------------------------------
function GartnerQuadrant({ points, ct }: { points: RiskPoint[]; ct: ReturnType<typeof useChartTheme> }) {
  const maxOpen = Math.max(1, ...points.map((p) => p.openCount));
  return (
    <div className="h-[520px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 32, left: 0, bottom: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />

          <ReferenceArea x1={0.5} x2={2.5} y1={0.5} y2={2.5} fill={ZONE_COLOURS.wellManaged} fillOpacity={ct.zoneOpacity}
            label={{ value: "Well Managed", position: "insideBottomLeft", ...ct.labelStyle(WELL_MANAGED_COLOUR) }} />
          <ReferenceArea x1={2.5} x2={4.5} y1={0.5} y2={2.5} fill={ZONE_COLOURS.monitor} fillOpacity={ct.zoneOpacity}
            label={{ value: "Monitor", position: "insideBottomRight", ...ct.labelStyle(SEVERITY_COLOURS.Medium) }} />
          <ReferenceArea x1={0.5} x2={2.5} y1={2.5} y2={4.5} fill={ZONE_COLOURS.needsAttention} fillOpacity={ct.zoneOpacity}
            label={{ value: "Needs Attention", position: "insideTopLeft", ...ct.labelStyle(SEVERITY_COLOURS.High) }} />
          <ReferenceArea x1={2.5} x2={4.5} y1={2.5} y2={4.5} fill={ZONE_COLOURS.critical} fillOpacity={ct.zoneOpacity + 0.03}
            label={{ value: "Critical Risk", position: "insideTopRight", ...ct.labelStyle(SEVERITY_COLOURS.Critical) }} />

          <XAxis
            type="number" dataKey="x" name="Likelihood" domain={[0.5, 4.5]}
            ticks={[1, 2, 3, 4]} tickFormatter={(v) => LEVEL_LABELS[v - 1] ?? ""}
            tick={{ fontSize: 11, fill: ct.tick }} tickLine={false} axisLine={{ stroke: ct.grid }}
            label={{ value: "Likelihood", position: "insideBottom", offset: -8, fontSize: 12, fontWeight: 600, fill: ct.text }}
          />
          <YAxis
            type="number" dataKey="y" name="Impact" domain={[0.5, 4.5]}
            ticks={[1, 2, 3, 4]} tickFormatter={(v) => LEVEL_LABELS[v - 1] ?? ""}
            tick={{ fontSize: 11, fill: ct.tick }} tickLine={false} axisLine={{ stroke: ct.grid }}
            label={{ value: "Impact", angle: -90, position: "insideLeft", fontSize: 12, fontWeight: 600, fill: ct.text }}
          />
          <ZAxis dataKey="openCount" domain={[0, maxOpen]} range={[90, 340]} />
          <ReferenceLine x={2.5} stroke={ct.tick} strokeOpacity={0.6} />
          <ReferenceLine y={2.5} stroke={ct.tick} strokeOpacity={0.6} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={ct.tooltip} formatter={tooltipFormatter} />
          <Scatter data={points}>
            {points.map((p) => (
              <Cell
                key={p.assetId}
                fill={p.severity ? SEVERITY_COLOURS[p.severity] : WELL_MANAGED_COLOUR}
                stroke={ct.dotStroke}
                strokeWidth={2}
              />
            ))}
            <LabelList
              dataKey="label"
              position="right"
              offset={10}
              style={{ fontSize: 11, fontWeight: 700, fill: ct.text, pointerEvents: "none" }}
            />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Radar view — rings are risk bands (centre = well managed, edge = critical);
// sectors group assets by category, like a tech radar.
// ---------------------------------------------------------------------------
const RING_LABELS = ["Well Managed", "Low", "Medium", "High", "Critical"];

function RiskRadar({ points, isDark }: { points: RiskPoint[]; isDark: boolean }) {
  const size = 560;
  const center = size / 2;
  const maxRadius = size / 2 - 60;
  const ringRadius = (ring: number) => 22 + (ring / 4) * (maxRadius - 22);

  const categories = useMemo(
    () => Array.from(new Set(points.map((p) => p.category))).sort(),
    [points]
  );
  const wedgeWidth = categories.length > 0 ? 360 / categories.length : 360;

  const placed = useMemo(() => {
    const byCategory = new Map<string, RiskPoint[]>();
    for (const p of points) {
      if (!byCategory.has(p.category)) byCategory.set(p.category, []);
      byCategory.get(p.category)!.push(p);
    }
    const out: { point: RiskPoint; angleDeg: number; radius: number }[] = [];
    categories.forEach((category, catIndex) => {
      const items = byCategory.get(category) ?? [];
      const startAngle = catIndex * wedgeWidth - 90; // start at top, go clockwise
      const usable = wedgeWidth * 0.75;
      const offset = (wedgeWidth - usable) / 2;
      items.forEach((point, i) => {
        const angleDeg = items.length === 1
          ? startAngle + wedgeWidth / 2
          : startAngle + offset + (i / (items.length - 1)) * usable;
        // small deterministic radius jitter so same-ring points in the same sector don't stack exactly
        const jitter = ((i % 3) - 1) * 8;
        out.push({ point, angleDeg, radius: ringRadius(point.ring) + jitter });
      });
    });
    return out;
  }, [points, categories, wedgeWidth]);

  const gridColour = isDark ? "#334155" : "#cbd5e1";
  const textColour = isDark ? "#cbd5e1" : "#475569";
  const labelColour = isDark ? "#f1f5f9" : "#1e293b";

  return (
    <div className="flex justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size} style={{ maxWidth: size }}>
        {/* Ring bands */}
        {[0, 1, 2, 3, 4].map((ring) => (
          <circle key={ring} cx={center} cy={center} r={ringRadius(ring) + (ring === 0 ? 14 : 27.5)}
            fill="none" stroke={gridColour} strokeWidth={1} strokeDasharray={ring === 4 ? undefined : "3 3"} />
        ))}
        {/* Ring labels along the top */}
        {[0, 1, 2, 3, 4].map((ring) => (
          <text key={ring} x={center + 4} y={center - (ringRadius(ring) + (ring === 0 ? 14 : 27.5)) + 12}
            fontSize={10} fill={textColour}>
            {RING_LABELS[ring]}
          </text>
        ))}
        {/* Sector dividers + category labels */}
        {categories.map((category, i) => {
          const angle = i * wedgeWidth - 90;
          const rad = (angle * Math.PI) / 180;
          const x2 = center + Math.cos(rad) * (maxRadius + 40);
          const y2 = center + Math.sin(rad) * (maxRadius + 40);
          const labelAngle = angle + wedgeWidth / 2;
          const labelRad = (labelAngle * Math.PI) / 180;
          const lx = center + Math.cos(labelRad) * (maxRadius + 34);
          const ly = center + Math.sin(labelRad) * (maxRadius + 34);
          return (
            <g key={category}>
              {categories.length > 1 && (
                <line x1={center} y1={center} x2={x2} y2={y2} stroke={gridColour} strokeWidth={1} />
              )}
              <text x={lx} y={ly} fontSize={10} fill={textColour} textAnchor="middle" dominantBaseline="middle">
                {category}
              </text>
            </g>
          );
        })}
        {/* Points */}
        {placed.map(({ point, angleDeg, radius }) => {
          const rad = (angleDeg * Math.PI) / 180;
          const cx = center + Math.cos(rad) * radius;
          const cy = center + Math.sin(rad) * radius;
          const fill = point.severity ? SEVERITY_COLOURS[point.severity] : WELL_MANAGED_COLOUR;
          const labelOnRight = Math.cos(rad) >= 0;
          return (
            <g key={point.assetId}>
              <circle cx={cx} cy={cy} r={7} fill={fill} stroke={isDark ? "#0f172a" : "#ffffff"} strokeWidth={1.5}>
                <title>
                  {point.name} — {point.openCount === 0 ? "Well managed" : `${point.openCount} open · worst: ${point.worstFactorName}`} · {point.domainName}
                </title>
              </circle>
              <text
                x={cx + (labelOnRight ? 10 : -10)} y={cy + 3.5}
                fontSize={10} fontWeight={700} fill={labelColour}
                textAnchor={labelOnRight ? "start" : "end"}
              >
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function SecurityQuadrantReport() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const ct = useChartTheme(isDark);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [riskFactors, setRiskFactors] = useState<RiskFactor[]>([]);
  const [assessments, setAssessments] = useState<RawAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [kind, setKind] = useState<RiskFactorKind>("Attribute");
  const [view, setView] = useState<"quadrant" | "radar">("quadrant");
  const [domainFilter, setDomainFilter] = useState(""); // "" = all domains, "__none__" = no domain

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

  const domainOptions = useMemo(() => {
    const map = new Map<string, string>();
    let hasNoDomain = false;
    for (const a of assets) {
      if (a.domainId) map.set(a.domainId, a.domainName ?? a.domainId);
      else hasNoDomain = true;
    }
    const opts = Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    if (hasNoDomain) opts.push({ id: "__none__", name: "No Domain" });
    return opts;
  }, [assets]);

  const filteredAssets = useMemo(() => {
    if (!domainFilter) return assets;
    if (domainFilter === "__none__") return assets.filter((a) => !a.domainId);
    return assets.filter((a) => a.domainId === domainFilter);
  }, [assets, domainFilter]);

  const { points, notConfiguredCount } = useMemo(
    () => buildPoints(filteredAssets, riskFactors, assessments, kind),
    [filteredAssets, riskFactors, assessments, kind]
  );

  const wellManagedCount = points.filter((p) => p.isWellManaged).length;
  const noCriteriaAtAll = riskFactors.filter((f) => f.kind === kind).length === 0;

  const tabBtn = (active: boolean) => [
    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
    active ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
  ].join(" ");

  const selectCls = "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Security Quadrant</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Assets plotted by Likelihood × Impact. An asset is &ldquo;well managed&rdquo; only once every Critical-severity item is Met.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
          <button onClick={() => setKind("Attribute")} className={tabBtn(kind === "Attribute")}>
            <ShieldAlert className="h-3.5 w-3.5" /> Attributes
          </button>
          <button onClick={() => setKind("Characteristic")} className={tabBtn(kind === "Characteristic")}>
            <ShieldCheck className="h-3.5 w-3.5" /> Characteristics
          </button>
        </div>

        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
          <button onClick={() => setView("quadrant")} className={tabBtn(view === "quadrant")}>
            <LayoutGrid className="h-3.5 w-3.5" /> Quadrant
          </button>
          <button onClick={() => setView("radar")} className={tabBtn(view === "radar")}>
            <RadarIcon className="h-3.5 w-3.5" /> Radar
          </button>
        </div>

        <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} className={selectCls}>
          <option value="">All domains</option>
          {domainOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <p className="text-xs text-slate-400">
        {kind === "Attribute"
          ? "Fixable gaps — remediate these to move assets toward the centre / bottom-left."
          : "Inherent traits — can't be removed, but track exposure and monitor accordingly."}
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-red-500">
          <AlertTriangle className="h-6 w-6" />
          <p className="text-sm">{fetchError}</p>
          <Button variant="secondary" size="sm" onClick={fetchData}>Retry</Button>
        </div>
      ) : noCriteriaAtAll ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-24 text-slate-400 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
          <LayoutGrid className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium">No {kind === "Attribute" ? "attributes" : "characteristics"} have been configured yet</p>
          <p className="text-xs">Define some in Settings → Security Configuration, then map them to asset categories.</p>
        </div>
      ) : points.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-24 text-slate-400 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
          <LayoutGrid className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium">Nothing to plot for this selection</p>
          <p className="text-xs">
            {notConfiguredCount > 0
              ? `${notConfiguredCount} asset${notConfiguredCount !== 1 ? "s" : ""} in view have no ${kind.toLowerCase()} mapped to their category.`
              : "Try a different domain."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>{points.length} plotted</span>
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" /> {wellManagedCount} well managed
            </span>
            {notConfiguredCount > 0 && (
              <span className="italic text-slate-400">
                {notConfiguredCount} asset{notConfiguredCount !== 1 ? "s" : ""} not yet configured for this category — excluded
              </span>
            )}
          </div>
          {view === "quadrant" ? <GartnerQuadrant points={points} ct={ct} /> : <RiskRadar points={points} isDark={isDark} />}
        </div>
      )}
    </div>
  );
}
