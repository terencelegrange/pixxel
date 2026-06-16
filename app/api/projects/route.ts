import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

const VALID_STATUSES = ["Active", "On Hold", "Completed", "Cancelled"] as const;

// GET /api/projects — list all projects with asset count
export async function GET() {
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(`
      SELECT p.id, p.name, p.description, p.status,
             p.start_date, p.end_date,
             p.created_by_id, p.created_by_name,
             p.created_at, p.updated_at,
             COUNT(pa.asset_id) AS asset_count
      FROM projects p
      LEFT JOIN project_assets pa ON pa.project_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
    const toDate = (v: unknown) => v instanceof Date ? v.toISOString().split("T")[0] : v ? String(v).split("T")[0] : null;
    const projects = rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      status: r.status,
      startDate: toDate(r.start_date),
      endDate: toDate(r.end_date),
      assetCount: Number(r.asset_count),
      createdById: r.created_by_id,
      createdByName: r.created_by_name,
      createdAt: toISO(r.created_at)!,
      updatedAt: toISO(r.updated_at)!,
    }));
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("[GET /api/projects]", err);
    return NextResponse.json({ error: "Failed to load projects." }, { status: 500 });
  }
}

// POST /api/projects — create project
export async function POST(req: NextRequest) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, description, status, startDate, endDate, userId, userName } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (status && !VALID_STATUSES.includes(status))
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    if (!userId || !userName)
      return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const id = randomUUID();
    const trimmedName = name.trim();
    const resolvedStatus = status ?? "Active";

    const db = getDb();
    await db.execute(
      `INSERT INTO projects (id, name, description, status, start_date, end_date, created_by_id, created_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, trimmedName, description?.trim() || null, resolvedStatus, startDate || null, endDate || null, userId, userName]
    );

    await writeAudit({
      tableName: "projects", recordId: id, action: "CREATE",
      performedById: userId, performedByName: userName,
      oldValues: null,
      newValues: { name: trimmedName, status: resolvedStatus, startDate: startDate || null, endDate: endDate || null },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/projects]", err);
    return NextResponse.json({ error: "Failed to create project." }, { status: 500 });
  }
}
