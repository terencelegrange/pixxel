import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { requireUser } from "@/lib/require-user";
import { generateMfaSecret, getOtpAuthUri, getQrCodeDataUrl } from "@/lib/mfa";
import { encryptSecret } from "@/lib/mfa-crypto";
import logger from "@/lib/logger";

// POST /api/auth/mfa/setup — generates a new pending TOTP secret and returns
// it (for manual entry) plus a QR code. Not yet enabled until verify-setup.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();

    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT mfa_enabled FROM users WHERE id = ? LIMIT 1", [auth.user.id]
    );
    if (rows[0]?.mfa_enabled) {
      return NextResponse.json({ error: "MFA is already enabled." }, { status: 400 });
    }

    const secret = await generateMfaSecret();
    const otpauthUri = getOtpAuthUri(auth.user.email, secret);
    const qrCodeDataUrl = await getQrCodeDataUrl(otpauthUri);

    await db.execute(
      "UPDATE users SET mfa_pending_secret = ? WHERE id = ?",
      [encryptSecret(secret), auth.user.id]
    );

    return NextResponse.json({ secret, otpauthUri, qrCodeDataUrl });
  } catch (err) {
    logger.error({ err, route: "POST /api/auth/mfa/setup" }, "request failed");
    return NextResponse.json({ error: "Failed to start MFA setup." }, { status: 500 });
  }
}
