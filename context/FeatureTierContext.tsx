"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface FeatureTierContextValue {
  tierId: string | null;
  tierName: string | null;
  isLoading: boolean;
  hasFeature: (key: string) => boolean;
  refresh: () => Promise<void>;
}

const FeatureTierContext = createContext<FeatureTierContextValue>({
  tierId: null,
  tierName: null,
  isLoading: true,
  hasFeature: () => false,
  refresh: async () => {},
});

export function FeatureTierProvider({ children }: { children: React.ReactNode }) {
  const [tierId, setTierId] = useState<string | null>(null);
  const [tierName, setTierName] = useState<string | null>(null);
  // Default to an empty set until loaded, so gated nav items don't flash on then off.
  const [features, setFeatures] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/feature-tier/active");
      const data = await res.json();
      if (res.ok) {
        setTierId(data.tierId ?? null);
        setTierName(data.tierName ?? null);
        setFeatures(new Set<string>(data.features ?? []));
      }
    } catch {
      // Fail closed — gated features stay hidden if the lookup fails.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  function hasFeature(key: string) {
    return features.has(key);
  }

  return (
    <FeatureTierContext.Provider value={{ tierId, tierName, isLoading, hasFeature, refresh }}>
      {children}
    </FeatureTierContext.Provider>
  );
}

export function useFeatureTier() {
  return useContext(FeatureTierContext);
}
