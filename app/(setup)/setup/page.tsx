"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DbForm {
  host: string;
  port: string;
  user: string;
  password: string;
  name: string;
}

interface AppForm {
  appName: string;
  orgName: string;
}

interface AdminForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type Step = 1 | 2 | 3 | 4;

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------
const STEPS = [
  { number: 1, label: "Database" },
  { number: 2, label: "Application" },
  { number: 3, label: "Admin Account" },
  { number: 4, label: "Review" },
];

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-0">
      {STEPS.map((step, i) => {
        const done = step.number < current;
        const active = step.number === current;
        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  done
                    ? "bg-brand-600 text-white"
                    : active
                    ? "border-2 border-brand-600 bg-white text-brand-600"
                    : "border-2 border-slate-200 bg-white text-slate-400"
                }`}
              >
                {done ? (
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`text-xs ${
                  active ? "font-semibold text-slate-700" : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mb-5 h-px w-12 sm:w-20 ${
                  done ? "bg-brand-600" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared field component
// ---------------------------------------------------------------------------
function Field({
  label,
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  hint,
  error,
  showToggle,
  onToggle,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  showToggle?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
            error ? "border-red-400 focus:ring-red-400" : "border-slate-300"
          } ${showToggle ? "pr-10" : ""}`}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            tabIndex={-1}
          >
            {type === "password" ? (
              // Eye icon
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              // Eye-off icon
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            )}
          </button>
        )}
      </div>
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Database connection
// ---------------------------------------------------------------------------
function StepDatabase({
  form,
  onChange,
  onNext,
}: {
  form: DbForm;
  onChange: (f: Partial<DbForm>) => void;
  onNext: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testError, setTestError] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof DbForm, string>>>({});

  function validate() {
    const e: typeof errors = {};
    if (!form.host.trim()) e.host = "Host is required.";
    if (!form.user.trim()) e.user = "Username is required.";
    if (!form.name.trim()) e.name = "Database name is required.";
    const port = Number(form.port);
    if (form.port && (isNaN(port) || port < 1 || port > 65535))
      e.port = "Port must be between 1 and 65535.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleTest() {
    if (!validate()) return;
    setTestState("testing");
    setTestError("");
    try {
      const res = await fetch("/api/setup/test-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: form.host.trim(),
          port: Number(form.port) || 3306,
          user: form.user.trim(),
          password: form.password,
          name: form.name.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestState("ok");
      } else {
        setTestState("error");
        setTestError(data.error ?? "Connection failed.");
      }
    } catch {
      setTestState("error");
      setTestError("Network error — could not reach the server.");
    }
  }

  function handleNext() {
    if (testState !== "ok") return;
    onNext();
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Database Connection</h2>
      <p className="mb-6 text-sm text-slate-500">
        Enter your MariaDB / MySQL connection details. The application will
        connect to this database and create all required tables automatically.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field
            label="Host"
            id="db-host"
            value={form.host}
            onChange={(v) => { onChange({ host: v }); setTestState("idle"); }}
            placeholder="localhost"
            error={errors.host}
          />
        </div>
        <Field
          label="Port"
          id="db-port"
          value={form.port}
          onChange={(v) => { onChange({ port: v }); setTestState("idle"); }}
          placeholder="3306"
          error={errors.port}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Username"
          id="db-user"
          value={form.user}
          onChange={(v) => { onChange({ user: v }); setTestState("idle"); }}
          placeholder="root"
          error={errors.user}
        />
        <Field
          label="Password"
          id="db-password"
          type={showPassword ? "text" : "password"}
          value={form.password}
          onChange={(v) => { onChange({ password: v }); setTestState("idle"); }}
          placeholder="Leave blank if none"
          showToggle
          onToggle={() => setShowPassword((s) => !s)}
        />
      </div>

      <div className="mt-4">
        <Field
          label="Database Name"
          id="db-name"
          value={form.name}
          onChange={(v) => { onChange({ name: v }); setTestState("idle"); }}
          placeholder="saas_app"
          hint="Will be created if it does not exist."
          error={errors.name}
        />
      </div>

      {/* Test connection feedback */}
      {testState === "ok" && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Connection successful.
        </div>
      )}
      {testState === "error" && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-medium">Connection failed: </span>{testError}
        </div>
      )}

      <div className="mt-6 flex justify-between gap-3">
        <button
          type="button"
          onClick={handleTest}
          disabled={testState === "testing"}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {testState === "testing" && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {testState === "testing" ? "Testing…" : "Test Connection"}
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={testState !== "ok"}
          className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Application details
// ---------------------------------------------------------------------------
function StepApplication({
  form,
  onChange,
  onBack,
  onNext,
}: {
  form: AppForm;
  onChange: (f: Partial<AppForm>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [errors, setErrors] = useState<Partial<Record<keyof AppForm, string>>>({});

  function handleNext() {
    const e: typeof errors = {};
    if (!form.appName.trim()) e.appName = "Application name is required.";
    if (!form.orgName.trim()) e.orgName = "Organisation name is required.";
    setErrors(e);
    if (Object.keys(e).length === 0) onNext();
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Application Details</h2>
      <p className="mb-6 text-sm text-slate-500">
        Give your installation a name. These details are stored in{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">site.config.json</code>{" "}
        and can be changed later.
      </p>

      <div className="flex flex-col gap-4">
        <Field
          label="Application Name"
          id="app-name"
          value={form.appName}
          onChange={(v) => onChange({ appName: v })}
          placeholder="e.g. Pixel"
          hint="Displayed in the header and page titles."
          error={errors.appName}
        />
        <Field
          label="Organisation Name"
          id="org-name"
          value={form.orgName}
          onChange={(v) => onChange({ orgName: v })}
          placeholder="e.g. Acme Corporation"
          hint="Your company or team name."
          error={errors.orgName}
        />
      </div>

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Admin account
// ---------------------------------------------------------------------------
function StepAdmin({
  form,
  onChange,
  onBack,
  onNext,
}: {
  form: AdminForm;
  onChange: (f: Partial<AdminForm>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof AdminForm, string>>>({});

  function handleNext() {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Full name is required.";
    if (!form.email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email address.";
    if (!form.password) e.password = "Password is required.";
    else if (form.password.length < 8) e.password = "Password must be at least 8 characters.";
    if (form.password !== form.confirmPassword)
      e.confirmPassword = "Passwords do not match.";
    setErrors(e);
    if (Object.keys(e).length === 0) onNext();
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Admin Account</h2>
      <p className="mb-6 text-sm text-slate-500">
        Create the first administrator account. You will use these credentials
        to sign in after setup completes.
      </p>

      <div className="flex flex-col gap-4">
        <Field
          label="Full Name"
          id="admin-name"
          value={form.name}
          onChange={(v) => onChange({ name: v })}
          placeholder="Jane Smith"
          error={errors.name}
        />
        <Field
          label="Email Address"
          id="admin-email"
          type="email"
          value={form.email}
          onChange={(v) => onChange({ email: v })}
          placeholder="jane@example.com"
          error={errors.email}
        />
        <Field
          label="Password"
          id="admin-password"
          type={showPassword ? "text" : "password"}
          value={form.password}
          onChange={(v) => onChange({ password: v })}
          hint="Minimum 8 characters."
          error={errors.password}
          showToggle
          onToggle={() => setShowPassword((s) => !s)}
        />
        <Field
          label="Confirm Password"
          id="admin-confirm"
          type={showConfirm ? "text" : "password"}
          value={form.confirmPassword}
          onChange={(v) => onChange({ confirmPassword: v })}
          error={errors.confirmPassword}
          showToggle
          onToggle={() => setShowConfirm((s) => !s)}
        />
      </div>

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Review & complete
// ---------------------------------------------------------------------------
function StepReview({
  db,
  app,
  admin,
  onBack,
  onComplete,
}: {
  db: DbForm;
  app: AppForm;
  admin: AdminForm;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleComplete() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db: {
            host: db.host.trim(),
            port: Number(db.port) || 3306,
            user: db.user.trim(),
            password: db.password,
            name: db.name.trim(),
          },
          appName: app.appName.trim(),
          orgName: app.orgName.trim(),
          admin: {
            name: admin.name.trim(),
            email: admin.email.trim(),
            password: admin.password,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        onComplete();
      } else {
        setError(data.error ?? "Setup failed. Please try again.");
      }
    } catch {
      setError("Network error — could not complete setup.");
    } finally {
      setSubmitting(false);
    }
  }

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex justify-between gap-4 py-2 text-sm">
        <span className="text-slate-500">{label}</span>
        <span className="font-medium text-slate-800">{value}</span>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Review & Complete</h2>
      <p className="mb-6 text-sm text-slate-500">
        Review your configuration before finishing. Click{" "}
        <strong>Complete Setup</strong> to write your configuration and create
        the admin account.
      </p>

      {/* Database section */}
      <div className="mb-4 rounded-lg border border-slate-200 px-4 py-1">
        <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Database
        </p>
        <div className="divide-y divide-slate-100">
          <Row label="Host" value={`${db.host}:${db.port || 3306}`} />
          <Row label="Username" value={db.user} />
          <Row label="Password" value="••••••••" />
          <Row label="Database" value={db.name} />
        </div>
      </div>

      {/* Application section */}
      <div className="mb-4 rounded-lg border border-slate-200 px-4 py-1">
        <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Application
        </p>
        <div className="divide-y divide-slate-100">
          <Row label="App Name" value={app.appName} />
          <Row label="Organisation" value={app.orgName} />
        </div>
      </div>

      {/* Admin section */}
      <div className="mb-6 rounded-lg border border-slate-200 px-4 py-1">
        <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Admin Account
        </p>
        <div className="divide-y divide-slate-100">
          <Row label="Name" value={admin.name} />
          <Row label="Email" value={admin.email} />
          <Row label="Password" value="••••••••" />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleComplete}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {submitting ? "Setting up…" : "Complete Setup"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard page
// ---------------------------------------------------------------------------
export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<Step>(1);

  const [db, setDb] = useState<DbForm>({
    host: "localhost",
    port: "3306",
    user: "root",
    password: "",
    name: "saas_app",
  });
  const [app, setApp] = useState<AppForm>({ appName: "", orgName: "" });
  const [admin, setAdmin] = useState<AdminForm>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Redirect away if setup is already complete
  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then(({ complete }) => {
        if (complete) router.replace("/login");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <StepIndicator current={step} />

      {step === 1 && (
        <StepDatabase
          form={db}
          onChange={(f) => setDb((d) => ({ ...d, ...f }))}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <StepApplication
          form={app}
          onChange={(f) => setApp((a) => ({ ...a, ...f }))}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <StepAdmin
          form={admin}
          onChange={(f) => setAdmin((a) => ({ ...a, ...f }))}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}
      {step === 4 && (
        <StepReview
          db={db}
          app={app}
          admin={admin}
          onBack={() => setStep(3)}
          onComplete={() => router.push("/setup/complete")}
        />
      )}
    </div>
  );
}
