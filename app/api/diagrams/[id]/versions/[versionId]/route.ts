import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";

const toISO = (v: unknown) =>
  v instanceof Date ? v.toISOString() : v ? String(v) : null;

// GET /api/diagrams/[id]/versions/[versionId] — fetch a specific version with content
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; versionId: string } }
) {
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT id, diagram_id, version_number, content, created_by_id, created_by_name, created_at
       FROM diagram_versions WHERE id = ? AND diagram_id = ? LIMIT 1`,
      [params.versionId, params.id]
    );
    const r = rows[0];
    if (!r) return NextResponse.json({ error: "Version not found." }, { status: 404 });
    return NextResponse.json({
      version: {
        id: r.id,
        diagramId: r.diagram_id,
        versionNumber: Number(r.version_number),
        content: r.content,
        createdById: r.created_by_id,
        createdByName: r.created_by_name,
        createdAt: toISO(r.created_at)!,
      },
    });
  } catch (err) {
    console.error("[GET /api/diagrams/:id/versions/:versionId]", err);
    return NextResponse.json({ error: "Failed to load version." }, { status: 500 });
  }
}
