import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { signJwt } from "@/lib/jwt";
import { validate } from "@/lib/validate";
import { LoginSchema } from "@/lib/schemas";
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
  const limit = rateLimit(req, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!limit.ok) return limit.response;

  try {
    await setupDatabase();

    const v = await validate(req, LoginSchema);
    if (!v.ok) return v.response;
    const { email, password } = v.data;

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id, name, email, password, role, created_at FROM users WHERE email = ? LIMIT 1",
      [email]
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

    const token = signJwt({ sub: user.id, name: user.name, email: user.email, role: user.role });

    const res = NextResponse.json({ user, token }, { status: 200 });
    res.cookies.set("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 3600,
      path: "/",
    });
    return res;
  } catch (err) {
    logger.error({ err, route: "/api/auth/login" }, "request failed");
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
