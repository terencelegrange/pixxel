"use client";

import Link from "next/link";
import { Settings, Bell, Lock, Globe, ShieldCheck, MessageSquare, ChevronRight, Layers, GitBranch, Gauge, Building2, Network, Target, Package2, BarChart2, ScrollText } from "lucide-react";

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

      {/* Reference Data */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
          Reference Data
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SettingsTile
            href="/organisations"
            icon={Building2}
            iconBg="bg-blue-500"
            title="Departments"
            description="Manage the business units and teams that own assets."
          />
          <SettingsTile
            href="/domains"
            icon={Network}
            iconBg="bg-teal-500"
            title="Domains"
            description="Classify assets by technology domain such as Application or Infrastructure."
          />
          <SettingsTile
            href="/asset-strategy"
            icon={Target}
            iconBg="bg-orange-500"
            title="Asset Strategy"
            description="Define strategic dispositions such as Adopt, Scale, Replace, or Retire."
          />
          <SettingsTile
            href="/vendors"
            icon={Package2}
            iconBg="bg-cyan-600"
            title="Vendors"
            description="Register the vendors and suppliers your assets depend on."
          />
          <SettingsTile
            href="/tiers"
            icon={BarChart2}
            iconBg="bg-amber-500"
            title="Tiers"
            description="Set criticality tiers to capture SLA expectations and support obligations."
          />
        </div>
      </div>

      {/* Configuration */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
          Configuration
        </h2>
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
          href="/settings/changelog"
          icon={ScrollText}
          iconBg="bg-emerald-500"
          title="Changelog"
          description="Record and publish what has changed in each platform release."
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
    </div>
  );
}
