import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { Department } from "@/types";

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
export async function GET() {
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM departments ORDER BY name ASC"
    );
    return NextResponse.json({ departments: rows.map(rowToDepartment) });
  } catch (err) {
    console.error("[GET /api/organisations]", err);
    return NextResponse.json({ error: "Failed to load departments." }, { status: 500 });
  }
}

// POST /api/organisations — create a department
export async function POST(req: NextRequest) {
  try {
    await setupDatabase();

    const body = await req.json();
    const { name, description, status, userId, userName } = body as {
      name?: string;
      description?: string;
      status?: string;
      userId?: string;
      userName?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Department name is required." }, { status: 400 });
    }
    if (!userId || !userName) {
      return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });
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
      [id, trimmedName, trimmedDesc, resolvedStatus, userId, userName]
    );

    const newDept: Department = {
      id,
      name: trimmedName,
      description: trimmedDesc,
      status: resolvedStatus,
      createdById: userId,
      createdByName: userName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await writeAudit({
      tableName: "departments",
      recordId: id,
      action: "CREATE",
      performedById: userId,
      performedByName: userName,
      oldValues: null,
      newValues: { name: trimmedName, description: trimmedDesc, status: resolvedStatus },
    });

    return NextResponse.json({ department: newDept }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/organisations]", err);
    return NextResponse.json({ error: "Failed to create department." }, { status: 500 });
  }
}
