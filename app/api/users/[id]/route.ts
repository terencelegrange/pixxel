import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

const VALID_ROLES = ["Admin", "Member", "Viewer"];

// PUT /api/users/[id] — update name and/or role
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, role, userId, userName } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "User not found." }, { status: 404 });

    const trimmedName = name.trim();
    await db.execute(
      "UPDATE users SET name = ?, role = ? WHERE id = ?",
      [trimmedName, role, params.id]
    );

    await writeAudit({
      tableName: "users", recordId: params.id, action: "UPDATE",
      performedById: userId, performedByName: userName,
      oldValues: { name: current.name, role: current.role },
      newValues: { name: trimmedName, role },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PUT /api/users/:id]", err);
    return NextResponse.json({ error: "Failed to update user." }, { status: 500 });
  }
}

// DELETE /api/users/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const { userId, userName } = await req.json() as { userId?: string; userName?: string };
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });
    if (params.id === userId) return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "User not found." }, { status: 404 });

    await db.execute("DELETE FROM users WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "users", recordId: params.id, action: "DELETE",
      performedById: userId, performedByName: userName,
      oldValues: { name: current.name, email: current.email, role: current.role },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/users/:id]", err);
    return NextResponse.json({ error: "Failed to delete user." }, { status: 500 });
  }
}
