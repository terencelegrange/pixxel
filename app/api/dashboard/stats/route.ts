import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { requireUser } from "@/lib/require-user";

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();

    const [[deptRows], [lifecycleRows], [tierRows], [projectRows], [strategyRows]] = await Promise.all([
      db.execute<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM departments WHERE status = 'Published'"
      ),
      db.execute<mysql.RowDataPacket[]>(
        "SELECT lifecycle_status AS status, COUNT(*) AS count FROM assets GROUP BY lifecycle_status ORDER BY FIELD(lifecycle_status,'Proposed','Approved','In Development','Production','Sunset','Retired')"
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

    return NextResponse.json({
      publishedDepartments: deptRows[0].count as number,
      activeProjects: Number(projectRows[0].count),
      assetsByLifecycle,
      assetsByTier,
      assetsByStrategy,
    });
  } catch (err) {
    console.error("[GET /api/dashboard/stats]", err);
    return NextResponse.json({ publishedDepartments: 0, assetsByLifecycle: [] }, { status: 500 });
  }
}
