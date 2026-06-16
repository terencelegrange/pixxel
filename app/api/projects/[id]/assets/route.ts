import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";

// GET /api/projects/[id]/assets — list assets linked to project
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const db = getDb();

    const [projectRows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM projects WHERE id = ? LIMIT 1", [params.id]
    );
    if (!projectRows[0]) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    const [rows] = await db.execute<mysql.RowDataPacket[]>(`
      SELECT pa.asset_id, pa.dependency_type, pa.notes,
             a.name AS asset_name, a.type AS asset_type,
             a.icon AS asset_icon, a.lifecycle_status,
             t.name AS tier_name
      FROM project_assets pa
      JOIN assets a ON a.id = pa.asset_id
      LEFT JOIN tiers t ON t.id = a.tier_id
      WHERE pa.project_id = ?
      ORDER BY pa.dependency_type ASC, a.name ASC
    `, [params.id]);

    const assets = rows.map((r) => ({
      assetId: r.asset_id,
      assetName: r.asset_name,
      assetType: r.asset_type,
      assetIcon: r.asset_icon ?? null,
      lifecycleStatus: r.lifecycle_status,
      tierName: r.tier_name ?? null,
      dependencyType: r.dependency_type,
      notes: r.notes ?? null,
    }));

    return NextResponse.json({ assets });
  } catch (err) {
    console.error("[GET /api/projects/:id/assets]", err);
    return NextResponse.json({ error: "Failed to load project assets." }, { status: 500 });
  }
}

// POST /api/projects/[id]/assets — link an asset
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { assetId, dependencyType, notes } = body;

    if (!assetId) return NextResponse.json({ error: "Asset ID is required." }, { status: 400 });
    if (!["upstream", "downstream"].includes(dependencyType))
      return NextResponse.json({ error: "Dependency type must be upstream or downstream." }, { status: 400 });

    const db = getDb();

    const [projectRows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM projects WHERE id = ? LIMIT 1", [params.id]
    );
    if (!projectRows[0]) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    const [assetRows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM assets WHERE id = ? LIMIT 1", [assetId]
    );
    if (!assetRows[0]) return NextResponse.json({ error: "Asset not found." }, { status: 404 });

    const [existing] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT asset_id FROM project_assets WHERE project_id = ? AND asset_id = ? LIMIT 1",
      [params.id, assetId]
    );
    if ((existing as mysql.RowDataPacket[]).length > 0)
      return NextResponse.json({ error: "Asset is already linked to this project." }, { status: 409 });

    await db.execute(
      "INSERT INTO project_assets (project_id, asset_id, dependency_type, notes) VALUES (?, ?, ?, ?)",
      [params.id, assetId, dependencyType, notes?.trim() || null]
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/projects/:id/assets]", err);
    return NextResponse.json({ error: "Failed to link asset." }, { status: 500 });
  }
}
