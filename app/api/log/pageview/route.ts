import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { requireUser } from "@/lib/require-user";

// POST /api/log/pageview — records a client-side route change (PIXXEL-2).
// requireUser() already logs this call itself as an "api_request" line;
// this route additionally logs the navigated-to path as its own event,
// since a page view isn't an API request against that path.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    const { path } = await req.json();
    if (typeof path !== "string" || !path.trim()) {
      return NextResponse.json({ error: "path is required." }, { status: 400 });
    }
    logger.info({ path, userId: user.id, role: user.role }, "page_view");
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, route: "POST /api/log/pageview" }, "request failed");
    return NextResponse.json({ error: "Failed to log page view." }, { status: 500 });
  }
}
