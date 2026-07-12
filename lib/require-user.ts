/**
 * lib/require-user.ts  —  SERVER ONLY
 *
 * Call at the top of every protected API route handler.
 * Reads the HttpOnly authToken cookie, verifies the JWT (signature, expiry,
 * and — for state-changing requests — same-origin), and returns the
 * authenticated user or a ready-made error response.
 *
 * Usage:
 *   const auth = await requireUser(req);
 *   if (!auth.ok) return auth.response;
 *   const { user } = auth;  // { id, name, email, role }
 *
 * Role guard:
 *   const auth = await requireUser(req, "Admin");
 *   if (!auth.ok) return auth.response;  // returns 403 if role doesn't match
 *
 *   const auth = await requireUser(req, ["Admin", "Member"]);
 *   if (!auth.ok) return auth.response;  // returns 403 unless role is one of these
 */
import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { verifyJwt } from "@/lib/jwt";
import { getDb } from "@/lib/db";
import { isSecureRequest } from "@/lib/cookie-secure";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

type RequireUserResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: NextResponse };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// CSRF defense-in-depth for the SameSite=Lax auth cookie: state-changing
// requests must present an Origin/Referer matching this app's own origin.
// Requests with neither header (non-browser clients) are allowed through —
// SameSite=Lax already blocks the classic cross-site form-POST vector.
//
// The "expected" origin is built from the request's Host header (honoring
// X-Forwarded-Host for reverse-proxy deployments), NOT req.nextUrl.origin.
// In Next.js's standalone server output (this app's Docker build target),
// req.nextUrl is constructed from the server's own listen address
// (HOSTNAME/PORT env vars, e.g. http://0.0.0.0:3000) rather than the
// incoming request's actual Host header — so a container run with a
// remapped host port (`docker run -p 3088:3000 ...`, a normal deployment)
// would see req.nextUrl.origin stay stuck at the internal port and reject
// every state-changing request as cross-site, no matter what the browser
// actually sent. The Host header always reflects what the client used.
function isTrustedOrigin(req: NextRequest): boolean {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return false;
  const proto = isSecureRequest(req) ? "https" : "http";
  const expected = `${proto}://${host}`;

  const origin = req.headers.get("origin");
  if (origin) return origin === expected;

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === expected;
    } catch {
      return false;
    }
  }

  return true;
}

export async function requireUser(req: NextRequest, requiredRole?: string | string[]): Promise<RequireUserResult> {
  if (!SAFE_METHODS.has(req.method) && !isTrustedOrigin(req)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Cross-site request blocked." },
        { status: 403 }
      ),
    };
  }

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

  const db = getDb();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT token_version FROM users WHERE id = ? LIMIT 1", [payload.sub]
  );
  const currentVersion = rows[0]?.token_version;
  if (currentVersion == null || currentVersion !== payload.tokenVersion) {
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
