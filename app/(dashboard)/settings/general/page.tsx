"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Upload, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useBranding } from "@/context/BrandingContext";
import { useTour } from "@/context/TourContext";
import { navigationConfig } from "@/config/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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

const ALL_NAV_ITEMS = navigationConfig.flatMap((g) => g.items);

const MAX_LOGO_BYTES = 200 * 1024; // 200KB — stored inline as a data URI, not a file upload

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ja", label: "Japanese" },
];

function getTimezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Australia/Sydney", "Asia/Tokyo"];
  }
}

export default function GeneralSettingsPage() {
  const { user } = useAuth();
  const { refreshBranding } = useBranding();
  const { startTour } = useTour();
  const isAdmin = user?.role === "Admin";

  // Branding (admin only)
  const [companyName, setCompanyName] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [brandingError, setBrandingError] = useState("");
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preferences (everyone)
  const [timezone, setTimezone] = useState("");
  const [language, setLanguage] = useState("en");
  const [tourEnabled, setTourEnabled] = useState(true);
  const [prefsError, setPrefsError] = useState("");
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [replaySent, setReplaySent] = useState(false);

  // Onboarding tour steps (admin only) — href -> 1-based order, only for
  // included items. Populated from GET /api/tour, which already returns the
  // admin's currently-configured steps in order.
  const [tourStepOrder, setTourStepOrder] = useState<Record<string, string>>({});
  const [tourStepsError, setTourStepsError] = useState("");
  const [isSavingTourSteps, setIsSavingTourSteps] = useState(false);
  const [tourStepsSaved, setTourStepsSaved] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const timezones = useState(getTimezones)[0];

  useEffect(() => {
    async function load() {
      try {
        const requests: Promise<Response>[] = [fetch("/api/profile/preferences"), fetch("/api/tour")];
        if (isAdmin) requests.push(fetch("/api/settings"));
        const [prefsRes, tourRes, settingsRes] = await Promise.all(requests);

        const prefs = await prefsRes.json();
        setTimezone(prefs.timezone ?? "");
        setLanguage(prefs.language ?? "en");
        setTourEnabled(prefs.tourEnabled ?? true);

        const tourData = await tourRes.json();
        const order: Record<string, string> = {};
        (tourData.steps ?? []).forEach((s: { href: string }, i: number) => { order[s.href] = String(i + 1); });
        setTourStepOrder(order);

        if (settingsRes) {
          const data = await settingsRes.json();
          setCompanyName(data.settings?.["branding.company_name"] ?? "");
          setLogoDataUrl(data.settings?.["branding.logo_data_url"] || null);
        }
      } catch {
        // Non-fatal — form just starts empty.
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [isAdmin]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setBrandingError(`Logo must be under ${Math.round(MAX_LOGO_BYTES / 1024)}KB.`);
      return;
    }
    setBrandingError("");
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSaveBranding(e: FormEvent) {
    e.preventDefault();
    setBrandingError("");
    setIsSavingBranding(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            "branding.company_name": companyName.trim(),
            "branding.logo_data_url": logoDataUrl ?? "",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save.");
      refreshBranding();
      setBrandingSaved(true);
      setTimeout(() => setBrandingSaved(false), 3000);
    } catch (err) {
      setBrandingError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setIsSavingBranding(false);
    }
  }

  async function handleSavePrefs(e: FormEvent) {
    e.preventDefault();
    setPrefsError("");
    setIsSavingPrefs(true);
    try {
      const res = await fetch("/api/profile/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: timezone || null, language, tourEnabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save.");
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 3000);
    } catch (err) {
      setPrefsError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setIsSavingPrefs(false);
    }
  }

  async function handleReplayTour() {
    // Clear tour_seen_at server-side (so a refresh doesn't re-trust a stale
    // "already seen" value) and start it immediately.
    await fetch("/api/profile/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tourSeen: false }),
    }).catch(() => {});
    startTour();
    setReplaySent(true);
    setTimeout(() => setReplaySent(false), 3000);
  }

  async function handleSaveTourSteps(e: FormEvent) {
    e.preventDefault();
    setTourStepsError("");
    setIsSavingTourSteps(true);
    try {
      const hrefs = Object.entries(tourStepOrder)
        .filter(([, order]) => order.trim() !== "")
        .sort(([, a], [, b]) => Number(a) - Number(b))
        .map(([href]) => href);

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { "tour.steps": JSON.stringify(hrefs) } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save.");
      setTourStepsSaved(true);
      setTimeout(() => setTourStepsSaved(false), 3000);
    } catch (err) {
      setTourStepsError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setIsSavingTourSteps(false);
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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">General</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Account name, branding, timezone, and language.
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <>
          {isAdmin && (
            <form onSubmit={handleSaveBranding} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-700">
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Branding</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Shown across the app in place of the default Pixxel name and mark. Visible to everyone.
              </p>

              <div className="mt-4 flex flex-col gap-4">
                <Input
                  label="Company / account name"
                  type="text"
                  placeholder="Pixxel"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                      {logoDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoDataUrl} alt="" className="h-full w-full rounded-lg object-contain" />
                      ) : (
                        <Upload className="h-5 w-5 text-slate-300 dark:text-slate-600" />
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                    <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                      Upload logo
                    </Button>
                    {logoDataUrl && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setLogoDataUrl(null)}>
                        <X className="h-4 w-4" /> Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    PNG, JPEG, SVG, or WebP. Up to {Math.round(MAX_LOGO_BYTES / 1024)}KB.
                  </p>
                </div>
              </div>

              {brandingError && <p className="mt-4 text-sm text-red-500">{brandingError}</p>}

              <div className="mt-6 flex items-center gap-3">
                <Button type="submit" isLoading={isSavingBranding}>
                  {brandingSaved ? <Check className="h-4 w-4" /> : null}
                  {brandingSaved ? "Saved!" : "Save branding"}
                </Button>
              </div>
            </form>
          )}

          <form onSubmit={handleSavePrefs} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-700">
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">Preferences</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Your personal timezone and language. These don&apos;t affect anything yet — support for them is coming.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                >
                  <option value="">System default</option>
                  {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                >
                  {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Onboarding tour</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Guided walkthrough of the sidebar on first use.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" variant="ghost" size="sm" onClick={handleReplayTour}>
                  {replaySent ? "Started!" : "Replay tour"}
                </Button>
                <Toggle checked={tourEnabled} onChange={setTourEnabled} />
              </div>
            </div>

            {prefsError && <p className="mt-4 text-sm text-red-500">{prefsError}</p>}

            <div className="mt-6 flex items-center gap-3">
              <Button type="submit" isLoading={isSavingPrefs}>
                {prefsSaved ? <Check className="h-4 w-4" /> : null}
                {prefsSaved ? "Saved!" : "Save preferences"}
              </Button>
            </div>
          </form>

          {isAdmin && (
            <form onSubmit={handleSaveTourSteps} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-700">
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Onboarding tour steps</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Choose which sidebar items the onboarding tour walks a new user through, and in what order.
                A viewer only sees steps for items they actually have access to.
              </p>

              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {ALL_NAV_ITEMS.map((item) => {
                  const included = item.href in tourStepOrder;
                  return (
                    <div key={item.href} className="flex items-center gap-3 py-2">
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={(e) => {
                          setTourStepOrder((prev) => {
                            const next = { ...prev };
                            if (e.target.checked) {
                              next[item.href] = String(Object.keys(prev).length + 1);
                            } else {
                              delete next[item.href];
                            }
                            return next;
                          });
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{item.label}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{item.href}</span>
                      <input
                        type="number"
                        min={1}
                        disabled={!included}
                        value={tourStepOrder[item.href] ?? ""}
                        onChange={(e) => setTourStepOrder((prev) => ({ ...prev, [item.href]: e.target.value }))}
                        className="h-8 w-16 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                      />
                    </div>
                  );
                })}
              </div>

              {tourStepsError && <p className="mt-4 text-sm text-red-500">{tourStepsError}</p>}

              <div className="mt-6 flex items-center gap-3">
                <Button type="submit" isLoading={isSavingTourSteps}>
                  {tourStepsSaved ? <Check className="h-4 w-4" /> : null}
                  {tourStepsSaved ? "Saved!" : "Save tour steps"}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
