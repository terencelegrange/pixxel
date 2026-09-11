"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ShieldCheck, ShieldOff, Copy, Check, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

type Step = "loading" | "disabled" | "enabled" | "setup" | "recovery-codes";

export default function SecurityPage() {
  const [step, setStep] = useState<Step>("loading");
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [setupError, setSetupError] = useState("");
  const [isStartingSetup, setIsStartingSetup] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableError, setDisableError] = useState("");
  const [isDisabling, setIsDisabling] = useState(false);

  async function fetchStatus() {
    setFetchError(null);
    try {
      const res = await fetch("/api/auth/mfa/status");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load MFA status.");
      setStep(data.enabled ? "enabled" : "disabled");
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load MFA status.");
    }
  }

  useEffect(() => { fetchStatus(); }, []);

  async function handleStartSetup() {
    setIsStartingSetup(true);
    setSetupError("");
    try {
      const res = await fetch("/api/auth/mfa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start setup.");
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setSecret(data.secret);
      setCode("");
      setStep("setup");
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Failed to start setup.");
    } finally {
      setIsStartingSetup(false);
    }
  }

  async function handleVerifySetup(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) { setSetupError("Enter the 6-digit code from your authenticator app."); return; }
    setSetupError("");
    setIsVerifying(true);
    try {
      const res = await fetch("/api/auth/mfa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed.");
      setRecoveryCodes(data.recoveryCodes);
      setStep("recovery-codes");
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setIsVerifying(false);
    }
  }

  function handleCopyRecoveryCodes() {
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadRecoveryCodes() {
    const blob = new Blob([recoveryCodes.join("\n") + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pixxel-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDisable(e: FormEvent) {
    e.preventDefault();
    if (!disablePassword) { setDisableError("Password is required."); return; }
    setDisableError("");
    setIsDisabling(true);
    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to disable MFA.");
      setDisableModalOpen(false);
      setDisablePassword("");
      setStep("disabled");
    } catch (err) {
      setDisableError(err instanceof Error ? err.message : "Failed to disable MFA.");
    } finally {
      setIsDisabling(false);
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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Security</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage two-factor authentication for your account.
        </p>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
          {fetchError}
        </div>
      )}

      {step === "loading" && !fetchError && (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      )}

      {step === "disabled" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-700">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <ShieldOff className="h-5 w-5 text-slate-500" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Two-factor authentication is off</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Add an extra layer of security by requiring a code from an authenticator app (Google Authenticator, Authy, 1Password, etc.) when signing in.
              </p>
              {setupError && <p className="mt-3 text-sm text-red-500">{setupError}</p>}
              <Button className="mt-4" onClick={handleStartSetup} isLoading={isStartingSetup}>
                Enable Two-Factor Authentication
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === "setup" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">Scan the QR code</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Scan this with your authenticator app, or enter the code manually.
          </p>

          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {qrCodeDataUrl && (
              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700">
                <Image src={qrCodeDataUrl} alt="MFA QR code" width={180} height={180} unoptimized />
              </div>
            )}
            <div className="flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Manual entry code</p>
              <p className="mt-1 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {secret}
              </p>
            </div>
          </div>

          <form onSubmit={handleVerifySetup} className="mt-6 flex flex-col gap-4">
            {setupError && <p className="text-sm text-red-500">{setupError}</p>}
            <Input
              label="6-digit code"
              type="text"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setStep("disabled")}>Cancel</Button>
              <Button type="submit" isLoading={isVerifying}>Verify &amp; Enable</Button>
            </div>
          </form>
        </div>
      )}

      {step === "recovery-codes" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Save your recovery codes</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Each code can be used once to sign in if you lose access to your authenticator app. They won&apos;t be shown again.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-4 font-mono text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {recoveryCodes.map((c) => <div key={c}>{c}</div>)}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="secondary" size="sm" onClick={handleCopyRecoveryCodes}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy codes"}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDownloadRecoveryCodes}>
              <Download className="h-4 w-4" /> Download .txt
            </Button>
          </div>

          <Button className="mt-6" onClick={() => setStep("enabled")}>
            I&apos;ve saved these codes
          </Button>
        </div>
      )}

      {step === "enabled" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-700">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Two-factor authentication is on</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                You&apos;ll be asked for a code from your authenticator app each time you sign in.
              </p>
              <Button
                className="mt-4"
                variant="danger"
                onClick={() => { setDisableModalOpen(true); setDisableError(""); setDisablePassword(""); }}
              >
                Disable Two-Factor Authentication
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={disableModalOpen} onClose={() => setDisableModalOpen(false)} title="Disable Two-Factor Authentication" maxWidth="max-w-md">
        <form onSubmit={handleDisable} className="flex flex-col gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Enter your password to confirm. Your recovery codes will be invalidated.
          </p>
          {disableError && <p className="text-sm text-red-500">{disableError}</p>}
          <Input
            label="Password"
            type="password"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            autoFocus
            showToggle
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setDisableModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="danger" isLoading={isDisabling}>Disable</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
