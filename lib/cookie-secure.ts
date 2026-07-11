/**
 * lib/cookie-secure.ts  —  SERVER ONLY
 *
 * Whether the auth cookie should be marked Secure, based on the actual
 * incoming request's protocol rather than NODE_ENV. Docker deployments run
 * with NODE_ENV=production even when accessed over plain HTTP (no reverse
 * proxy terminating TLS) — a blanket NODE_ENV check marks the cookie
 * Secure in that case, and browsers silently refuse to store a Secure
 * cookie that arrived over a plain HTTP response, breaking login with no
 * visible error (the API call succeeds; the cookie just never gets set).
 *
 * Honors X-Forwarded-Proto (set by TLS-terminating reverse proxies) ahead
 * of the request's own protocol, since the app itself may be receiving
 * plain HTTP from the proxy even though the client used HTTPS.
 */
import { NextRequest } from "next/server";

export function isSecureRequest(req: NextRequest): boolean {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedProto) return forwardedProto.split(",")[0].trim().toLowerCase() === "https";
  return req.nextUrl.protocol === "https:";
}
