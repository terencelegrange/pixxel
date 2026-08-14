import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { requireUser } from "@/lib/require-user";
import { verifyTotp, generateRecoveryCodes, hashRecoveryCode } from "@/lib/mfa";
import { decryptSecret } from "@/lib/mfa-crypto";
import { writeAudit } from "@/lib/audit";
import logger from "@/lib/logger";

// POST /api/auth/mfa/verify-setup — confirms the pending secret with a real
// code, enables MFA, and issues one-time recovery codes.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const body = await req.json();
    const { code } = body as { code?: string };
    if (!code?.trim()) return NextResponse.json({ error: "Code is required." }, { status: 400 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT mfa_pending_secret FROM users WHERE id = ? LIMIT 1", [auth.user.id]
    );
    const pending = rows[0]?.mfa_pending_secret;
    if (!pending) {
      return NextResponse.json({ error: "No MFA setup in progress. Start over." }, { status: 400 });
    }

    const secret = decryptSecret(pending);
    const valid = await verifyTotp(secret, code.trim());
    if (!valid) {
      return NextResponse.json({ error: "Invalid code. Check your authenticator app and try again." }, { status: 400 });
    }

    await db.execute(
      "UPDATE users SET mfa_enabled = ?, mfa_secret = ?, mfa_pending_secret = NULL WHERE id = ?",
      [true, pending, auth.user.id]
    );

    // Replace any prior recovery codes (e.g. re-enabling after a disable).
    await db.execute("DELETE FROM user_mfa_recovery_codes WHERE user_id = ?", [auth.user.id]);
    const recoveryCodes = generateRecoveryCodes();
    for (const recoveryCode of recoveryCodes) {
      const codeHash = await hashRecoveryCode(recoveryCode);
      await db.execute(
        "INSERT INTO user_mfa_recovery_codes (id, user_id, code_hash) VALUES (?, ?, ?)",
        [randomUUID(), auth.user.id, codeHash]
      );
    }

    await writeAudit({
      tableName: "users", recordId: auth.user.id, action: "UPDATE",
      performedById: auth.user.id, performedByName: auth.user.name,
      oldValues: { mfaEnabled: false }, newValues: { mfaEnabled: true },
    });

    return NextResponse.json({ recoveryCodes });
  } catch (err) {
    logger.error({ err, route: "POST /api/auth/mfa/verify-setup" }, "request failed");
    return NextResponse.json({ error: "Failed to verify MFA setup." }, { status: 500 });
  }
}
