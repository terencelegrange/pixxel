import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

const VALID_STATUSES = ["Active", "On Hold", "Completed", "Cancelled"] as const;
type ProjectStatus = typeof VALID_STATUSES[number];

// PUT /api/projects/[id]
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, description, status, startDate, endDate } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!VALID_STATUSES.includes(status as ProjectStatus))
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id, name, description, status, start_date, end_date FROM projects WHERE id = ? LIMIT 1",
      [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    const trimmedName = name.trim();
    await db.execute(
      "UPDATE projects SET name = ?, description = ?, status = ?, start_date = ?, end_date = ? WHERE id = ?",
      [trimmedName, description?.trim() || null, status, startDate || null, endDate || null, params.id]
    );

    await writeAudit({
      tableName: "projects", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, status: current.status },
      newValues: { name: trimmedName, status },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/projects/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to update project." }, { status: 500 });
  }
}

// DELETE /api/projects/[id]
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id, name FROM projects WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    await db.execute("DELETE FROM project_assets WHERE project_id = ?", [params.id]);
    await db.execute("DELETE FROM projects WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "projects", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/projects/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to delete project." }, { status: 500 });
  }
}
