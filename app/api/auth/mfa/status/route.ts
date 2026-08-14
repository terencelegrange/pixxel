import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { requireUser } from "@/lib/require-user";
import logger from "@/lib/logger";

// GET /api/auth/mfa/status
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT mfa_enabled FROM users WHERE id = ? LIMIT 1", [auth.user.id]
    );
    return NextResponse.json({ enabled: !!rows[0]?.mfa_enabled });
  } catch (err) {
    logger.error({ err, route: "GET /api/auth/mfa/status" }, "request failed");
    return NextResponse.json({ error: "Failed to load MFA status." }, { status: 500 });
  }
}
