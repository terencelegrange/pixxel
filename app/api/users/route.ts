import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";
import { validate } from "@/lib/validate";
import { CreateUserSchema } from "@/lib/schemas";

// GET /api/users — list all users (Admin only)
export async function GET(req: NextRequest) {
  const auth = requireUser(req, "Admin");
  if (!auth.ok) return auth.response;
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
    logger.error({ err, route: "GET /api/users" }, "request failed");
    return NextResponse.json({ error: "Failed to load users." }, { status: 500 });
  }
}

// POST /api/users — create a new user (Admin only)
export async function POST(req: NextRequest) {
  const auth = requireUser(req, "Admin");
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const v = await validate(req, CreateUserSchema);
    if (!v.ok) return v.response;
    const { name, email, password, role } = v.data;

    const db = getDb();

    const [existing] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ? LIMIT 1", [email]
    );
    if ((existing as mysql.RowDataPacket[]).length > 0)
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });

    const id = randomUUID();
    const hashed = await bcrypt.hash(password, 12);

    await db.execute(
      "INSERT INTO users (id, name, email, password, role, created_at, updated_at) VALUES (?,?,?,?,?, NOW(), NOW())",
      [id, name, email, hashed, role]
    );

    await writeAudit({
      tableName: "users", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null,
      newValues: { name, email, role },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: "POST /api/users" }, "request failed");
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
  }
}
