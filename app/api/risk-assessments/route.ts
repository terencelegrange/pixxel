import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { requireUser } from "@/lib/require-user";
import logger from "@/lib/logger";

// GET /api/risk-assessments — all assessment rows, for client-side reporting joins
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT asset_id, risk_factor_id, status FROM asset_risk_assessments"
    );
    return NextResponse.json({
      assessments: rows.map((r) => ({
        assetId:      r.asset_id,
        riskFactorId: r.risk_factor_id,
        status:       r.status,
      })),
    });
  } catch (err) {
    logger.error({ err, route: "GET /api/risk-assessments" }, "request failed");
    return NextResponse.json({ error: "Failed to load risk assessments." }, { status: 500 });
  }
}
