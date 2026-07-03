import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { requireUser } from "@/lib/require-user";

// GET /api/assets/[id]/projects — active projects that include this asset
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(`
      SELECT p.id, p.name, p.status, p.start_date, p.end_date,
             pa.dependency_type, pa.notes
      FROM project_assets pa
      JOIN projects p ON p.id = pa.project_id
      WHERE pa.asset_id = ? AND p.status = 'Active'
      ORDER BY p.name ASC
    `, [params.id]);

    const toDate = (v: unknown) =>
      v instanceof Date ? v.toISOString().split("T")[0] : v ? String(v).split("T")[0] : null;

    const projects = rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      startDate: toDate(r.start_date),
      endDate: toDate(r.end_date),
      dependencyType: r.dependency_type,
      notes: r.notes ?? null,
    }));

    return NextResponse.json({ projects });
  } catch (err) {
    logger.error({ err, route: "GET /api/assets/:id/projects" }, "request failed");
    return NextResponse.json({ error: "Failed to load projects." }, { status: 500 });
  }
}
