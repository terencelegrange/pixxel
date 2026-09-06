"use client";

import { useState, type ReactNode } from "react";
import { SwaggerUIWrapper } from "./SwaggerUIWrapper";

export function DocsTabs({ guide, apiSpec, toc }: { guide: ReactNode; apiSpec: object; toc: ReactNode }) {
  const [tab, setTab] = useState<"guide" | "api">("guide");

  return (
    <div className="flex gap-8">
      {tab === "guide" && (
        <aside className="hidden xl:block w-56 flex-shrink-0">
          <div className="sticky top-6">{toc}</div>
        </aside>
      )}

      <div className="min-w-0 flex-1">
        <div className="mb-6 flex gap-1 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setTab("guide")}
            className={[
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === "guide"
                ? "border-brand-600 text-brand-700 dark:text-brand-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
            ].join(" ")}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setTab("api")}
            className={[
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === "api"
                ? "border-brand-600 text-brand-700 dark:text-brand-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
            ].join(" ")}
          >
            API Reference
          </button>
        </div>

        {tab === "guide" ? guide : <SwaggerUIWrapper spec={apiSpec} />}
      </div>
    </div>
  );
}
