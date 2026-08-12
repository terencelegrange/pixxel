"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, ListChecks, LayoutGrid } from "lucide-react";

function ConfigTile({
  href, icon: Icon, iconBg, title, description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <div className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-brand-300 hover:shadow-md cursor-pointer dark:border-slate-700 dark:bg-slate-900">
        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400 truncate">{description}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-brand-500 transition-colors flex-shrink-0" />
      </div>
    </Link>
  );
}

export default function SecurityConfigurationPage() {
  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Security Configuration</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Define the attributes and characteristics used in security assessments, and map them to asset categories.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ConfigTile
          href="/settings/security-configuration/risk-factors"
          icon={ListChecks}
          iconBg="bg-red-600"
          title="Attributes & Characteristics"
          description="Define fixable attributes (e.g. Automated Patching) and inherent characteristics (e.g. PII Data), each with a severity, likelihood, and impact rating."
        />
        <ConfigTile
          href="/settings/security-configuration/category-mapping"
          icon={LayoutGrid}
          iconBg="bg-orange-600"
          title="Asset Category Mapping"
          description="Choose which attributes and characteristics apply to each asset category, such as Application or Infrastructure."
        />
      </div>
    </div>
  );
}
