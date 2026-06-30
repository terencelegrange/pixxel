import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

const VALID_PERMISSION_LEVELS = ["read-only", "member", "admin"] as const;
type PermissionLevel = typeof VALID_PERMISSION_LEVELS[number];

// PUT /api/roles/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireUser(req);
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
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM roles WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Role not found." }, { status: 404 });

    const values = {
      name:            name.trim(),
      description:     description?.trim() || null,
      permissionLevel: permissionLevel as PermissionLevel,
    };

    await db.execute(
      `UPDATE roles SET name=?, description=?, permission_level=? WHERE id=?`,
      [values.name, values.description, values.permissionLevel, params.id]
    );

    await writeAudit({
      tableName: "roles", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: {
        name:            current.name,
        description:     current.description,
        permissionLevel: current.permission_level,
      },
      newValues: values,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PUT /api/roles/:id]", err);
    return NextResponse.json({ error: "Failed to update role." }, { status: 500 });
  }
}

// DELETE /api/roles/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM roles WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Role not found." }, { status: 404 });

    const [usersWithRole] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM users WHERE role_id = ? LIMIT 1", [params.id]
    );
    if (usersWithRole.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete a role that is assigned to users." },
        { status: 400 }
      );
    }

    await db.execute("DELETE FROM roles WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "roles", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, permissionLevel: current.permission_level },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/roles/:id]", err);
    return NextResponse.json({ error: "Failed to delete role." }, { status: 500 });
  }
}
