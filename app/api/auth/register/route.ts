import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getDb, setupDatabase } from "@/lib/db";
import { User } from "@/types";
import mysql from "mysql2/promise";

// bcrypt work factor — 12 is a good balance of security vs. latency
const SALT_ROUNDS = 12;

export async function POST(req: NextRequest) {
  try {
    await setupDatabase();

    const body = await req.json();
    const { name, email, password } = body as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!name?.trim() || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const db = getDb();
    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing account
    const [existing] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [normalizedEmail]
    );

    if ((existing as mysql.RowDataPacket[]).length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const id = randomUUID();
    const trimmedName = name.trim();
    const initials = trimmedName
      .split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    await db.execute(
      `INSERT INTO users (id, name, email, password, role)
       VALUES (?, ?, ?, ?, ?)`,
      [id, trimmedName, normalizedEmail, passwordHash, "Member"]
    );

    const user: User = {
      id,
      name: trimmedName,
      email: normalizedEmail,
      avatarInitials: initials,
      role: "Member",
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    console.error("[/api/auth/register]", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
