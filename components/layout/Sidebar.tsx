"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as LucideIcons from "lucide-react";
import { LucideProps, Rocket, X } from "lucide-react";
import { navigationConfig } from "@/config/navigation";
import { useGetStarted } from "@/context/GetStartedContext";
import { NavItem } from "@/types";

// Dynamically resolve icon by name from lucide-react
function NavIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<LucideProps>>)[name];
  return Icon ? <Icon {...props} /> : <LucideIcons.Circle {...props} />;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;
  const isDisabled = !!item.badge;

  return (
    <Link
      href={isDisabled ? "#" : item.href}
      onClick={isDisabled ? undefined : onClick}
      className={[
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
          : isDisabled
          ? "cursor-not-allowed text-slate-400 dark:text-slate-600"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
      ].join(" ")}
    >
      <NavIcon
        name={item.icon}
        className={[
          "h-4 w-4 flex-shrink-0",
          isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300",
          isDisabled ? "text-slate-300 dark:text-slate-600" : "",
        ].join(" ")}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function GetStartedNavItem({ onClick }: { onClick?: () => void }) {
  const pathname = usePathname();
  const { doneCount, steps, hidden } = useGetStarted();
  if (hidden) return null;

  const remaining = steps.length - doneCount;
  const isActive = pathname === "/get-started";

  return (
    <div className="px-3 pb-2">
      <Link
        href="/get-started"
        onClick={onClick}
        className={[
          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
        ].join(" ")}
      >
        <Rocket className={[
          "h-4 w-4 flex-shrink-0",
          isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300",
        ].join(" ")} />
        <span className="flex-1 truncate">Get Started</span>
        {remaining > 0 ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            {remaining} left
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
            Done
          </span>
        )}
      </Link>
    </div>
  );
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white border-r border-slate-200 transition-transform duration-200 lg:static lg:translate-x-0 lg:z-auto",
          "dark:bg-slate-900 dark:border-slate-800",
          isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Brand */}
        <div className="flex h-14 items-center justify-between gap-2 border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                <rect x="0"  y="0"  width="9" height="9" rx="2" fill="white" fillOpacity="1"/>
                <rect x="11" y="0"  width="9" height="9" rx="2" fill="white" fillOpacity="0.65"/>
                <rect x="0"  y="11" width="9" height="9" rx="2" fill="white" fillOpacity="0.35"/>
                <rect x="11" y="11" width="9" height="9" rx="2" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.4" strokeWidth="1"/>
              </svg>
            </div>
            <span className="text-base font-bold text-slate-900 tracking-tight dark:text-slate-100">
              Pixel
            </span>
          </div>
          {/* Mobile close */}
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <GetStartedNavItem onClick={onClose} />
          {navigationConfig.map((group, groupIdx) => (
            <div key={groupIdx}>
              {group.title && (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {group.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} onClick={onClose} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
