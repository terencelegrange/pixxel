import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

const VALID_PERMISSION_LEVELS = ["read-only", "member", "admin"] as const;
type PermissionLevel = typeof VALID_PERMISSION_LEVELS[number];

function rowToRole(row: mysql.RowDataPacket) {
  const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
  return {
    id:              row.id,
    name:            row.name,
    description:     row.description     ?? null,
    permissionLevel: row.permission_level,
    createdById:     row.created_by_id,
    createdByName:   row.created_by_name,
    createdAt:       toISO(row.created_at)!,
    updatedAt:       toISO(row.updated_at)!,
  };
}

// GET /api/roles — Admin only
export async function GET(req: NextRequest) {
  const auth = requireUser(req, "Admin");
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM roles ORDER BY name ASC"
    );
    return NextResponse.json({ roles: rows.map(rowToRole) });
  } catch (err) {
    logger.error({ err, route: "GET /api/roles" }, "request failed");
    return NextResponse.json({ error: "Failed to load roles." }, { status: 500 });
  }
}

// POST /api/roles
export async function POST(req: NextRequest) {
  const auth = requireUser(req, "Admin");
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, description, permissionLevel } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Role name is required." }, { status: 400 });
    if (!permissionLevel || !VALID_PERMISSION_LEVELS.includes(permissionLevel as PermissionLevel)) {
      return NextResponse.json(
        { error: "permissionLevel must be one of: read-only, member, admin." },
        { status: 400 }
      );
    }

    const db = getDb();
    const id = randomUUID();
    const values = {
      name:            name.trim(),
      description:     description?.trim() || null,
      permissionLevel: permissionLevel as PermissionLevel,
    };

    await db.execute(
      `INSERT INTO roles
         (id, name, description, permission_level, created_by_id, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, values.name, values.description, values.permissionLevel, user.id, user.name]
    );

    await writeAudit({
      tableName: "roles", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null, newValues: values,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: "POST /api/roles" }, "request failed");
    return NextResponse.json({ error: "Failed to create role." }, { status: 500 });
  }
}
