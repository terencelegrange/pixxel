import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

// GET /api/risk-factor-mappings?category=Application
export async function GET(req: NextRequest) {
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
    console.error("[GET /api/risk-factor-mappings]", err);
    return NextResponse.json({ error: "Failed to load category mapping." }, { status: 500 });
  }
}

// PUT /api/risk-factor-mappings — replace the full set of risk factors mapped to a category
export async function PUT(req: NextRequest) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { category, riskFactorIds, userId, userName } = body;

    if (!category?.trim()) return NextResponse.json({ error: "category is required." }, { status: 400 });
    if (!Array.isArray(riskFactorIds)) return NextResponse.json({ error: "riskFactorIds must be an array." }, { status: 400 });
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

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
      performedById: userId, performedByName: userName,
      oldValues: { riskFactorIds: before.map((r) => r.risk_factor_id) },
      newValues: { riskFactorIds },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PUT /api/risk-factor-mappings]", err);
    return NextResponse.json({ error: "Failed to update category mapping." }, { status: 500 });
  }
}
