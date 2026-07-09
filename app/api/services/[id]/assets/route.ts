import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase, getDbDialect } from "@/lib/db";
import { requireUser } from "@/lib/require-user";
import { getComposedService } from "@/lib/services";

const VALID_ROLES = ["Core", "Supporting", "Dependency"] as const;

// GET /api/services/[id]/assets — list assets linked to service
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const service = await getComposedService(getDb(), getDbDialect(), { id: params.id });
    if (!service) return NextResponse.json({ error: "Service not found." }, { status: 404 });
    return NextResponse.json({ assets: service.members });
  } catch (err) {
    logger.error({ err, route: "GET /api/services/:id/assets" }, "request failed");
    return NextResponse.json({ error: "Failed to load service assets." }, { status: 500 });
  }
}

// POST /api/services/[id]/assets — link an asset
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const body = await req.json();
    const { assetId, notes } = body;
    const role = body.role ?? "Supporting";

    if (!assetId) return NextResponse.json({ error: "Asset ID is required." }, { status: 400 });
    if (!VALID_ROLES.includes(role))
      return NextResponse.json({ error: "Role must be Core, Supporting, or Dependency." }, { status: 400 });

    const db = getDb();

    const [serviceRows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM services WHERE id = ? LIMIT 1", [params.id]
    );
    if (!serviceRows[0]) return NextResponse.json({ error: "Service not found." }, { status: 404 });

    const [assetRows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM assets WHERE id = ? LIMIT 1", [assetId]
    );
    if (!assetRows[0]) return NextResponse.json({ error: "Asset not found." }, { status: 404 });

    const [existing] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT asset_id FROM service_assets WHERE service_id = ? AND asset_id = ? LIMIT 1",
      [params.id, assetId]
    );
    if ((existing as mysql.RowDataPacket[]).length > 0)
      return NextResponse.json({ error: "Asset is already linked to this service." }, { status: 409 });

    await db.execute(
      "INSERT INTO service_assets (service_id, asset_id, role, notes) VALUES (?, ?, ?, ?)",
      [params.id, assetId, role, notes?.trim() || null]
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: "POST /api/services/:id/assets" }, "request failed");
    return NextResponse.json({ error: "Failed to link asset." }, { status: 500 });
  }
}
