import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { requireUser } from "@/lib/require-user";
import { User } from "@/types";

// GET /api/auth/me — confirms the current session is still valid and returns
// the current user, freshly read from the DB (not just the JWT payload, which
// can go stale between issuance and a later role/name/email change).
// requireUser() already rejects an expired/revoked token (token_version
// mismatch) with a 401 before this ever runs.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id, name, email, role, created_at FROM users WHERE id = ? LIMIT 1", [auth.user.id]
    );
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "User not found." }, { status: 401 });

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
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };

    return NextResponse.json({ user });
  } catch (err) {
    logger.error({ err, route: "GET /api/auth/me" }, "request failed");
    return NextResponse.json({ error: "Failed to load session." }, { status: 500 });
  }
}
