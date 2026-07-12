import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { requireUser } from "@/lib/require-user";
import { isExpiringWithin } from "@/lib/contracts";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();

    const [[deptRows], [lifecycleRows], [tierRows], [projectRows], [strategyRows], [contractRows]] = await Promise.all([
      db.execute<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM departments WHERE status = 'Published'"
      ),
      db.execute<mysql.RowDataPacket[]>(
        `SELECT lifecycle_status AS status, COUNT(*) AS count FROM assets
         GROUP BY lifecycle_status
         ORDER BY CASE lifecycle_status
           WHEN 'Proposed' THEN 1
           WHEN 'Approved' THEN 2
           WHEN 'In Development' THEN 3
           WHEN 'Production' THEN 4
           WHEN 'Sunset' THEN 5
           WHEN 'Retired' THEN 6
           ELSE 7
         END`
      ),
      db.execute<mysql.RowDataPacket[]>(
        `SELECT COALESCE(t.name, 'Unassigned') AS tier, COUNT(*) AS count
         FROM assets a
         LEFT JOIN tiers t ON t.id = a.tier_id
         GROUP BY a.tier_id, t.name
         ORDER BY t.name IS NULL ASC, t.name ASC`
      ),
      db.execute<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM projects WHERE status = 'Active'"
      ),
      db.execute<mysql.RowDataPacket[]>(
        `SELECT COALESCE(s.name, 'Unassigned') AS strategy, COUNT(*) AS count
         FROM assets a
         LEFT JOIN asset_strategies s ON s.id = a.strategy_id
         GROUP BY a.strategy_id, s.name
         ORDER BY s.sort_order IS NULL ASC, s.sort_order ASC, s.name ASC`
      ),
      db.execute<mysql.RowDataPacket[]>(
        "SELECT status, end_date, notice_period_days, auto_renews FROM contracts WHERE status = 'Active' AND end_date IS NOT NULL"
      ),
    ]);

    const assetsByLifecycle = lifecycleRows.map((r) => ({
      status: r.status as string,
      count: Number(r.count),
    }));

    const assetsByTier = tierRows.map((r) => ({
      tier: r.tier as string,
      count: Number(r.count),
    }));

    const assetsByStrategy = strategyRows.map((r) => ({
      strategy: r.strategy as string,
      count: Number(r.count),
    }));

    const expiringContracts30d = contractRows.filter((r) =>
      isExpiringWithin(
        { status: r.status, endDate: r.end_date, noticePeriodDays: r.notice_period_days, autoRenews: !!r.auto_renews },
        30
      )
    ).length;

    return NextResponse.json({
      publishedDepartments: deptRows[0].count as number,
      activeProjects: Number(projectRows[0].count),
      assetsByLifecycle,
      assetsByTier,
      assetsByStrategy,
      expiringContracts30d,
    });
  } catch (err) {
    logger.error({ err, route: "GET /api/dashboard/stats" }, "request failed");
    return NextResponse.json({ publishedDepartments: 0, assetsByLifecycle: [], expiringContracts30d: 0 }, { status: 500 });
  }
}
