import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";
import logger from "@/lib/logger";

const VALID_KINDS = ["Attribute", "Characteristic"] as const;
const VALID_LEVELS = ["Low", "Medium", "High", "Critical"] as const;
type Kind = typeof VALID_KINDS[number];
type Level = typeof VALID_LEVELS[number];

function rowToRiskFactor(row: mysql.RowDataPacket) {
  const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
  return {
    id:            row.id,
    name:          row.name,
    description:   row.description ?? null,
    kind:          row.kind,
    severity:      row.severity,
    likelihood:    row.likelihood,
    impact:        row.impact,
    categories:    row.categories ? String(row.categories).split(",") : [],
    createdById:   row.created_by_id,
    createdByName: row.created_by_name,
    createdAt:     toISO(row.created_at)!,
    updatedAt:     toISO(row.updated_at)!,
  };
}

// GET /api/risk-factors
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    // Correlated subquery instead of GROUP_CONCAT(... ORDER BY ... SEPARATOR ...)
    // — the SEPARATOR/ORDER BY form is MySQL-only; this shape works on both
    // MySQL and SQLite (see app/api/assets/route.ts for the same pattern).
    const [rows] = await db.execute<mysql.RowDataPacket[]>(`
      SELECT rf.*,
        (SELECT GROUP_CONCAT(category, ',') FROM (
          SELECT rfc.category AS category FROM risk_factor_categories rfc
          WHERE rfc.risk_factor_id = rf.id ORDER BY rfc.category
        )) AS categories
      FROM risk_factors rf
      ORDER BY rf.kind ASC, rf.name ASC
    `);
    return NextResponse.json({ riskFactors: rows.map(rowToRiskFactor) });
  } catch (err) {
    logger.error({ err, route: "GET /api/risk-factors" }, "request failed");
    return NextResponse.json({ error: "Failed to load risk factors." }, { status: 500 });
  }
}

// POST /api/risk-factors
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
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
    const id = randomUUID();
    const values = {
      name:        name.trim(),
      description: description?.trim() || null,
      kind:        kind as Kind,
      severity:    severity as Level,
      likelihood:  likelihood as Level,
      impact:      impact as Level,
    };

    await db.execute(
      `INSERT INTO risk_factors
         (id, name, description, kind, severity, likelihood, impact, created_by_id, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, values.name, values.description, values.kind, values.severity, values.likelihood, values.impact, user.id, user.name]
    );

    const categoryList: string[] = Array.isArray(categories) ? categories : [];
    for (const category of categoryList) {
      await db.execute(
        "INSERT INTO risk_factor_categories (risk_factor_id, category) VALUES (?, ?)",
        [id, category]
      );
    }

    await writeAudit({
      tableName: "risk_factors", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null, newValues: { ...values, categories: categoryList },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: "POST /api/risk-factors" }, "request failed");
    return NextResponse.json({ error: "Failed to create risk factor." }, { status: 500 });
  }
}
