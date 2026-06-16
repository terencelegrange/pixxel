import Link from "next/link";

export default function SetupCompletePage() {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      {/* Success icon */}
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg
          className="h-8 w-8 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-slate-900">Setup Complete!</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Your application has been configured and the admin account has been
        created. You can now sign in.
      </p>

      {/* Summary tiles */}
      <div className="mt-6 flex w-full flex-col gap-3 text-left sm:flex-row">
        <div className="flex flex-1 items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 3v4M8 3v4M4 11h16" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Database ready</p>
            <p className="mt-0.5 text-xs text-slate-500">
              All tables have been created and are ready to use.
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Admin account created</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Sign in with the email and password you set up.
            </p>
          </div>
        </div>
      </div>

      <Link
        href="/login"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Go to Login
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </Link>
    </div>
  );
}
