"use client";

import { useEffect } from "react";

interface TocItem {
  id: string;
  label: string;
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function TocNav({ items }: { items: TocItem[] }) {
  // The page content scrolls inside DashboardLayout's <main overflow-y-auto>,
  // not the window, so the browser's native hash-scroll-on-load doesn't reach
  // it — jump to the initial hash (if any) once the content has mounted.
  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (id) scrollToId(id);
  }, []);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    scrollToId(id);
    history.replaceState(null, "", `#${id}`);
  }

  return (
    <nav className="space-y-1">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          onClick={(e) => handleClick(e, item.id)}
          className="block rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors leading-snug dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
