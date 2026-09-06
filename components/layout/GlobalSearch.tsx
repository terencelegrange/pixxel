"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as LucideIcons from "lucide-react";
import { LucideProps, Search } from "lucide-react";
import { useFeatureTier } from "@/context/FeatureTierContext";
import { searchIndex } from "@/config/search-index";
import { SearchableItem } from "@/types";

const MAX_RESULTS = 8;

function ResultIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<LucideProps>>)[name];
  return Icon ? <Icon {...props} /> : <LucideIcons.Circle {...props} />;
}

/** Cheap relevance ranking: label match beats description-only match, and an
 * earlier match position beats a later one — good enough for a page list
 * this size without pulling in a fuzzy-search dependency. */
function rank(item: SearchableItem, q: string): number {
  const label = item.label.toLowerCase();
  const labelIdx = label.indexOf(q);
  if (labelIdx === 0) return 0;
  if (labelIdx > 0) return 1;
  const descIdx = (item.description ?? "").toLowerCase().indexOf(q);
  if (descIdx >= 0) return 2;
  return 3;
}

export function GlobalSearch() {
  const router = useRouter();
  const { hasFeature } = useFeatureTier();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return searchIndex
      .filter((item) => !item.featureKey || hasFeature(item.featureKey))
      .filter((item) => item.label.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q))
      .sort((a, b) => rank(a, q) - rank(b, q))
      .slice(0, MAX_RESULTS);
  }, [query, hasFeature]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  // Close on outside click, matching the header's other dropdowns.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cmd/Ctrl+K focuses the search box from anywhere in the app.
  useEffect(() => {
    function handleShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  function goTo(item: SearchableItem) {
    router.push(item.href);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      goTo(results[activeIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        type="search"
        placeholder="Search pages and settings..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-12 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline-block dark:border-slate-600 dark:bg-slate-900 dark:text-slate-500">
        ⌘K
      </kbd>

      {isOpen && query.trim() && (
        <div className="absolute left-0 top-full mt-1.5 w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-lg z-50 overflow-hidden dark:bg-slate-900 dark:border-slate-700">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
              No pages or settings match &ldquo;{query}&rdquo;
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1.5">
              {results.map((item, i) => (
                <li key={item.href}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => goTo(item)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={[
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      i === activeIndex ? "bg-slate-50 dark:bg-slate-800" : "",
                    ].join(" ")}
                  >
                    <ResultIcon name={item.icon} className="h-4 w-4 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{item.label}</p>
                      {item.description && (
                        <p className="truncate text-xs text-slate-400 dark:text-slate-500">{item.description}</p>
                      )}
                    </div>
                    <span className="flex-shrink-0 text-[11px] font-medium uppercase tracking-wider text-slate-300 dark:text-slate-600">
                      {item.group}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
