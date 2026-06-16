import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

// GET /api/users — list all users (password excluded)
export async function GET() {
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT id, name, email, role, created_at, updated_at
       FROM users
       ORDER BY name ASC`
    );
    const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
    const users = rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      avatarInitials: r.name.split(" ").map((p: string) => p[0]).join("").toUpperCase().slice(0, 2),
      createdAt: toISO(r.created_at)!,
      updatedAt: toISO(r.updated_at)!,
    }));
    return NextResponse.json({ users });
  } catch (err) {
    console.error("[GET /api/users]", err);
    return NextResponse.json({ error: "Failed to load users." }, { status: 500 });
  }
}

// POST /api/users — create a new user (admin only by convention)
export async function POST(req: NextRequest) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, email, password, role, userId, userName } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!email?.trim()) return NextResponse.json({ error: "Email is required." }, { status: 400 });
    if (!password || password.length < 8)
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    if (!["Admin", "Member", "Viewer"].includes(role))
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    if (!userId || !userName)
      return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const normalizedEmail = email.trim().toLowerCase();

    const [existing] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ? LIMIT 1", [normalizedEmail]
    );
    if ((existing as mysql.RowDataPacket[]).length > 0)
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });

    const id = randomUUID();
    const hashed = await bcrypt.hash(password, 12);
    const trimmedName = name.trim();

    await db.execute(
      "INSERT INTO users (id, name, email, password, role, created_at, updated_at) VALUES (?,?,?,?,?, NOW(), NOW())",
      [id, trimmedName, normalizedEmail, hashed, role]
    );

    await writeAudit({
      tableName: "users", recordId: id, action: "CREATE",
      performedById: userId, performedByName: userName,
      oldValues: null,
      newValues: { name: trimmedName, email: normalizedEmail, role },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/users]", err);
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
  }
}
