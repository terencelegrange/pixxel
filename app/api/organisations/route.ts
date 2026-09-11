import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { Department } from "@/types";
import { requireUser } from "@/lib/require-user";

function rowToDepartment(row: mysql.RowDataPacket): Department {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    status: row.status as "Published" | "Unpublished",
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

// GET /api/organisations — list all departments
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM departments ORDER BY name ASC"
    );
    return NextResponse.json({ departments: rows.map(rowToDepartment) });
  } catch (err) {
    logger.error({ err, route: "GET /api/organisations" }, "request failed");
    return NextResponse.json({ error: "Failed to load departments." }, { status: 500 });
  }
}

// POST /api/organisations — create a department
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();

    const body = await req.json();
    const { name, description, status } = body as {
      name?: string;
      description?: string;
      status?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Department name is required." }, { status: 400 });
    }

    const db = getDb();

    // Check uniqueness
    const [existing] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM departments WHERE name = ? LIMIT 1",
      [name.trim()]
    );
    if ((existing as mysql.RowDataPacket[]).length > 0) {
      return NextResponse.json({ error: "A department with this name already exists." }, { status: 409 });
    }

    const id = randomUUID();
    const trimmedName = name.trim();
    const trimmedDesc = description?.trim() || null;
    const resolvedStatus = status === "Published" ? "Published" : "Unpublished";

    await db.execute(
      `INSERT INTO departments (id, name, description, status, created_by_id, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, trimmedName, trimmedDesc, resolvedStatus, user.id, user.name]
    );

    const newDept: Department = {
      id,
      name: trimmedName,
      description: trimmedDesc,
      status: resolvedStatus,
      createdById: user.id,
      createdByName: user.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await writeAudit({
      tableName: "departments",
      recordId: id,
      action: "CREATE",
      performedById: user.id,
      performedByName: user.name,
      oldValues: null,
      newValues: { name: trimmedName, description: trimmedDesc, status: resolvedStatus },
    });

    return NextResponse.json({ department: newDept }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: "POST /api/organisations" }, "request failed");
    return NextResponse.json({ error: "Failed to create department." }, { status: 500 });
  }
}
