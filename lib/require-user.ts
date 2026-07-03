/**
 * lib/require-user.ts  —  SERVER ONLY
 *
 * Call at the top of every protected API route handler.
 * Reads the HttpOnly authToken cookie, verifies the JWT, and returns
 * the authenticated user or a ready-made 401 response.
 *
 * Usage:
 *   const auth = requireUser(req);
 *   if (!auth.ok) return auth.response;
 *   const { user } = auth;  // { id, name, email, role }
 *
 * Role guard:
 *   const auth = requireUser(req, "Admin");
 *   if (!auth.ok) return auth.response;  // returns 403 if role doesn't match
 *
 *   const auth = requireUser(req, ["Admin", "Member"]);
 *   if (!auth.ok) return auth.response;  // returns 403 unless role is one of these
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@/lib/jwt";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

type RequireUserResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: NextResponse };

export function requireUser(req: NextRequest, requiredRole?: string | string[]): RequireUserResult {
  const token = req.cookies.get("authToken")?.value;

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      ),
    };
  }

  const payload = verifyJwt(token);
  if (!payload) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Session expired. Please log in again." },
        { status: 401 }
      ),
    };
  }

  const user: AuthUser = {
    id: payload.sub,
    name: payload.name,
    email: payload.email,
    role: payload.role,
  };

  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : requiredRole ? [requiredRole] : null;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You do not have permission to perform this action." },
        { status: 403 }
      ),
    };
  }

  return { ok: true, user };
}
