import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { signJwt } from "@/lib/jwt";
import { verifyMfaChallengeToken, verifyTotp, verifyRecoveryCode } from "@/lib/mfa";
import { decryptSecret } from "@/lib/mfa-crypto";
import { isSecureRequest } from "@/lib/cookie-secure";
import { User } from "@/types";
import logger from "@/lib/logger";

interface DbUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: Date;
  token_version: number;
  mfa_secret: string | null;
}

// POST /api/auth/mfa/challenge — completes login after password success:
// verifies a TOTP code (or a recovery code) against the mfaToken issued by
// /api/auth/login, then issues the real session JWT + cookie.
export async function POST(req: NextRequest) {
  // A 6-digit code is only 1,000,000 combinations — rate-limit tighter than login.
  const limit = rateLimit(req, { limit: 8, windowMs: 10 * 60 * 1000 });
  if (!limit.ok) return limit.response;

  try {
    await setupDatabase();
    const body = await req.json();
    const { mfaToken, code, recoveryCode } = body as { mfaToken?: string; code?: string; recoveryCode?: string };

    if (!mfaToken) return NextResponse.json({ error: "Missing MFA token." }, { status: 400 });
    if (!code && !recoveryCode) return NextResponse.json({ error: "Enter a code." }, { status: 400 });

    const challenge = verifyMfaChallengeToken(mfaToken);
    if (!challenge) {
      return NextResponse.json({ error: "MFA challenge expired. Please log in again." }, { status: 401 });
    }

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id, name, email, role, created_at, token_version, mfa_secret FROM users WHERE id = ? LIMIT 1",
      [challenge.sub]
    );
    const row = rows[0] as DbUserRow | undefined;
    if (!row || !row.mfa_secret) {
      return NextResponse.json({ error: "MFA is not enabled for this account." }, { status: 401 });
    }

    let verified = false;
    if (code?.trim()) {
      verified = await verifyTotp(decryptSecret(row.mfa_secret), code.trim());
    } else if (recoveryCode?.trim()) {
      const [codeRows] = await db.execute<mysql.RowDataPacket[]>(
        "SELECT id, code_hash FROM user_mfa_recovery_codes WHERE user_id = ? AND used_at IS NULL",
        [row.id]
      );
      for (const codeRow of codeRows) {
        if (await verifyRecoveryCode(recoveryCode.trim(), codeRow.code_hash)) {
          await db.execute("UPDATE user_mfa_recovery_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?", [codeRow.id]);
          verified = true;
          break;
        }
      }
    }

    if (!verified) {
      return NextResponse.json({ error: "Invalid code." }, { status: 401 });
    }

    const user: User = {
      id: row.id,
      name: row.name,
      email: row.email,
      avatarInitials: row.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2),
      role: row.role,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };

    const token = signJwt({ sub: user.id, name: user.name, email: user.email, role: user.role, tokenVersion: row.token_version });

    const res = NextResponse.json({ user, token }, { status: 200 });
    res.cookies.set("authToken", token, {
      httpOnly: true,
      secure: isSecureRequest(req),
      sameSite: "lax",
      maxAge: 7 * 24 * 3600,
      path: "/",
    });
    return res;
  } catch (err) {
    logger.error({ err, route: "POST /api/auth/mfa/challenge" }, "request failed");
    return NextResponse.json({ error: "An unexpected error occurred. Please try again." }, { status: 500 });
  }
}
