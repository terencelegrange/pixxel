import { User } from "@/types";

const STORAGE_KEY = "saas_auth_user";

// ---------------------------------------------------------------------------
// localStorage helpers (client-side only)
// ---------------------------------------------------------------------------
export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function storeUser(user: User): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Auth API calls — talk to Next.js API routes which handle the DB
// ---------------------------------------------------------------------------
export async function loginUser(email: string, password: string): Promise<User> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Login failed.");
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
