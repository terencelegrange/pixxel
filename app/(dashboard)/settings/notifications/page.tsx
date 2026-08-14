"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Check, MessageSquare, FileText } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${checked ? "bg-brand-600" : "bg-slate-200 dark:bg-slate-700"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

export default function NotificationsSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";

  const [notifyNewFeedback, setNotifyNewFeedback] = useState(true);
  const [notifyContractsExpiring, setNotifyContractsExpiring] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/profile/preferences");
        const data = await res.json();
        setNotifyNewFeedback(data.notifyNewFeedback ?? true);
        setNotifyContractsExpiring(data.notifyContractsExpiring ?? true);
      } catch {
        // Non-fatal — toggles default to on.
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const res = await fetch("/api/profile/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyNewFeedback, notifyContractsExpiring }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save.");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Notifications</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Choose what shows up in your notification bell.
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-700">
          {!isAdmin && (
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              These events are currently only shown to Admin accounts. Your preference will be saved and take effect if your role changes.
            </div>
          )}

          <div className="divide-y divide-slate-100 px-6 dark:divide-slate-800">
            <div className="flex items-center justify-between py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30">
                  <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">New feedback submissions</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Notify me when a user submits new feedback.</p>
                </div>
              </div>
              <Toggle checked={notifyNewFeedback} onChange={setNotifyNewFeedback} />
            </div>

            <div className="flex items-center justify-between py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30">
                  <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Contracts expiring soon</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Notify me about contracts expiring within 90 days.</p>
                </div>
              </div>
              <Toggle checked={notifyContractsExpiring} onChange={setNotifyContractsExpiring} />
            </div>
          </div>

          {error && <p className="px-6 pb-2 text-sm text-red-500">{error}</p>}

          <div className="flex items-center gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
            <Button type="submit" isLoading={isSaving}>
              {saved ? <Check className="h-4 w-4" /> : null}
              {saved ? "Saved!" : "Save preferences"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
