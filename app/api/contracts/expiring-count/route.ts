import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { requireUser } from "@/lib/require-user";
import { isExpiringWithin } from "@/lib/contracts";

// GET /api/contracts/expiring-count?days=90
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const days = Number(req.nextUrl.searchParams.get("days") ?? "90");

    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT status, end_date, notice_period_days, auto_renews FROM contracts WHERE status = 'Active' AND end_date IS NOT NULL"
    );

    const count = rows.filter((r) =>
      isExpiringWithin(
        { status: r.status, endDate: r.end_date, noticePeriodDays: r.notice_period_days, autoRenews: !!r.auto_renews },
        days
      )
    ).length;

    return NextResponse.json({ count });
  } catch (err) {
    logger.error({ err, route: "GET /api/contracts/expiring-count" }, "request failed");
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}
