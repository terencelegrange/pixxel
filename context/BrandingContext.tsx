"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

interface BrandingContextValue {
  companyName: string | null;
  logoDataUrl: string | null;
  refreshBranding: () => void;
}

const BrandingContext = createContext<BrandingContextValue>({
  companyName: null,
  logoDataUrl: null,
  refreshBranding: () => {},
});

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const refreshBranding = useCallback(async () => {
    try {
      const res = await fetch("/api/branding");
      if (!res.ok) return;
      const data = await res.json();
      setCompanyName(data.companyName ?? null);
      setLogoDataUrl(data.logoDataUrl ?? null);
    } catch {
      // silently ignore — falls back to the default Pixxel wordmark
    }
  }, []);

  useEffect(() => { refreshBranding(); }, [refreshBranding]);

  return (
    <BrandingContext.Provider value={{ companyName, logoDataUrl, refreshBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
