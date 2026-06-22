import { NextResponse } from "next/server";
import { getDb, setupDatabase } from "@/lib/db";
import mysql from "mysql2/promise";

export async function GET() {
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM departments)     AS departments,
        (SELECT COUNT(*) FROM domains)         AS domains,
        (SELECT COUNT(*) FROM asset_strategies) AS strategies,
        (SELECT COUNT(*) FROM tiers)           AS tiers,
        (SELECT COUNT(*) FROM vendors)         AS vendors
    `);
    const row = rows[0];
    return NextResponse.json({
      departments: Number(row.departments),
      domains:     Number(row.domains),
      strategies:  Number(row.strategies),
      tiers:       Number(row.tiers),
      vendors:     Number(row.vendors),
    });
  } catch (err) {
    console.error("[GET /api/get-started]", err);
    return NextResponse.json({ error: "Failed to load setup status." }, { status: 500 });
  }
}
