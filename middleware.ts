/**
 * middleware.ts
 *
 * Server-side route guard. Runs on the Edge runtime before any page request
 * reaches React, so unauthenticated visitors are redirected before the
 * dashboard shell or its data ever ships to the client. This is a backstop
 * for lib/require-user.ts (which protects the API routes) — the Edge runtime
 * has no access to Node's `crypto` module, so the HS256 signature check here
 * is reimplemented with Web Crypto (SubtleCrypto) rather than importing
 * lib/jwt.ts directly.
 */
import { NextRequest, NextResponse } from "next/server";

// "/" is public because it defers to /api/setup/status client-side to decide
// between /setup (no admin yet) and /login — middleware can't safely
// preempt that without an extra network round trip.
const PUBLIC_PATHS = ["/", "/login", "/register", "/setup"];

function base64urlToUint8Array(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function isValidJwt(token: string, secret: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [header, claims, sig] = parts;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlToUint8Array(sig) as BufferSource,
      new TextEncoder().encode(`${header}.${claims}`)
    );
    if (!valid) return false;

    const payload = JSON.parse(atob(claims.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp >= Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = req.cookies.get("authToken")?.value;
  const secret = process.env.JWT_SECRET;

  if (!token || !secret || !(await isValidJwt(token, secret))) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all page routes except:
     * - /api (protected server-side by lib/require-user.ts)
     * - /_next/static, /_next/image (Next.js internals)
     * - favicon.ico and other files with an extension (public assets)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
