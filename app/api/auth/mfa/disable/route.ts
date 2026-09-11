import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { requireUser } from "@/lib/require-user";
import { writeAudit } from "@/lib/audit";
import logger from "@/lib/logger";

// POST /api/auth/mfa/disable — requires the current password as
// defense-in-depth against a hijacked session silently turning off MFA.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const body = await req.json();
    const { password } = body as { password?: string };
    if (!password) return NextResponse.json({ error: "Password is required." }, { status: 400 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT password, mfa_enabled FROM users WHERE id = ? LIMIT 1", [auth.user.id]
    );
    const row = rows[0];
    if (!row?.mfa_enabled) {
      return NextResponse.json({ error: "MFA is not enabled." }, { status: 400 });
    }

    const match = await bcrypt.compare(password, row.password);
    if (!match) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    await db.execute(
      "UPDATE users SET mfa_enabled = ?, mfa_secret = NULL, mfa_pending_secret = NULL WHERE id = ?",
      [false, auth.user.id]
    );
    await db.execute("DELETE FROM user_mfa_recovery_codes WHERE user_id = ?", [auth.user.id]);

    await writeAudit({
      tableName: "users", recordId: auth.user.id, action: "UPDATE",
      performedById: auth.user.id, performedByName: auth.user.name,
      oldValues: { mfaEnabled: true }, newValues: { mfaEnabled: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "POST /api/auth/mfa/disable" }, "request failed");
    return NextResponse.json({ error: "Failed to disable MFA." }, { status: 500 });
  }
}
