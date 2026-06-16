"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function RootPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    async function redirect() {
      // Check setup before auth — no point hitting the login page
      // if the application hasn't been configured yet.
      const res = await fetch("/api/setup/status");
      const { complete } = await res.json();

      if (!complete) {
        router.replace("/setup");
        return;
      }

      router.replace(isAuthenticated ? "/dashboard" : "/login");
    }

    redirect();
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
    </div>
  );
}
