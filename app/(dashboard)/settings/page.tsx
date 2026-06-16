"use client";

import Link from "next/link";
import { Settings, Bell, Lock, Palette, Globe, Sun, Moon, ShieldCheck, MessageSquare, ChevronRight, Layers, GitBranch, Gauge } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

// ---------------------------------------------------------------------------
// Appearance section (functional)
// ---------------------------------------------------------------------------
function AppearanceSection() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/50">
        <div className="flex items-center gap-2.5">
          <Palette className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Appearance</h2>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Theme</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isDark ? "Dark mode is active" : "Light mode is active"}
            </p>
          </div>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={[
              "relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900",
              isDark ? "bg-brand-600" : "bg-slate-200",
            ].join(" ")}
          >
            <span
              className={[
                "pointer-events-none inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow-sm ring-0 transition duration-200",
                isDark ? "translate-x-5" : "translate-x-0",
              ].join(" ")}
            >
              {isDark
                ? <Moon className="h-3 w-3 text-brand-600" />
                : <Sun className="h-3 w-3 text-amber-500" />
              }
            </span>
          </button>
        </div>

        {/* Mode cards */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => isDark && toggleTheme()}
            className={[
              "flex flex-col gap-2 rounded-lg border-2 p-3 text-left transition-colors",
              !isDark
                ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600",
            ].join(" ")}
          >
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Light</span>
              {!isDark && (
                <span className="ml-auto rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-400">
                  Active
                </span>
              )}
            </div>
            <div className="h-12 rounded-md border border-slate-200 bg-slate-50" />
          </button>

          <button
            onClick={() => !isDark && toggleTheme()}
            className={[
              "flex flex-col gap-2 rounded-lg border-2 p-3 text-left transition-colors",
              isDark
                ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600",
            ].join(" ")}
          >
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Dark</span>
              {isDark && (
                <span className="ml-auto rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-400">
                  Active
                </span>
              )}
            </div>
            <div className="h-12 rounded-md border border-slate-700 bg-slate-900" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clickable settings tile
// ---------------------------------------------------------------------------
function SettingsTile({
  href, icon: Icon, iconBg, title, description,
}: {
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  title: string;
  description: string;
}) {
  const inner = (
    <div className={[
      "group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900",
      href ? "hover:border-brand-300 hover:shadow-md cursor-pointer" : "opacity-60",
    ].join(" ")}>
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400 truncate">{description}</p>
      </div>
      {href
        ? <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-brand-500 transition-colors flex-shrink-0" />
        : <span className="text-xs font-medium text-slate-300 dark:text-slate-600 flex-shrink-0">Soon</span>
      }
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your account and application preferences.
        </p>
      </div>

      <AppearanceSection />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SettingsTile
          href="/settings/roles"
          icon={ShieldCheck}
          iconBg="bg-violet-500"
          title="Roles"
          description="Define roles and permission levels for users."
        />
        <SettingsTile
          href="/settings/feedback"
          icon={MessageSquare}
          iconBg="bg-sky-500"
          title="Feedback"
          description="View and manage user feedback submissions."
        />
        <SettingsTile
          href="/settings/industry-sectors"
          icon={Globe}
          iconBg="bg-teal-500"
          title="Industry Sectors"
          description="Manage industry sectors for business capability categorisation."
        />
        <SettingsTile
          href="/settings/business-capabilities"
          icon={Layers}
          iconBg="bg-indigo-500"
          title="Business Capabilities"
          description="Define and manage business capabilities by industry sector."
        />
        <SettingsTile
          href="/settings/diagram-types"
          icon={GitBranch}
          iconBg="bg-brand-500"
          title="Diagram Types"
          description="Configure diagram classification types (Domain, Program, Solution, Detailed)."
        />
        <SettingsTile
          href="/settings/asset-complexity"
          icon={Gauge}
          iconBg="bg-rose-500"
          title="Asset Complexity"
          description="Define complexity levels for classifying assets (e.g. Low, Medium, High, Critical)."
        />
        <SettingsTile
          icon={Settings}
          iconBg="bg-slate-400"
          title="General"
          description="Manage account name, timezone, and language."
        />
        <SettingsTile
          icon={Bell}
          iconBg="bg-amber-400"
          title="Notifications"
          description="Configure email and in-app notification preferences."
        />
        <SettingsTile
          icon={Lock}
          iconBg="bg-slate-500"
          title="Security"
          description="Update your password and manage 2FA settings."
        />
        <SettingsTile
          icon={Globe}
          iconBg="bg-sky-500"
          title="Integrations"
          description="Connect third-party services and manage API keys."
        />
      </div>
    </div>
  );
}
