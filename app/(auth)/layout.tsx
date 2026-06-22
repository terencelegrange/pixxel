export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
            <rect x="0"  y="0"  width="9" height="9" rx="2" fill="white" fillOpacity="1"/>
            <rect x="11" y="0"  width="9" height="9" rx="2" fill="white" fillOpacity="0.65"/>
            <rect x="0"  y="11" width="9" height="9" rx="2" fill="white" fillOpacity="0.35"/>
            <rect x="11" y="11" width="9" height="9" rx="2" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.4" strokeWidth="1"/>
          </svg>
        </div>
        <span className="text-xl font-bold text-slate-900">Pixel</span>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}
