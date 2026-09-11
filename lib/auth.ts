import { User } from "@/types";

const USER_KEY = "saas_auth_user";

// ---------------------------------------------------------------------------
// localStorage helpers (client-side only)
// ---------------------------------------------------------------------------
export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function storeUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  localStorage.removeItem(USER_KEY);
}

// ---------------------------------------------------------------------------
// Auth API calls — talk to Next.js API routes which handle the DB.
// Login and register return both `user` and `token`. The token is set as an
// HttpOnly cookie by the server (no manual header wiring needed in the
// browser). The caller receives the user object; the cookie is automatic.
// ---------------------------------------------------------------------------
export type LoginResult =
  | { status: "ok"; user: User }
  | { status: "mfa_required"; mfaToken: string };

export async function loginUser(email: string, password: string): Promise<LoginResult> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Login failed.");
  if (data.mfaRequired) return { status: "mfa_required", mfaToken: data.mfaToken as string };
  return { status: "ok", user: data.user as User };
}

// Completes login after loginUser() returned "mfa_required" — submits a
// 6-digit TOTP code or a one-time recovery code.
export async function verifyMfaChallenge(
  mfaToken: string,
  credential: { code: string } | { recoveryCode: string }
): Promise<User> {
  const res = await fetch("/api/auth/mfa/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mfaToken, ...credential }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Verification failed.");
  return data.user as User;
}

export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<User> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Registration failed.");
  return data.user as User;
}

// Clears the server-side HttpOnly cookie so the JWT is invalidated.
export async function logoutUser(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}

// Verifies the current session against the server — returns the fresh user
// if the authToken cookie is still valid, or null if it's missing/expired/
// revoked (a normal outcome, not an error: an expired session isn't a bug).
// Returns "unknown" on a network error, distinct from null, so callers can
// choose to keep trusting a locally-stored user through a transient blip
// rather than treating it the same as a confirmed logged-out state.
export async function fetchCurrentUser(): Promise<User | null | "unknown"> {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return null;
    const data = await res.json();
    return data.user as User;
  } catch {
    return "unknown";
  }
}
