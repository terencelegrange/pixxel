import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

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
export async function GET() {
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(`
      SELECT rf.*, GROUP_CONCAT(rfc.category ORDER BY rfc.category) AS categories
      FROM risk_factors rf
      LEFT JOIN risk_factor_categories rfc ON rfc.risk_factor_id = rf.id
      GROUP BY rf.id
      ORDER BY rf.kind ASC, rf.name ASC
    `);
    return NextResponse.json({ riskFactors: rows.map(rowToRiskFactor) });
  } catch (err) {
    console.error("[GET /api/risk-factors]", err);
    return NextResponse.json({ error: "Failed to load risk factors." }, { status: 500 });
  }
}

// POST /api/risk-factors
export async function POST(req: NextRequest) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, description, kind, severity, likelihood, impact, categories, userId, userName } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!VALID_KINDS.includes(kind as Kind))
      return NextResponse.json({ error: "kind must be Attribute or Characteristic." }, { status: 400 });
    for (const [field, value] of [["severity", severity], ["likelihood", likelihood], ["impact", impact]] as const) {
      if (!VALID_LEVELS.includes(value as Level))
        return NextResponse.json({ error: `${field} must be one of: Low, Medium, High, Critical.` }, { status: 400 });
    }
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

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
      [id, values.name, values.description, values.kind, values.severity, values.likelihood, values.impact, userId, userName]
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
      performedById: userId, performedByName: userName,
      oldValues: null, newValues: { ...values, categories: categoryList },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/risk-factors]", err);
    return NextResponse.json({ error: "Failed to create risk factor." }, { status: 500 });
  }
}
