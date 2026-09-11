"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Check, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { MASKED_VALUE } from "@/lib/secretSettings";

interface ConfluenceSettings {
  base_url: string;
  user_email: string;
  /** Only ever holds a NEW token the admin typed — never the saved secret. */
  api_token_input: string;
  space_key: string;
}

export default function IntegrationsPage() {
  const [settings, setSettings] = useState<ConfluenceSettings>({
    base_url: "",
    user_email: "",
    api_token_input: "",
    space_key: "",
  });
  const [hasSavedToken, setHasSavedToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    // Guard against a stale response clobbering newer state — e.g. React
    // Strict Mode's dev-time double effect invocation fires this fetch
    // twice; without this, whichever resolves last wins even if the admin
    // already started editing the form in between.
    let cancelled = false;
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error("Failed to load settings.");
        const data = await res.json();
        if (cancelled) return;
        const s = data.settings ?? {};
        setSettings({
          base_url: s["confluence.base_url"] ?? "",
          user_email: s["confluence.user_email"] ?? "",
          api_token_input: "",
          space_key: s["confluence.space_key"] ?? "",
        });
        setHasSavedToken(s["confluence.api_token"] === MASKED_VALUE);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load settings.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadSettings();
    return () => { cancelled = true; };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            "confluence.base_url": settings.base_url,
            "confluence.user_email": settings.user_email,
            "confluence.api_token": settings.api_token_input || (hasSavedToken ? MASKED_VALUE : ""),
            "confluence.space_key": settings.space_key,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      if (settings.api_token_input) {
        setHasSavedToken(true);
        setSettings((s) => ({ ...s, api_token_input: "" }));
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back link */}
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Integrations</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Connect third-party services and manage API keys.
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          {/* Confluence card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-5 py-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Confluence</h2>
                <span className="rounded-full bg-sky-100 dark:bg-sky-900/30 px-2 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-400">
                  Atlassian
                </span>
              </div>
              <a
                href="https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              >
                API token docs <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 px-5">
              <div className="py-4 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Base URL
                </label>
                <Input
                  type="url"
                  value={settings.base_url}
                  onChange={(e) => setSettings((s) => ({ ...s, base_url: e.target.value }))}
                  placeholder="https://mycompany.atlassian.net"
                />
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Your Confluence cloud base URL, without a trailing slash.
                </p>
              </div>

              <div className="py-4 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  User Email
                </label>
                <Input
                  type="email"
                  value={settings.user_email}
                  onChange={(e) => setSettings((s) => ({ ...s, user_email: e.target.value }))}
                  placeholder="you@company.com"
                />
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  The Atlassian account email used for Basic authentication.
                </p>
              </div>

              <div className="py-4 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  API Token
                </label>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    value={settings.api_token_input}
                    onChange={(e) => setSettings((s) => ({ ...s, api_token_input: e.target.value }))}
                    placeholder={hasSavedToken ? "•••••••• (unchanged — type to replace)" : "Your Atlassian API token"}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    tabIndex={-1}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Generate an API token from your Atlassian account security settings.
                </p>
              </div>

              <div className="py-4 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Space Key
                </label>
                <Input
                  value={settings.space_key}
                  onChange={(e) => setSettings((s) => ({ ...s, space_key: e.target.value }))}
                  placeholder="e.g. EA or ARCH"
                />
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  The key of the Confluence space where pages will be created.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" isLoading={isSaving}>
              {saveSuccess ? <Check className="h-4 w-4" /> : null}
              {saveSuccess ? "Saved!" : "Save Settings"}
            </Button>
            {saveSuccess && (
              <span className="text-sm text-emerald-600 dark:text-emerald-400">
                Settings saved successfully.
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
