"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Users, Building2, ArrowUpRight, Server, FolderKanban } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { useTheme } from "@/context/ThemeContext";

const LIFECYCLE_COLOURS: Record<string, string> = {
  Proposed:         "#94a3b8",
  Approved:         "#3b82f6",
  "In Development": "#f59e0b",
  Production:       "#10b981",
  Sunset:           "#f97316",
  Retired:          "#ef4444",
};

interface LifecycleStat  { status: string;   count: number; }
interface TierStat       { tier: string;     count: number; }
interface StrategyStat   { strategy: string; count: number; }

const TIER_COLOURS = [
  "#6d28d9", "#2563eb", "#0891b2", "#059669",
  "#d97706", "#dc2626", "#7c3aed", "#0284c7",
];

const STRATEGY_COLOURS = [
  "#0ea5e9", "#6366f1", "#8b5cf6", "#ec4899",
  "#14b8a6", "#f59e0b", "#10b981", "#ef4444",
];

// ── Chart theme tokens ─────────────────────────────────────────────────────────
function useChartTheme(isDark: boolean) {
  return {
    grid:    isDark ? "#1e293b" : "#f1f5f9",
    tick:    isDark ? "#64748b" : "#94a3b8",
    tooltip: {
      backgroundColor: isDark ? "#0f172a" : "#ffffff",
      border:          `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
      color:           isDark ? "#f1f5f9" : "#1e293b",
      borderRadius:    "8px",
      fontSize:        "12px",
    },
    legendText: isDark ? "#94a3b8" : "#475569",
    legendValue: isDark ? "#e2e8f0" : "#1e293b",
  };
}

// ── Stat icon background — light colour needs a dark equivalent ───────────────
const ICON_BG_DARK: Record<string, string> = {
  "bg-violet-50":  "dark:bg-violet-900/30",
  "bg-emerald-50": "dark:bg-emerald-900/30",
  "bg-amber-50":   "dark:bg-amber-900/30",
  "bg-blue-50":    "dark:bg-blue-900/30",
  "bg-brand-50":   "dark:bg-brand-900/30",
};

export default function DashboardPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const ct = useChartTheme(isDark);

  const [publishedDepts, setPublishedDepts]     = useState<number | null>(null);
  const [activeProjects, setActiveProjects]     = useState<number | null>(null);
  const [assetsByLifecycle, setAssetsByLifecycle] = useState<LifecycleStat[]>([]);
  const [assetsByTier, setAssetsByTier]         = useState<TierStat[]>([]);
  const [assetsByStrategy, setAssetsByStrategy] = useState<StrategyStat[]>([]);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((d) => {
        setPublishedDepts(d.publishedDepartments ?? 0);
        setActiveProjects(d.activeProjects ?? 0);
        setAssetsByLifecycle(d.assetsByLifecycle ?? []);
        setAssetsByTier(d.assetsByTier ?? []);
        setAssetsByStrategy(d.assetsByStrategy ?? []);
      })
      .catch(() => {
        setPublishedDepts(0);
        setActiveProjects(0);
        setAssetsByLifecycle([]);
        setAssetsByTier([]);
        setAssetsByStrategy([]);
      });
  }, []);

  const totalAssets = assetsByLifecycle.reduce((sum, s) => sum + s.count, 0);

  const stats = [
    {
      label: "Total Assets",
      value: totalAssets === 0 && assetsByLifecycle.length === 0 ? "—" : String(totalAssets),
      change: "Registered assets",
      icon: Server,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-900/30",
      loading: publishedDepts === null,
    },
    {
      label: "In Production",
      value: String(assetsByLifecycle.find((s) => s.status === "Production")?.count ?? 0),
      change: "Live assets",
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/30",
      loading: publishedDepts === null,
    },
    {
      label: "In Development",
      value: String(assetsByLifecycle.find((s) => s.status === "In Development")?.count ?? 0),
      change: "Being built",
      icon: Users,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-900/30",
      loading: publishedDepts === null,
    },
    {
      label: "Published Departments",
      value: publishedDepts === null ? "—" : String(publishedDepts),
      change: "Active departments",
      icon: Building2,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/30",
      loading: publishedDepts === null,
    },
    {
      label: "Active Projects",
      value: activeProjects === null ? "—" : String(activeProjects),
      change: "In-flight projects",
      icon: FolderKanban,
      color: "text-brand-600 dark:text-brand-400",
      bg: "bg-brand-50 dark:bg-brand-900/30",
      loading: activeProjects === null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Enterprise architecture overview.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{s.label}</p>
              <div className={`rounded-lg p-2 ${s.bg}`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
            </div>
            {s.loading ? (
              <div className="mt-3 h-8 w-12 animate-pulse rounded bg-slate-100 dark:bg-slate-700" />
            ) : (
              <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">{s.value}</p>
            )}
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              <ArrowUpRight className="h-3 w-3" />
              {s.change}
            </p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Pie chart — assets by lifecycle */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">Assets by Lifecycle Stage</h2>
          {assetsByLifecycle.length === 0 ? (
            <div className="mt-4 flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-sm text-slate-400 dark:text-slate-500">No assets registered yet</p>
            </div>
          ) : (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assetsByLifecycle}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {assetsByLifecycle.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={LIFECYCLE_COLOURS[entry.status] ?? "#94a3b8"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name: any) => [`${value ?? 0} asset${Number(value) !== 1 ? "s" : ""}`, name]}
                    contentStyle={ct.tooltip}
                  />
                  <Legend
                    formatter={(value) => (
                      <span style={{ fontSize: "12px", color: ct.legendText }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Bar chart — assets by tier */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">Assets by Tier</h2>
          {assetsByTier.length === 0 ? (
            <div className="mt-4 flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-sm text-slate-400 dark:text-slate-500">No tier data yet</p>
            </div>
          ) : (
            <>
              <div className="mt-4 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={assetsByTier} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis dataKey="tier" tick={false} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: ct.tick }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => [`${value ?? 0} asset${Number(value) !== 1 ? "s" : ""}`, "Count"]}
                      contentStyle={ct.tooltip}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {assetsByTier.map((entry, i) => (
                        <Cell key={entry.tier} fill={TIER_COLOURS[i % TIER_COLOURS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <ul className="mt-3 space-y-1.5">
                {assetsByTier.map((entry, i) => (
                  <li key={entry.tier} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                      style={{ backgroundColor: TIER_COLOURS[i % TIER_COLOURS.length] }}
                    />
                    <span className="flex-1 text-xs text-slate-600 dark:text-slate-400">{entry.tier}</span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{entry.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Second row — active projects stat + assets by strategy pie */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Active projects stat card */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Active Projects</h2>
              <div className="rounded-lg bg-brand-50 p-2 dark:bg-brand-900/30">
                <FolderKanban className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Projects currently in flight</p>
          </div>
          {activeProjects === null ? (
            <div className="mt-6 h-12 w-20 animate-pulse rounded bg-slate-100 dark:bg-slate-700" />
          ) : (
            <div className="mt-6">
              <p className="text-5xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {activeProjects}
              </p>
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                {activeProjects === 0
                  ? "No active projects — create one to get started"
                  : activeProjects === 1
                  ? "1 project is currently active"
                  : `${activeProjects} projects are currently active`}
              </p>
            </div>
          )}
        </div>

        {/* Pie chart — assets by strategy */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">Assets by Strategy</h2>
          {assetsByStrategy.length === 0 ? (
            <div className="mt-4 flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-sm text-slate-400 dark:text-slate-500">No strategy data yet</p>
            </div>
          ) : (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assetsByStrategy}
                    dataKey="count"
                    nameKey="strategy"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {assetsByStrategy.map((entry, i) => (
                      <Cell
                        key={entry.strategy}
                        fill={STRATEGY_COLOURS[i % STRATEGY_COLOURS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name: any) => [`${value ?? 0} asset${Number(value) !== 1 ? "s" : ""}`, name]}
                    contentStyle={ct.tooltip}
                  />
                  <Legend
                    formatter={(value) => (
                      <span style={{ fontSize: "12px", color: ct.legendText }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
