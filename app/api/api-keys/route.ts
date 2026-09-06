import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";
import { generateApiKey, hashApiKey, keyPrefixFor } from "@/lib/api-keys";

const VALID_EXPIRY_PRESETS = [30, 90, 365, null] as const;

function rowToApiKey(row: mysql.RowDataPacket) {
  const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
  return {
    id:             row.id,
    name:           row.name,
    contact:        row.contact ?? null,
    keyPrefix:      row.key_prefix,
    createdById:    row.created_by_id,
    createdByName:  row.created_by_name,
    expiresAt:      toISO(row.expires_at),
    lastUsedAt:     toISO(row.last_used_at),
    useCount:       row.use_count,
    revokedAt:      toISO(row.revoked_at),
    createdAt:      toISO(row.created_at)!,
  };
}

// GET /api/api-keys — Admin only
export async function GET(req: NextRequest) {
  const auth = await requireUser(req, "Admin");
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM api_keys ORDER BY created_at DESC"
    );
    return NextResponse.json({ apiKeys: rows.map(rowToApiKey) });
  } catch (err) {
    logger.error({ err, route: "GET /api/api-keys" }, "request failed");
    return NextResponse.json({ error: "Failed to load API keys." }, { status: 500 });
  }
}

// POST /api/api-keys — Admin only
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, "Admin");
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, contact, expiresInDays } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    const expiryDays = expiresInDays === undefined ? null : expiresInDays;
    if (!VALID_EXPIRY_PRESETS.includes(expiryDays)) {
      return NextResponse.json(
        { error: "expiresInDays must be one of: 30, 90, 365, or null." },
        { status: 400 }
      );
    }

    const rawKey = generateApiKey();
    const id = randomUUID();
    const values = {
      name:      name.trim(),
      contact:   contact?.trim() || null,
      keyPrefix: keyPrefixFor(rawKey),
      expiresAt: expiryDays ? new Date(Date.now() + expiryDays * 86400000) : null,
    };

    const db = getDb();
    await db.execute(
      `INSERT INTO api_keys
         (id, name, contact, key_prefix, key_hash, created_by_id, created_by_name, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, values.name, values.contact, values.keyPrefix, hashApiKey(rawKey), user.id, user.name, values.expiresAt]
    );

    await writeAudit({
      tableName: "api_keys", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null,
      newValues: { name: values.name, contact: values.contact, keyPrefix: values.keyPrefix, expiresAt: values.expiresAt },
    });

    return NextResponse.json({
      id, rawKey,
      name: values.name, contact: values.contact, keyPrefix: values.keyPrefix,
      expiresAt: values.expiresAt ? values.expiresAt.toISOString() : null,
    }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: "POST /api/api-keys" }, "request failed");
    return NextResponse.json({ error: "Failed to create API key." }, { status: 500 });
  }
}
