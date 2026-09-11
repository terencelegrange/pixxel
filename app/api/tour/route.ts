import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { requireUser } from "@/lib/require-user";
import { navigationConfig } from "@/config/navigation";
import logger from "@/lib/logger";

// GET /api/tour — any authenticated user. Returns the admin-configured
// onboarding tour steps, resolved against config/navigation.ts for
// label/icon/featureKey (app_settings only stores href + order, never
// duplicates that content). Feature-tier filtering (hasFeature()) happens
// client-side, the same way Sidebar.tsx already filters nav items -- no
// role-based filtering exists for nav items today, only feature-tier.
// Admin-side writes reuse the existing PUT /api/settings (Admin-only,
// already handles arbitrary app_settings key/value pairs) under the
// "tour.steps" key -- no dedicated PUT route needed here.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT `value` FROM app_settings WHERE `key` = 'tour.steps'"
    );

    let configuredHrefs: string[] = [];
    try {
      const parsed = rows[0]?.value ? JSON.parse(rows[0].value) : [];
      if (Array.isArray(parsed)) configuredHrefs = parsed.filter((h): h is string => typeof h === "string");
    } catch {
      // malformed stored value -- treat as unconfigured rather than 500
    }

    const byHref = new Map(navigationConfig.flatMap((g) => g.items).map((item) => [item.href, item]));

    const steps = configuredHrefs
      .map((href) => byHref.get(href))
      .filter((item): item is NonNullable<typeof item> => !!item)
      .map((item) => ({ href: item.href, label: item.label, icon: item.icon, featureKey: item.featureKey ?? null }));

    return NextResponse.json({ steps });
  } catch (err) {
    logger.error({ err, route: "GET /api/tour" }, "request failed");
    return NextResponse.json({ error: "Failed to load tour." }, { status: 500 });
  }
}
