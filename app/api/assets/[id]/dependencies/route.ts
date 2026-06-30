import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { AssetDependency, DependencyConnectionType, DependencyDirection } from "@/types";
import { requireUser } from "@/lib/require-user";

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

const JOIN_SQL = (whereClause: string) => `
  SELECT
    d.id, d.type, d.direction, d.notes,
    d.created_by_id, d.created_by_name, d.created_at, d.updated_at,
    d.source_asset_id,
    sa.name   AS source_asset_name,
    sa.icon   AS source_asset_icon,
    sdom.name AS source_asset_domain,
    d.target_asset_id,
    ta.name   AS target_asset_name,
    ta.icon   AS target_asset_icon,
    tdom.name AS target_asset_domain
  FROM asset_dependencies d
  JOIN   assets sa   ON sa.id   = d.source_asset_id
  LEFT JOIN domains sdom ON sdom.id = sa.domain_id
  JOIN   assets ta   ON ta.id   = d.target_asset_id
  LEFT JOIN domains tdom ON tdom.id = ta.domain_id
  WHERE ${whereClause}
  ORDER BY sa.name ASC, ta.name ASC
`;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();

    const [downstreamRows] = await db.execute<mysql.RowDataPacket[]>(
      JOIN_SQL("d.source_asset_id = ?"), [params.id]
    );
    const [upstreamRows] = await db.execute<mysql.RowDataPacket[]>(
      JOIN_SQL("d.target_asset_id = ?"), [params.id]
    );

    // Bidirectional records appear in both lists
    const bidiFromDownstream = downstreamRows.filter((r) => r.direction === 'bidirectional');
    const bidiFromUpstream = upstreamRows.filter((r) => r.direction === 'bidirectional');

    return NextResponse.json({
      downstream: [...downstreamRows, ...bidiFromUpstream].map(mapRow),
      upstream:   [...upstreamRows,   ...bidiFromDownstream].map(mapRow),
    });
  } catch (err) {
    console.error("[GET /api/assets/:id/dependencies]", err);
    return NextResponse.json({ error: "Failed to load dependencies." }, { status: 500 });
  }
}
