import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";
import logger from "@/lib/logger";

const VALID_KINDS = ["Attribute", "Characteristic"] as const;
const VALID_LEVELS = ["Low", "Medium", "High", "Critical"] as const;
type Kind = typeof VALID_KINDS[number];
type Level = typeof VALID_LEVELS[number];

// PUT /api/risk-factors/[id]
export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    const params = await props.params;
    await setupDatabase();
    const body = await req.json();
    const { name, description, kind, severity, likelihood, impact, categories } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!VALID_KINDS.includes(kind as Kind))
      return NextResponse.json({ error: "kind must be Attribute or Characteristic." }, { status: 400 });
    for (const [field, value] of [["severity", severity], ["likelihood", likelihood], ["impact", impact]] as const) {
      if (!VALID_LEVELS.includes(value as Level))
        return NextResponse.json({ error: `${field} must be one of: Low, Medium, High, Critical.` }, { status: 400 });
    }

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM risk_factors WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Risk factor not found." }, { status: 404 });

    const values = {
      name:        name.trim(),
      description: description?.trim() || null,
      kind:        kind as Kind,
      severity:    severity as Level,
      likelihood:  likelihood as Level,
      impact:      impact as Level,
    };

    await db.execute(
      `UPDATE risk_factors SET name=?, description=?, kind=?, severity=?, likelihood=?, impact=? WHERE id=?`,
      [values.name, values.description, values.kind, values.severity, values.likelihood, values.impact, params.id]
    );

    const categoryList: string[] = Array.isArray(categories) ? categories : [];
    await db.execute("DELETE FROM risk_factor_categories WHERE risk_factor_id = ?", [params.id]);
    for (const category of categoryList) {
      await db.execute(
        "INSERT INTO risk_factor_categories (risk_factor_id, category) VALUES (?, ?)",
        [params.id, category]
      );
    }

    await writeAudit({
      tableName: "risk_factors", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: {
        name: current.name, description: current.description, kind: current.kind,
        severity: current.severity, likelihood: current.likelihood, impact: current.impact,
      },
      newValues: { ...values, categories: categoryList },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/risk-factors/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to update risk factor." }, { status: 500 });
  }
}

// DELETE /api/risk-factors/[id]
export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    const params = await props.params;
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM risk_factors WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Risk factor not found." }, { status: 404 });

    await db.execute("DELETE FROM risk_factor_categories WHERE risk_factor_id = ?", [params.id]);
    await db.execute("DELETE FROM asset_risk_assessments WHERE risk_factor_id = ?", [params.id]);
    await db.execute("DELETE FROM risk_factors WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "risk_factors", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, kind: current.kind },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/risk-factors/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to delete risk factor." }, { status: 500 });
  }
}
