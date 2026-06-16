import { NextRequest, NextResponse } from "next/server";
import { getDb, setupDatabase } from "@/lib/db";

// PATCH /api/projects/[id]/assets/[assetId] — update dependency type or notes
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; assetId: string } }
) {
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
    console.error("[PATCH /api/projects/:id/assets/:assetId]", err);
    return NextResponse.json({ error: "Failed to update asset link." }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/assets/[assetId] — remove asset link
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; assetId: string } }
) {
  try {
    await setupDatabase();
    const db = getDb();
    await db.execute(
      "DELETE FROM project_assets WHERE project_id = ? AND asset_id = ?",
      [params.id, params.assetId]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/projects/:id/assets/:assetId]", err);
    return NextResponse.json({ error: "Failed to remove asset link." }, { status: 500 });
  }
}
