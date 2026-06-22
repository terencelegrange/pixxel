"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CheckCircle2, Circle, ArrowRight, Rocket, X } from "lucide-react";
import { useGetStarted } from "@/context/GetStartedContext";

export default function GetStartedPage() {
  const { steps, doneCount, allComplete, hidden, hide, refresh } = useGetStarted();

  // Refresh counts each time the page is visited so ticks update
  // when the user navigates away and comes back.
  useEffect(() => {
    refresh();
  }, [refresh]);

  if (hidden) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          You&apos;re all set up
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          This guide has been hidden. You can always manage your data from the Manage section.
        </p>
      </div>
    );
  }

  const progressPct = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Rocket className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Get Started</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Set up the reference data your team needs before registering assets.
          </p>
        </div>
        <button
          onClick={hide}
          className="mt-1 flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          title="Hide this guide"
        >
          <X className="h-3.5 w-3.5" />
          Hide guide
        </button>
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {doneCount} of {steps.length} steps complete
          </p>
          <span className="text-sm font-bold text-brand-600 dark:text-brand-400">{progressPct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-2 rounded-full bg-brand-600 transition-all duration-500 dark:bg-brand-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {allComplete && (
          <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            All steps complete — you&apos;re ready to register your first asset!
          </p>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step) => (
          <div
            key={step.key}
            className={[
              "flex items-center gap-4 rounded-xl border p-5 shadow-sm transition-colors",
              step.done
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/20"
                : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
            ].join(" ")}
          >
            {/* Status icon */}
            <div className="flex-shrink-0">
              {step.done ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              ) : (
                <Circle className="h-6 w-6 text-slate-300 dark:text-slate-600" />
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className={[
                "text-sm font-semibold",
                step.done
                  ? "text-emerald-800 dark:text-emerald-300"
                  : "text-slate-800 dark:text-slate-200",
              ].join(" ")}>
                {step.label}
                {step.done && (
                  <span className="ml-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    ({step.count} added)
                  </span>
                )}
              </p>
              <p className={[
                "mt-0.5 text-xs",
                step.done
                  ? "text-emerald-700/70 dark:text-emerald-400/70"
                  : "text-slate-500 dark:text-slate-400",
              ].join(" ")}>
                {step.description}
              </p>
            </div>

            {/* Action */}
            {step.done ? (
              <Link
                href={step.href}
                className="flex-shrink-0 text-xs font-medium text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
              >
                Manage
              </Link>
            ) : (
              <Link
                href={step.href}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                Set up
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Bottom dismiss */}
      {allComplete && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800/50 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                Setup complete!
              </p>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                Head to the Asset Registry to register your first asset.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={hide}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
              >
                Hide guide
              </button>
              <Link
                href="/assets"
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                Asset Registry
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
