import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

// PUT /api/profile — update the current user's name and/or email
export async function PUT(req: NextRequest) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, email } = body as { name?: string; email?: string };

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!email?.trim()) return NextResponse.json({ error: "Email is required." }, { status: 400 });

    const normalizedEmail = email.trim().toLowerCase();

    const db = getDb();

    // Fetch current row for audit + change detection
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id, name, email FROM users WHERE id = ? LIMIT 1", [user.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "User not found." }, { status: 404 });

    // Check email uniqueness if it changed
    if (normalizedEmail !== current.email) {
      const [conflict] = await db.execute<mysql.RowDataPacket[]>(
        "SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1",
        [normalizedEmail, user.id]
      );
      if ((conflict as mysql.RowDataPacket[]).length > 0) {
        return NextResponse.json({ error: "That email address is already in use." }, { status: 409 });
      }
    }

    const trimmedName = name.trim();
    const initials = trimmedName
      .split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    await db.execute(
      "UPDATE users SET name = ?, email = ? WHERE id = ?",
      [trimmedName, normalizedEmail, user.id]
    );

    await writeAudit({
      tableName: "users", recordId: user.id, action: "UPDATE",
      performedById: user.id, performedByName: trimmedName,
      oldValues: { name: current.name, email: current.email },
      newValues: { name: trimmedName, email: normalizedEmail },
    });

    // Return the updated user fields so the client can refresh its auth state
    return NextResponse.json({
      user: {
        id: user.id,
        name: trimmedName,
        email: normalizedEmail,
        avatarInitials: initials,
      },
    });
  } catch (err) {
    console.error("[PUT /api/profile]", err);
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
