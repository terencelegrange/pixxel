"use client";

import { useState, FormEvent } from "react";
import { LifeBuoy, CheckCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const REQUEST_TYPES = ["Feature Request", "Report Request", "Bug", "Other"] as const;

export default function SupportPage() {
  const { user } = useAuth();
  const [type, setType] = useState("Feature Request");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [subjectError, setSubjectError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim()) { setSubjectError("Subject is required."); return; }
    setSubjectError(""); setGeneralError("");
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type, subject: subject.trim(), description: description.trim(),
          userId: user?.id, userName: user?.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed.");
      setSubmitted(true);
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function reset() {
    setType("Feature Request"); setSubject(""); setDescription("");
    setSubjectError(""); setGeneralError(""); setSubmitted(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Support</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Request new features, reports, or report a bug.
        </p>
      </div>

      <div className="mx-auto max-w-2xl">
        {submitted ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-10 text-center shadow-sm dark:bg-emerald-950/30 dark:border-emerald-900">
            <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
            <h2 className="mt-4 text-lg font-semibold text-emerald-800 dark:text-emerald-300">Request submitted!</h2>
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
              Thank you — your request has been received and will be reviewed.
            </p>
            <button onClick={reset} className="mt-6 text-sm text-emerald-600 underline hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300">
              Submit another request
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-700">
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <LifeBuoy className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                <h2 className="font-semibold text-slate-800 dark:text-slate-200">Submit a Request</h2>
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5">
              {generalError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
                  {generalError}
                </div>
              )}

              {/* Type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Request type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                >
                  {REQUEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Subject */}
              <Input
                label="Subject"
                type="text"
                placeholder="Brief summary of your request"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                error={subjectError}
              />

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Description <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={5}
                  value={description}
                  placeholder="Provide as much detail as possible — what you need, why it's valuable, any specific requirements..."
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" isLoading={isSubmitting}>Submit Request</Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
