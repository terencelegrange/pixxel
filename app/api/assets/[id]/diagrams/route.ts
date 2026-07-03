import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { requireUser } from "@/lib/require-user";

const toISO = (v: unknown) =>
  v instanceof Date ? v.toISOString() : v ? String(v) : null;

// GET /api/assets/[id]/diagrams — list diagrams that contain this asset
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT
         d.id, d.name, d.description,
         COALESCE(MAX(dv.version_number), 0) AS latest_version,
         COUNT(DISTINCT da2.asset_id)        AS asset_count,
         d.created_by_name,
         d.updated_at
       FROM diagrams d
       JOIN diagram_assets da ON da.diagram_id = d.id AND da.asset_id = ?
       LEFT JOIN diagram_versions dv ON dv.diagram_id = d.id
       LEFT JOIN diagram_assets da2 ON da2.diagram_id = d.id
       GROUP BY d.id, d.name, d.description, d.created_by_name, d.updated_at
       ORDER BY d.updated_at DESC`,
      [params.id]
    );
    const diagrams = rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      latestVersion: Number(r.latest_version),
      assetCount: Number(r.asset_count),
      createdByName: r.created_by_name,
      updatedAt: toISO(r.updated_at)!,
    }));
    return NextResponse.json({ diagrams });
  } catch (err) {
    logger.error({ err, route: "GET /api/assets/:id/diagrams" }, "request failed");
    return NextResponse.json({ error: "Failed to load diagrams." }, { status: 500 });
  }
}
