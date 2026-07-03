import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

const VALID_ROLES = ["Admin", "Member", "Viewer"];

// PUT /api/users/[id] — update name and/or role (Admin only)
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, "Admin");
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, role } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "User not found." }, { status: 404 });

    const trimmedName = name.trim();
    // Bump token_version when the role actually changes so the user's existing
    // sessions are invalidated immediately instead of keeping the old role
    // until their JWT naturally expires.
    const roleChanged = role !== current.role;
    await db.execute(
      roleChanged
        ? "UPDATE users SET name = ?, role = ?, token_version = token_version + 1 WHERE id = ?"
        : "UPDATE users SET name = ?, role = ? WHERE id = ?",
      [trimmedName, role, params.id]
    );

    await writeAudit({
      tableName: "users", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, role: current.role },
      newValues: { name: trimmedName, role },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/users/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to update user." }, { status: 500 });
  }
}

// DELETE /api/users/[id] (Admin only)
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, "Admin");
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    if (params.id === user.id) return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "User not found." }, { status: 404 });

    await db.execute("DELETE FROM users WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "users", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, email: current.email, role: current.role },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/users/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to delete user." }, { status: 500 });
  }
}
