"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { User } from "@/types";
import {
  getStoredUser,
  storeUser,
  clearStoredUser,
  loginUser,
  registerUser,
  logoutUser,
  verifyMfaChallenge,
  fetchCurrentUser,
  LoginResult,
} from "@/lib/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** False for the read-only "Viewer" role; true for Member/Admin. */
  canWrite: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  completeMfaLogin: (mfaToken: string, credential: { code: string } | { recoveryCode: string }) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Rehydrate from localStorage on mount, then verify the session against
  // the server — a stored user alone doesn't mean the session is still
  // valid (the authToken cookie may have expired, or token_version may
  // have been bumped by a role change or MFA disable elsewhere).
  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);

    fetchCurrentUser().then((result) => {
      if (result === "unknown") {
        // Network error: keep whatever was in localStorage rather than
        // logging the user out over a transient connectivity issue.
      } else if (result === null) {
        clearStoredUser();
        setUser(null);
      } else {
        storeUser(result);
        setUser(result);
      }
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const result = await loginUser(email, password);
    if (result.status === "ok") {
      storeUser(result.user);
      setUser(result.user);
      router.push("/dashboard");
    }
    return result;
  }, [router]);

  const completeMfaLogin = useCallback(async (mfaToken: string, credential: { code: string } | { recoveryCode: string }) => {
    const loggedIn = await verifyMfaChallenge(mfaToken, credential);
    storeUser(loggedIn);
    setUser(loggedIn);
    router.push("/dashboard");
  }, [router]);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const newUser = await registerUser(name, email, password);
      storeUser(newUser);
      setUser(newUser);
      router.push("/dashboard");
    },
    [router]
  );

  const logout = useCallback(() => {
    clearStoredUser();
    setUser(null);
    // Clear the server-side HttpOnly cookie so the JWT is invalidated.
    logoutUser();
    router.push("/login");
  }, [router]);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch };
      storeUser(updated);
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        canWrite: user?.role !== "Viewer",
        login,
        completeMfaLogin,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
