"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Eye, EyeOff, Send } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { MASKED_VALUE } from "@/lib/secretSettings";

type Provider = "none" | "custom";
type MinLevel = "debug" | "info" | "warn" | "error";

interface ObservabilitySettings {
  enabled: boolean;
  provider: Provider;
  collectorUrl: string;
  authType: "bearer";
  /** Only ever holds a NEW value the admin typed — never the saved secret. */
  apiKeyInput: string;
  minLevel: MinLevel;
}

const EMPTY: ObservabilitySettings = {
  enabled: false,
  provider: "none",
  collectorUrl: "",
  authType: "bearer",
  apiKeyInput: "",
  minLevel: "warn",
};

export default function ObservabilityPage() {
  const [settings, setSettings] = useState<ObservabilitySettings>(EMPTY);
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

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
          enabled: s["observability.enabled"] === "true",
          provider: (s["observability.provider"] as Provider) || "none",
          collectorUrl: s["observability.collector_url"] ?? "",
          authType: "bearer",
          apiKeyInput: "",
          minLevel: (s["observability.min_level"] as MinLevel) || "warn",
        });
        setHasSavedKey(s["observability.api_key"] === MASKED_VALUE);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load settings.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadSettings();
    return () => { cancelled = true; };
  }, []);

  // What to actually send for the secret field: a new value if the admin
  // typed one, otherwise the sentinel (server keeps the existing key) or an
  // empty string if there was never a key saved.
  function resolveApiKeyForSubmit(): string {
    if (settings.apiKeyInput) return settings.apiKeyInput;
    return hasSavedKey ? MASKED_VALUE : "";
  }

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
            "observability.enabled": String(settings.enabled),
            "observability.provider": settings.provider,
            "observability.collector_url": settings.collectorUrl,
            "observability.auth_type": settings.authType,
            "observability.api_key": resolveApiKeyForSubmit(),
            "observability.min_level": settings.minLevel,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      if (settings.apiKeyInput) {
        setHasSavedKey(true);
        setSettings((s) => ({ ...s, apiKeyInput: "" }));
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest() {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/observability/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectorUrl: settings.collectorUrl, apiKey: resolveApiKeyForSubmit() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test failed.");
      setTestResult({ ok: true, message: "Test log sent successfully." });
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : "Test failed." });
    } finally {
      setIsTesting(false);
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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Observability</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Forward application logs to an external log collector.
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Log Forwarding</h2>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Enabled
              </label>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 px-5">
              <div className="py-4 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Provider</label>
                <select
                  value={settings.provider}
                  onChange={(e) => setSettings((s) => ({ ...s, provider: e.target.value as Provider }))}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                >
                  <option value="none">None</option>
                  <option value="custom">Custom Log Collector</option>
                  <option value="datadog" disabled>Datadog (coming soon)</option>
                  <option value="newrelic" disabled>New Relic (coming soon)</option>
                  <option value="splunk" disabled>Splunk (coming soon)</option>
                </select>
              </div>

              {settings.provider === "custom" && (
                <>
                  <div className="py-4 flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Collector URL</label>
                    <Input
                      type="url"
                      value={settings.collectorUrl}
                      onChange={(e) => setSettings((s) => ({ ...s, collectorUrl: e.target.value }))}
                      placeholder="http://192.168.100.227:8010/ingest"
                    />
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      The full ingest endpoint URL, including path.
                    </p>
                  </div>

                  <div className="py-4 flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Authentication</label>
                    <select
                      value={settings.authType}
                      disabled
                      className="h-9 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-600 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300"
                    >
                      <option value="bearer">Bearer Token</option>
                    </select>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Sent as an <code>Authorization: Bearer &lt;token&gt;</code> header. More auth types will appear here as providers are added.
                    </p>
                  </div>

                  <div className="py-4 flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bearer Token</label>
                    <div className="relative">
                      <Input
                        type={showKey ? "text" : "password"}
                        value={settings.apiKeyInput}
                        onChange={(e) => setSettings((s) => ({ ...s, apiKeyInput: e.target.value }))}
                        placeholder={hasSavedKey ? "•••••••• (unchanged — type to replace)" : "Paste the token issued by the collector"}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        tabIndex={-1}
                      >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Generated on the collector via <code>create_key.py pixxel</code>. Never displayed again after saving — leave untouched to keep the current token.
                    </p>
                  </div>

                  <div className="py-4 flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Minimum level to forward</label>
                    <select
                      value={settings.minLevel}
                      onChange={(e) => setSettings((s) => ({ ...s, minLevel: e.target.value as MinLevel }))}
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                    >
                      <option value="debug">Debug (everything)</option>
                      <option value="info">Info and above</option>
                      <option value="warn">Warning and above</option>
                      <option value="error">Errors only</option>
                    </select>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      The collector has no built-in rate limiting — keep this at &ldquo;Warning and above&rdquo; unless you specifically need lower-level logs.
                    </p>
                  </div>

                  <div className="py-4 flex flex-col gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={handleTest} isLoading={isTesting} className="self-start">
                      <Send className="h-4 w-4" /> Send test log
                    </Button>
                    {testResult && (
                      <p className={`text-sm ${testResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                        {testResult.message}
                      </p>
                    )}
                  </div>
                </>
              )}
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
