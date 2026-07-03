import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

const toISO = (v: unknown) =>
  v instanceof Date ? v.toISOString() : v ? String(v) : null;

// GET /api/diagrams/[id]/versions — list all versions (no content)
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT id, diagram_id, version_number, created_by_id, created_by_name, created_at
       FROM diagram_versions WHERE diagram_id = ? ORDER BY version_number DESC`,
      [params.id]
    );
    const versions = rows.map((r) => ({
      id: r.id, diagramId: r.diagram_id,
      versionNumber: Number(r.version_number),
      createdById: r.created_by_id, createdByName: r.created_by_name,
      createdAt: toISO(r.created_at)!,
    }));
    return NextResponse.json({ versions });
  } catch (err) {
    logger.error({ err, route: "GET /api/diagrams/:id/versions" }, "request failed");
    return NextResponse.json({ error: "Failed to load versions." }, { status: 500 });
  }
}

// POST /api/diagrams/[id]/versions — save a new version
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const { content, assetIds } = await req.json();
    if (!content) return NextResponse.json({ error: "Content is required." }, { status: 400 });

    const db = getDb();

    // Verify diagram exists
    const [diagRows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM diagrams WHERE id = ? LIMIT 1", [params.id]
    );
    if (!diagRows[0]) return NextResponse.json({ error: "Diagram not found." }, { status: 404 });

    // Get next version number
    const [maxRows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT COALESCE(MAX(version_number), 0) AS max_ver FROM diagram_versions WHERE diagram_id = ?",
      [params.id]
    );
    const nextVersion = Number(maxRows[0].max_ver) + 1;

    const versionId = randomUUID();
    await db.execute(
      "INSERT INTO diagram_versions (id, diagram_id, version_number, content, created_by_id, created_by_name) VALUES (?,?,?,?,?,?)",
      [versionId, params.id, nextVersion, content, user.id, user.name]
    );

    // Update diagram.updated_at
    await db.execute("UPDATE diagrams SET updated_at = NOW() WHERE id = ?", [params.id]);

    // Replace diagram_assets junction
    await db.execute("DELETE FROM diagram_assets WHERE diagram_id = ?", [params.id]);
    const ids = Array.isArray(assetIds) ? assetIds as string[] : [];
    for (const assetId of ids) {
      await db.execute(
        "INSERT IGNORE INTO diagram_assets (diagram_id, asset_id) VALUES (?,?)",
        [params.id, assetId]
      );
    }

    await writeAudit({
      tableName: "diagrams", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null,
      newValues: { versionSaved: nextVersion, assetCount: ids.length },
    });

    return NextResponse.json({ versionId, versionNumber: nextVersion }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: "POST /api/diagrams/:id/versions" }, "request failed");
    return NextResponse.json({ error: "Failed to save version." }, { status: 500 });
  }
}
