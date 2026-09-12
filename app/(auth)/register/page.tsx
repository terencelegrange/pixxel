import { Metadata } from "next";
import RegisterForm from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Create Account — Pixxel" };

export default function RegisterPage() {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Create an account</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Get started — it&apos;s free
        </p>
      </div>
      <RegisterForm />
    </>
  );
}
