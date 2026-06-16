import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { User } from "@/types";

interface DbUserRow {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  created_at: Date;
}

export async function POST(req: NextRequest) {
  try {
    await setupDatabase();

    const body = await req.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id, name, email, password, role, created_at FROM users WHERE email = ? LIMIT 1",
      [email.toLowerCase().trim()]
    );

    const row = rows[0] as DbUserRow | undefined;

    // Compare even if user not found (constant-time to prevent user enumeration)
    const hash = row?.password ?? "$2a$12$invalidhashforenumerationprevention";
    const match = await bcrypt.compare(password, hash);

    if (!row || !match) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const user: User = {
      id: row.id,
      name: row.name,
      email: row.email,
      avatarInitials: row.name
        .split(" ")
        .map((p: string) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2),
      role: row.role,
      createdAt: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    };

    return NextResponse.json({ user }, { status: 200 });
  } catch (err) {
    console.error("[/api/auth/login]", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
