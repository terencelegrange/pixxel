"use client";

import { useState, FormEvent } from "react";
import { UserCircle, Mail, ShieldCheck, Calendar, Pencil, Check, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function ProfilePage() {
  const { user, updateUser } = useAuth();

  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);

  const [nameValue, setNameValue] = useState("");
  const [emailValue, setEmailValue] = useState("");

  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!user) return null;

  const joined = new Date(user.createdAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  function startEdit(field: "name" | "email") {
    if (field === "name") {
      setNameValue(user!.name);
      setNameError("");
      setEditingName(true);
    } else {
      setEmailValue(user!.email);
      setEmailError("");
      setEditingEmail(true);
    }
  }

  function cancelEdit(field: "name" | "email") {
    if (field === "name") { setEditingName(false); setNameError(""); }
    else { setEditingEmail(false); setEmailError(""); }
  }

  async function save(field: "name" | "email", e: FormEvent) {
    e.preventDefault();
    const newName  = field === "name"  ? nameValue.trim()  : user!.name;
    const newEmail = field === "email" ? emailValue.trim() : user!.email;

    if (field === "name"  && !newName)  { setNameError("Name is required.");  return; }
    if (field === "email" && !newEmail) { setEmailError("Email is required."); return; }

    setIsSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user!.id, name: newName, email: newEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error ?? "Save failed.";
        if (field === "name") setNameError(msg);
        else setEmailError(msg);
        return;
      }
      updateUser(data.user);
      if (field === "name") setEditingName(false);
      else setEditingEmail(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Profile</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your account details.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
        {/* Cover */}
        <div className="h-24 bg-gradient-to-r from-brand-600 to-brand-500" />

        {/* Avatar + name */}
        <div className="px-6 pb-6">
          <div className="-mt-10 flex items-end gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-brand-700 text-xl font-bold text-white shadow-md dark:border-slate-900">
              {user.avatarInitials}
            </div>
            <div className="pb-1">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{user.name}</h2>
              <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-2 divide-y divide-slate-100 dark:divide-slate-800">

          {/* Full name */}
          <div className="flex items-start gap-4 py-4">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <UserCircle className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                Full name
              </p>
              {editingName ? (
                <form onSubmit={(e) => save("name", e)} className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input
                      type="text"
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      error={nameError}
                      autoFocus
                    />
                  </div>
                  <Button type="submit" size="sm" isLoading={isSaving}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => cancelEdit("name")}>
                    <X className="h-4 w-4" />
                  </Button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{user.name}</p>
                  <button
                    onClick={() => startEdit("name")}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors dark:hover:bg-slate-800 dark:hover:text-slate-300"
                    aria-label="Edit name"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="flex items-start gap-4 py-4">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <Mail className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                Email address
              </p>
              {editingEmail ? (
                <form onSubmit={(e) => save("email", e)} className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input
                      type="email"
                      value={emailValue}
                      onChange={(e) => setEmailValue(e.target.value)}
                      error={emailError}
                      autoFocus
                    />
                  </div>
                  <Button type="submit" size="sm" isLoading={isSaving}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => cancelEdit("email")}>
                    <X className="h-4 w-4" />
                  </Button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{user.email}</p>
                  <button
                    onClick={() => startEdit("email")}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors dark:hover:bg-slate-800 dark:hover:text-slate-300"
                    aria-label="Edit email"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Role — read-only */}
          <div className="flex items-start gap-4 py-4">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <ShieldCheck className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Role</p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{user.role}</p>
            </div>
          </div>

          {/* Joined — read-only */}
          <div className="flex items-start gap-4 py-4">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Member since</p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{joined}</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
