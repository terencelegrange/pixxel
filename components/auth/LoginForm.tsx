"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { LogIn, ShieldCheck, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

function validate(email: string, password: string): FormErrors {
  const errors: FormErrors = {};
  if (!email) errors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Password is required.";
  else if (password.length < 6)
    errors.password = "Password must be at least 6 characters.";
  return errors;
}

// ---------------------------------------------------------------------------
// Step 2 — MFA code entry
// ---------------------------------------------------------------------------
function MfaStep({ mfaToken, onBack }: { mfaToken: string; onBack: () => void }) {
  const { completeMfaLogin } = useAuth();
  const [useRecovery, setUseRecovery] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) { setError(useRecovery ? "Recovery code is required." : "Code is required."); return; }
    setError("");
    setIsLoading(true);
    try {
      await completeMfaLogin(mfaToken, useRecovery ? { recoveryCode: value.trim() } : { code: value.trim() });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50">
          <ShieldCheck className="h-5 w-5 text-brand-600" />
        </div>
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Two-factor authentication</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {useRecovery
            ? "Enter one of your one-time recovery codes."
            : "Enter the 6-digit code from your authenticator app."}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </div>
      )}

      <Input
        label={useRecovery ? "Recovery code" : "6-digit code"}
        type="text"
        placeholder={useRecovery ? "XXXXX-XXXXX" : "000000"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="one-time-code"
        autoFocus
      />

      <Button type="submit" fullWidth isLoading={isLoading} size="lg">
        <LogIn className="h-4 w-4" />
        Verify
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <button
          type="button"
          onClick={() => { setUseRecovery((v) => !v); setValue(""); setError(""); }}
          className="text-brand-600 hover:underline dark:text-brand-400"
        >
          {useRecovery ? "Use authenticator code instead" : "Use a recovery code instead"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Email + password
// ---------------------------------------------------------------------------
export default function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validate(email, password);
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (result.status === "mfa_required") setMfaToken(result.mfaToken);
    } catch (err: unknown) {
      setErrors({
        general: err instanceof Error ? err.message : "Login failed.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (mfaToken) {
    return <MfaStep mfaToken={mfaToken} onBack={() => setMfaToken(null)} />;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {errors.general && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {errors.general}
        </div>
      )}

      <Input
        label="Email address"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        autoComplete="email"
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Password
          </label>
          <Link href="#" className="text-xs text-brand-600 hover:underline dark:text-brand-400">
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          autoComplete="current-password"
          showToggle
        />
      </div>

      <Button type="submit" fullWidth isLoading={isLoading} size="lg">
        <LogIn className="h-4 w-4" />
        Sign in
      </Button>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Create one free
        </Link>
      </p>

      {/* Demo credentials hint */}
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        Demo: <span className="font-mono">jane@example.com</span> /{" "}
        <span className="font-mono">password123</span>
      </p>
    </form>
  );
}
