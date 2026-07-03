import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getDb, setupDatabase } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { signJwt } from "@/lib/jwt";
import { validate } from "@/lib/validate";
import { RegisterSchema } from "@/lib/schemas";
import { User } from "@/types";
import mysql from "mysql2/promise";

// bcrypt work factor — 12 is a good balance of security vs. latency
const SALT_ROUNDS = 12;

export async function POST(req: NextRequest) {
  const limit = rateLimit(req, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!limit.ok) return limit.response;

  try {
    await setupDatabase();

    const v = await validate(req, RegisterSchema);
    if (!v.ok) return v.response;
    const { name, email, password } = v.data;

    const db = getDb();
    const normalizedEmail = email; // already trimmed+lowercased by schema

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
    const trimmedName = name; // already trimmed by schema
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

    const token = signJwt({ sub: user.id, name: user.name, email: user.email, role: user.role });

    const res = NextResponse.json({ user, token }, { status: 201 });
    res.cookies.set("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 3600,
      path: "/",
    });
    return res;
  } catch (err) {
    logger.error({ err, route: "/api/auth/register" }, "request failed");
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
