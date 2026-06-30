import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

const toISO = (v: unknown) =>
  v instanceof Date ? v.toISOString() : v ? String(v) : null;

// GET /api/diagrams — list all diagrams with latest version, asset count, project + last modifier
export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(`
      SELECT
        d.*,
        COALESCE(MAX(dv.version_number), 0)  AS latest_version,
        COUNT(DISTINCT da.asset_id)           AS asset_count,
        p.name                                AS project_name,
        dt.name                               AS diagram_type_name,
        (
          SELECT dv2.created_by_name
          FROM diagram_versions dv2
          WHERE dv2.diagram_id = d.id
          ORDER BY dv2.version_number DESC
          LIMIT 1
        )                                     AS last_modified_by_name
      FROM diagrams d
      LEFT JOIN diagram_versions dv ON dv.diagram_id = d.id
      LEFT JOIN diagram_assets da   ON da.diagram_id = d.id
      LEFT JOIN projects p          ON p.id = d.project_id
      LEFT JOIN diagram_types dt    ON dt.id = d.diagram_type_id
      GROUP BY d.id, d.name, d.description, d.project_id, d.diagram_type_id,
               d.created_by_id, d.created_by_name, d.created_at, d.updated_at,
               p.name, dt.name
      ORDER BY d.updated_at DESC
    `);
    const diagrams = rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      projectId: r.project_id ?? null,
      projectName: r.project_name ?? null,
      diagramTypeId: r.diagram_type_id ?? null,
      diagramTypeName: r.diagram_type_name ?? null,
      latestVersion: Number(r.latest_version),
      assetCount: Number(r.asset_count),
      lastModifiedByName: r.last_modified_by_name ?? null,
      createdById: r.created_by_id,
      createdByName: r.created_by_name,
      createdAt: toISO(r.created_at)!,
      updatedAt: toISO(r.updated_at)!,
    }));
    return NextResponse.json({ diagrams });
  } catch (err) {
    console.error("[GET /api/diagrams]", err);
    return NextResponse.json({ error: "Failed to load diagrams." }, { status: 500 });
  }
}

// POST /api/diagrams — create a new diagram (with initial empty version)
export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const { name, description, projectId, diagramTypeId } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });

    const db = getDb();
    const id = randomUUID();

    await db.execute(
      "INSERT INTO diagrams (id, name, description, project_id, diagram_type_id, created_by_id, created_by_name) VALUES (?,?,?,?,?,?,?)",
      [id, name.trim(), description?.trim() || null, projectId || null, diagramTypeId || null, user.id, user.name]
    );

    // Create version 1 with empty canvas
    const versionId = randomUUID();
    const emptyContent = JSON.stringify({ elements: [], appState: { viewBackgroundColor: "#ffffff", gridSize: 20 }, files: {} });
    await db.execute(
      "INSERT INTO diagram_versions (id, diagram_id, version_number, content, created_by_id, created_by_name) VALUES (?,?,?,?,?,?)",
      [versionId, id, 1, emptyContent, user.id, user.name]
    );

    await writeAudit({
      tableName: "diagrams", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null,
      newValues: { name: name.trim(), description: description?.trim() || null, projectId: projectId || null, diagramTypeId: diagramTypeId || null },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/diagrams]", err);
    return NextResponse.json({ error: "Failed to create diagram." }, { status: 500 });
  }
}
