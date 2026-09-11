import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { getDb, setupDatabase } from "@/lib/db";
import { requireUser } from "@/lib/require-user";

// PATCH /api/projects/[id]/assets/[assetId] — update dependency type or notes
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
    const { dependencyType, notes } = body;

    if (!["upstream", "downstream"].includes(dependencyType))
      return NextResponse.json({ error: "Dependency type must be upstream or downstream." }, { status: 400 });

    const db = getDb();
    await db.execute(
      "UPDATE project_assets SET dependency_type = ?, notes = ? WHERE project_id = ? AND asset_id = ?",
      [dependencyType, notes?.trim() || null, params.id, params.assetId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PATCH /api/projects/:id/assets/:assetId" }, "request failed");
    return NextResponse.json({ error: "Failed to update asset link." }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/assets/[assetId] — remove asset link
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
    await db.execute(
      "DELETE FROM project_assets WHERE project_id = ? AND asset_id = ?",
      [params.id, params.assetId]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/projects/:id/assets/:assetId" }, "request failed");
    return NextResponse.json({ error: "Failed to remove asset link." }, { status: 500 });
  }
}
