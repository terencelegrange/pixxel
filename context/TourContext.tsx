"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Joyride, EVENTS, type Step, type EventData } from "react-joyride";
import { useAuth } from "@/context/AuthContext";
import { useFeatureTier } from "@/context/FeatureTierContext";

interface TourStep {
  href: string;
  label: string;
  icon: string;
  featureKey: string | null;
}

interface TourContextValue {
  /** Re-run the tour on demand (Settings → General's "Replay tour" button). */
  startTour: () => void;
}

const TourContext = createContext<TourContextValue>({ startTour: () => {} });

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { hasFeature } = useFeatureTier();
  const [allSteps, setAllSteps] = useState<TourStep[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        const [tourRes, prefsRes] = await Promise.all([
          fetch("/api/tour"),
          fetch("/api/profile/preferences"),
        ]);
        const tourData = await tourRes.json();
        const prefs = await prefsRes.json();
        const steps: TourStep[] = tourData.steps ?? [];
        setAllSteps(steps);
        setLoaded(true);
        // Auto-start: enabled, never seen, and the admin has actually
        // configured at least one step.
        if (prefs.tourEnabled && !prefs.tourSeenAt && steps.length > 0) {
          setRun(true);
        }
      } catch {
        // Tour is a non-critical UX enhancement — a failed fetch just means
        // no tour this session, not a broken app.
      }
    })();
  }, [isAuthenticated]);

  // Feature-tier filtering only — nav items have no role-based visibility
  // today (confirmed against Sidebar.tsx, which does the same single check).
  const filteredSteps: Step[] = allSteps
    .filter((s) => !s.featureKey || hasFeature(s.featureKey))
    .map((s) => ({
      target: `[data-tour="${s.href}"]`,
      title: s.label,
      content: `This is ${s.label}.`,
    }));

  const markSeen = useCallback((seen: boolean) => {
    fetch("/api/profile/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tourSeen: seen }),
    }).catch(() => {});
  }, []);

  const startTour = useCallback(() => {
    setRun(true);
  }, []);

  function handleEvent(data: EventData) {
    if (data.type === EVENTS.TOUR_END) {
      setRun(false);
      markSeen(true);
    }
  }

  return (
    <TourContext.Provider value={{ startTour }}>
      {children}
      {loaded && filteredSteps.length > 0 && (
        <Joyride
          steps={filteredSteps}
          run={run}
          continuous
          onEvent={handleEvent}
          // Default closeButtonAction ("close") just advances past the
          // current step without ending the tour (status stays RUNNING, so
          // TOUR_END never fires and tour_seen_at never gets set) -- "skip"
          // treats the X the same as the Skip button, which does end the
          // tour with a terminal status.
          options={{ closeButtonAction: "skip" }}
        />
      )}
    </TourContext.Provider>
  );
}

export function useTour(): TourContextValue {
  return useContext(TourContext);
}
