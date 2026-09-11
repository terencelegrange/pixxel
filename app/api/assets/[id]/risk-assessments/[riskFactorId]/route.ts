import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";
import logger from "@/lib/logger";

const VALID_STATUSES = ["Met", "Not Met", "Partial"] as const;
type Status = typeof VALID_STATUSES[number];

// PUT /api/assets/[id]/risk-assessments/[riskFactorId] — upsert a single assessment
export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string; riskFactorId: string }> }
) {
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    const params = await props.params;
    await setupDatabase();
    const body = await req.json();
    const { status, notes } = body;

    if (!VALID_STATUSES.includes(status as Status))
      return NextResponse.json({ error: "status must be one of: Met, Not Met, Partial." }, { status: 400 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM asset_risk_assessments WHERE asset_id = ? AND risk_factor_id = ? LIMIT 1",
      [params.id, params.riskFactorId]
    );
    const current = rows[0];
    const values = { status: status as Status, notes: notes?.trim() || null };

    if (current) {
      await db.execute(
        `UPDATE asset_risk_assessments
         SET status = ?, notes = ?, assessed_by_id = ?, assessed_by_name = ?, assessed_at = CURRENT_TIMESTAMP
         WHERE asset_id = ? AND risk_factor_id = ?`,
        [values.status, values.notes, user.id, user.name, params.id, params.riskFactorId]
      );
      await writeAudit({
        tableName: "asset_risk_assessments", recordId: current.id, action: "UPDATE",
        performedById: user.id, performedByName: user.name,
        oldValues: { status: current.status, notes: current.notes },
        newValues: values,
      });
    } else {
      const id = randomUUID();
      await db.execute(
        `INSERT INTO asset_risk_assessments
           (id, asset_id, risk_factor_id, status, notes, assessed_by_id, assessed_by_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, params.id, params.riskFactorId, values.status, values.notes, user.id, user.name]
      );
      await writeAudit({
        tableName: "asset_risk_assessments", recordId: id, action: "CREATE",
        performedById: user.id, performedByName: user.name,
        oldValues: null, newValues: values,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/assets/:id/risk-assessments/:riskFactorId" }, "request failed");
    return NextResponse.json({ error: "Failed to save assessment." }, { status: 500 });
  }
}
