"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Bell, Menu, Moon, Search, Sun, UserCircle, LogOut, MessageSquare, FileText } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

interface HeaderProps {
  onMenuToggle: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "Admin";
  const { theme, toggleTheme } = useTheme();

  // Avatar dropdown
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Notifications dropdown
  const [notifOpen, setNotifOpen] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close both dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Poll for new feedback count (admin only)
  const fetchNewCount = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/support");
      if (!res.ok) return;
      const data = await res.json();
      const count = (data.requests as { status: string }[]).filter((r) => r.status === "New").length;
      setNewCount(count);
    } catch {
      // silently ignore
    }
  }, [isAdmin]);

  // Poll for expiring contracts count (admin only)
  const fetchExpiringCount = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/contracts/expiring-count");
      if (!res.ok) return;
      const data = await res.json();
      setExpiringCount(data.count ?? 0);
    } catch {
      // silently ignore
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchNewCount();
    fetchExpiringCount();
    const interval = setInterval(() => {
      fetchNewCount();
      fetchExpiringCount();
    }, 60_000); // refresh every minute
    return () => clearInterval(interval);
  }, [fetchNewCount, fetchExpiringCount]);

  const totalNotifications = newCount + expiringCount;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
      {/* Mobile menu button */}
      <button
        onClick={onMenuToggle}
        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Logo / Brand (visible on mobile) */}
      <span className="text-base font-semibold text-slate-900 lg:hidden dark:text-slate-100">
        Pixxel
      </span>

      {/* Search bar */}
      <div className="hidden flex-1 sm:flex">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications — admin only */}
        {isAdmin && (
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setNotifOpen((o) => !o)}
              className="relative rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {totalNotifications > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                  {totalNotifications > 9 ? "9+" : totalNotifications}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-slate-200 bg-white shadow-lg z-50 dark:bg-slate-900 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Notifications</p>
                  {totalNotifications > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                      {totalNotifications} new
                    </span>
                  )}
                </div>

                {totalNotifications === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-8 text-slate-400">
                    <Bell className="h-8 w-8 text-slate-200 dark:text-slate-700" />
                    <p className="text-sm">No new notifications</p>
                  </div>
                ) : (
                  <>
                    {newCount > 0 && (
                      <div className="px-4 py-4 flex items-start gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30">
                          <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {newCount} new feedback submission{newCount !== 1 ? "s" : ""}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            Awaiting review in Settings → Feedback
                          </p>
                        </div>
                      </div>
                    )}
                    {expiringCount > 0 && (
                      <div className="px-4 py-4 flex items-start gap-3 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30">
                          <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {expiringCount} contract{expiringCount !== 1 ? "s" : ""} expiring soon
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            <Link
                              href="/contracts?expiring=90"
                              onClick={() => setNotifOpen(false)}
                              className="hover:underline"
                            >
                              View expiring contracts
                            </Link>
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="border-t border-slate-100 dark:border-slate-800">
                  <Link
                    href="/settings/feedback"
                    onClick={() => setNotifOpen(false)}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-brand-600 hover:bg-slate-50 transition-colors dark:text-brand-400 dark:hover:bg-slate-800"
                  >
                    View all feedback
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Toggle theme"
        >
          {theme === "dark"
            ? <Sun className="h-5 w-5" />
            : <Moon className="h-5 w-5" />
          }
        </button>

        {/* Avatar + dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-slate-50 transition-colors dark:hover:bg-slate-800"
            aria-label="Open user menu"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
              {user?.avatarInitials ?? "??"}
            </div>
            <div className="hidden flex-col sm:flex">
              <span className="text-sm font-medium text-slate-800 leading-tight dark:text-slate-200">
                {user?.name ?? "Guest"}
              </span>
              <span className="text-xs text-slate-400 leading-tight dark:text-slate-500">
                {user?.role ?? ""}
              </span>
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-slate-200 bg-white shadow-lg py-1 z-50 dark:bg-slate-900 dark:border-slate-700">
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-800 truncate dark:text-slate-200">{user?.name}</p>
                <p className="text-xs text-slate-400 truncate dark:text-slate-500">{user?.email ?? user?.role}</p>
              </div>
              <Link
                href="/profile"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <UserCircle className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                Profile
              </Link>
              <button
                onClick={() => { setDropdownOpen(false); logout(); }}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              >
                <LogOut className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
