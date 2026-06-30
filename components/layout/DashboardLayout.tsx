"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { GetStartedProvider } from "@/context/GetStartedContext";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <GetStartedProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex flex-1 flex-col overflow-hidden">
          <Header onMenuToggle={() => setSidebarOpen((o) => !o)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
          <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              &copy; {new Date().getFullYear()} Pixxel &mdash; Released under the{" "}
              <a
                href="https://github.com/terencelegrange/pixxel/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-slate-600 dark:hover:text-slate-300"
              >
                MIT License
              </a>
              {" "}&middot;{" "}
              <a
                href="https://github.com/terencelegrange/pixxel"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-slate-600 dark:hover:text-slate-300"
              >
                GitHub
              </a>
              {" "}&middot;{" "}
              <a
                href="https://github.com/terencelegrange/pixxel/wiki"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-slate-600 dark:hover:text-slate-300"
              >
                Wiki
              </a>
            </p>
          </footer>
        </div>
      </div>
    </GetStartedProvider>
  );
}
