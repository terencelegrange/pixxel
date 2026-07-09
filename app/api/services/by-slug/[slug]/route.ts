import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { getDb, setupDatabase, getDbDialect } from "@/lib/db";
import { requireUser } from "@/lib/require-user";
import { getComposedService } from "@/lib/services";

// GET /api/services/by-slug/[slug]
export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const service = await getComposedService(getDb(), getDbDialect(), { slug: params.slug });
    if (!service) return NextResponse.json({ error: "Service not found." }, { status: 404 });
    return NextResponse.json(service);
  } catch (err) {
    logger.error({ err, route: "GET /api/services/by-slug/:slug" }, "request failed");
    return NextResponse.json({ error: "Failed to load service." }, { status: 500 });
  }
}
