import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { AssetDependency, DependencyConnectionType, DependencyDirection } from "@/types";
import { requireUser } from "@/lib/require-user";

const VALID_TYPES: DependencyConnectionType[] = [
  'API', 'Database', 'File Transfer', 'Event / Message', 'UI Embed', 'Other',
];
const VALID_DIRECTIONS: DependencyDirection[] = ['outbound', 'bidirectional'];

const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : String(v);

function mapRow(row: mysql.RowDataPacket): AssetDependency {
  return {
    id: row.id,
    sourceAssetId: row.source_asset_id,
    sourceAssetName: row.source_asset_name,
    sourceAssetIcon: row.source_asset_icon ?? null,
    sourceAssetDomain: row.source_asset_domain ?? null,
    targetAssetId: row.target_asset_id,
    targetAssetName: row.target_asset_name,
    targetAssetIcon: row.target_asset_icon ?? null,
    targetAssetDomain: row.target_asset_domain ?? null,
    type: row.type as DependencyConnectionType,
    direction: row.direction as DependencyDirection,
    notes: row.notes ?? null,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    createdAt: toISO(row.created_at),
    updatedAt: toISO(row.updated_at),
  };
}

const JOIN_SQL = `
  SELECT
    d.id, d.type, d.direction, d.notes,
    d.created_by_id, d.created_by_name, d.created_at, d.updated_at,
    d.source_asset_id,
    sa.name  AS source_asset_name,
    sa.icon  AS source_asset_icon,
    sdom.name AS source_asset_domain,
    d.target_asset_id,
    ta.name  AS target_asset_name,
    ta.icon  AS target_asset_icon,
    tdom.name AS target_asset_domain
  FROM asset_dependencies d
  JOIN   assets sa   ON sa.id   = d.source_asset_id
  LEFT JOIN domains sdom ON sdom.id = sa.domain_id
  JOIN   assets ta   ON ta.id   = d.target_asset_id
  LEFT JOIN domains tdom ON tdom.id = ta.domain_id
`;

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `${JOIN_SQL} ORDER BY sa.name ASC, ta.name ASC`
    );
    return NextResponse.json({ dependencies: rows.map(mapRow) });
  } catch (err) {
    logger.error({ err, route: "GET /api/dependencies" }, "request failed");
    return NextResponse.json({ error: "Failed to load dependencies." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const { sourceAssetId, targetAssetId, type, direction, notes } = body;

    if (!sourceAssetId)
      return NextResponse.json({ error: "sourceAssetId is required." }, { status: 400 });
    if (!targetAssetId)
      return NextResponse.json({ error: "targetAssetId is required." }, { status: 400 });
    if (sourceAssetId === targetAssetId)
      return NextResponse.json({ error: "An asset cannot depend on itself." }, { status: 400 });
    if (!type || !VALID_TYPES.includes(type))
      return NextResponse.json({ error: "Invalid type." }, { status: 400 });
    if (!direction || !VALID_DIRECTIONS.includes(direction))
      return NextResponse.json({ error: "direction must be outbound or bidirectional." }, { status: 400 });

    const db = getDb();

    // Check for reverse pair (DB UNIQUE KEY can't detect this automatically)
    const [rev] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM asset_dependencies WHERE source_asset_id = ? AND target_asset_id = ? LIMIT 1",
      [targetAssetId, sourceAssetId]
    );
    if (rev.length > 0) {
      return NextResponse.json(
        { error: "A dependency in the reverse direction already exists. Edit it and set direction to bidirectional instead." },
        { status: 409 }
      );
    }

    const id = randomUUID();
    try {
      await db.execute(
        `INSERT INTO asset_dependencies
           (id, source_asset_id, target_asset_id, type, direction, notes, created_by_id, created_by_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, sourceAssetId, targetAssetId, type, direction, notes?.trim() || null, user.id, user.name]
      );
    } catch (err: unknown) {
      const e = err as { errno?: number };
      if (e.errno === 1062) {
        return NextResponse.json(
          { error: "A dependency between these assets already exists." },
          { status: 409 }
        );
      }
      throw err;
    }

    await writeAudit({
      tableName: "asset_dependencies", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null,
      newValues: { sourceAssetId, targetAssetId, type, direction, notes: notes?.trim() || null },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: "POST /api/dependencies" }, "request failed");
    return NextResponse.json({ error: "Failed to create dependency." }, { status: 500 });
  }
}
