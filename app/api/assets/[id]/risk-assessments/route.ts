import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { requireUser } from "@/lib/require-user";
import logger from "@/lib/logger";

function rowToAssessedRiskFactor(row: mysql.RowDataPacket) {
  const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
  return {
    id:            row.id,
    name:          row.name,
    description:   row.description ?? null,
    kind:          row.kind,
    severity:      row.severity,
    likelihood:    row.likelihood,
    impact:        row.impact,
    status:        row.status ?? "Not Met",
    notes:         row.notes ?? null,
    assessedById:   row.assessed_by_id ?? null,
    assessedByName: row.assessed_by_name ?? null,
    assessedAt:     toISO(row.assessed_at),
  };
}

// GET /api/assets/[id]/risk-assessments — risk factors mapped to this asset's category,
// joined with any existing assessment (defaults to "Not Met" when unassessed)
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    const params = await props.params;
    await setupDatabase();
    const db = getDb();

    const [assetRows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT category FROM assets WHERE id = ? LIMIT 1", [params.id]
    );
    const asset = assetRows[0];
    if (!asset) return NextResponse.json({ error: "Asset not found." }, { status: 404 });

    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT rf.*, ara.status, ara.notes, ara.assessed_by_id, ara.assessed_by_name, ara.assessed_at
       FROM risk_factors rf
       JOIN risk_factor_categories rfc ON rfc.risk_factor_id = rf.id AND rfc.category = ?
       LEFT JOIN asset_risk_assessments ara ON ara.risk_factor_id = rf.id AND ara.asset_id = ?
       ORDER BY rf.kind ASC, rf.name ASC`,
      [asset.category, params.id]
    );

    return NextResponse.json({ riskFactors: rows.map(rowToAssessedRiskFactor) });
  } catch (err) {
    logger.error({ err, route: "GET /api/assets/:id/risk-assessments" }, "request failed");
    return NextResponse.json({ error: "Failed to load risk assessments." }, { status: 500 });
  }
}
