import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";
import logger from "@/lib/logger";

// GET /api/risk-factor-mappings?category=Application
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const category = req.nextUrl.searchParams.get("category");
    if (!category) return NextResponse.json({ error: "category query param is required." }, { status: 400 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT risk_factor_id FROM risk_factor_categories WHERE category = ?", [category]
    );
    return NextResponse.json({ riskFactorIds: rows.map((r) => r.risk_factor_id) });
  } catch (err) {
    logger.error({ err, route: "GET /api/risk-factor-mappings" }, "request failed");
    return NextResponse.json({ error: "Failed to load category mapping." }, { status: 500 });
  }
}

// PUT /api/risk-factor-mappings — replace the full set of risk factors mapped to a category
export async function PUT(req: NextRequest) {
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const { category, riskFactorIds } = body;

    if (!category?.trim()) return NextResponse.json({ error: "category is required." }, { status: 400 });
    if (!Array.isArray(riskFactorIds)) return NextResponse.json({ error: "riskFactorIds must be an array." }, { status: 400 });

    const db = getDb();
    const [before] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT risk_factor_id FROM risk_factor_categories WHERE category = ?", [category]
    );

    await db.execute("DELETE FROM risk_factor_categories WHERE category = ?", [category]);
    for (const riskFactorId of riskFactorIds) {
      await db.execute(
        "INSERT INTO risk_factor_categories (risk_factor_id, category) VALUES (?, ?)",
        [riskFactorId, category]
      );
    }

    await writeAudit({
      tableName: "risk_factor_categories", recordId: category, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: { riskFactorIds: before.map((r) => r.risk_factor_id) },
      newValues: { riskFactorIds },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/risk-factor-mappings" }, "request failed");
    return NextResponse.json({ error: "Failed to update category mapping." }, { status: 500 });
  }
}
