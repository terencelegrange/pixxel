"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "pixel_getstarted_hidden";

export interface GetStartedStep {
  key: string;
  label: string;
  description: string;
  href: string;
  count: number;
  done: boolean;
}

interface GetStartedContextValue {
  steps: GetStartedStep[];
  doneCount: number;
  allComplete: boolean;
  hidden: boolean;
  hide: () => void;
  refresh: () => void;
}

const GetStartedContext = createContext<GetStartedContextValue>({
  steps: [],
  doneCount: 0,
  allComplete: false,
  hidden: false,
  hide: () => {},
  refresh: () => {},
});

const STEP_META: Omit<GetStartedStep, "count" | "done">[] = [
  {
    key: "departments",
    label: "Departments",
    description: "Group assets by the business units or teams that own them.",
    href: "/organisations",
  },
  {
    key: "domains",
    label: "Domains",
    description: "Classify assets by technology domain such as Application Architecture or Infrastructure.",
    href: "/domains",
  },
  {
    key: "strategies",
    label: "Asset Strategy",
    description: "Define strategic dispositions such as Adopt, Scale, Replace, or Retire.",
    href: "/asset-strategy",
  },
  {
    key: "tiers",
    label: "Tiers",
    description: "Set criticality tiers to capture SLA expectations and support obligations.",
    href: "/tiers",
  },
  {
    key: "vendors",
    label: "Vendors",
    description: "Register the vendors and suppliers your assets depend on.",
    href: "/vendors",
  },
];

export function GetStartedProvider({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/get-started");
      if (!res.ok) return;
      const data = await res.json();
      setCounts(data);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const steps: GetStartedStep[] = STEP_META.map((meta) => ({
    ...meta,
    count: counts[meta.key] ?? 0,
    done: (counts[meta.key] ?? 0) > 0,
  }));

  const doneCount = steps.filter((s) => s.done).length;
  const allComplete = doneCount === steps.length;

  const hide = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setHidden(true);
  }, []);

  return (
    <GetStartedContext.Provider value={{ steps, doneCount, allComplete, hidden, hide, refresh }}>
      {children}
    </GetStartedContext.Provider>
  );
}

export function useGetStarted() {
  return useContext(GetStartedContext);
}
