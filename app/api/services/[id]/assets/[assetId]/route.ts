import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { requireUser } from "@/lib/require-user";

const VALID_ROLES = ["Core", "Supporting", "Dependency"] as const;

// PATCH /api/services/[id]/assets/[assetId] — update role or notes
export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string; assetId: string }> }
) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const body = await req.json();
    const { notes } = body;
    const role = body.role;

    if (role && !VALID_ROLES.includes(role))
      return NextResponse.json({ error: "Role must be Core, Supporting, or Dependency." }, { status: 400 });

    const db = getDb();
    const [result] = await db.execute<mysql.ResultSetHeader>(
      "UPDATE service_assets SET role = COALESCE(?, role), notes = ? WHERE service_id = ? AND asset_id = ?",
      [role ?? null, notes?.trim() || null, params.id, params.assetId]
    );
    if (!result.affectedRows) return NextResponse.json({ error: "Asset link not found." }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PATCH /api/services/:id/assets/:assetId" }, "request failed");
    return NextResponse.json({ error: "Failed to update asset link." }, { status: 500 });
  }
}

// DELETE /api/services/[id]/assets/[assetId] — remove asset link
export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string; assetId: string }> }
) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [result] = await db.execute<mysql.ResultSetHeader>(
      "DELETE FROM service_assets WHERE service_id = ? AND asset_id = ?",
      [params.id, params.assetId]
    );
    if (!result.affectedRows) return NextResponse.json({ error: "Asset link not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/services/:id/assets/:assetId" }, "request failed");
    return NextResponse.json({ error: "Failed to remove asset link." }, { status: 500 });
  }
}
