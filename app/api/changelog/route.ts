import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

const VALID_TYPES = ["feature", "fix", "improvement", "breaking"] as const;
type ChangelogType = typeof VALID_TYPES[number];

function rowToEntry(row: mysql.RowDataPacket) {
  const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
  const toDate = (v: unknown) => v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null;
  return {
    id:             row.id,
    version:        row.version,
    title:          row.title,
    description:    row.description     ?? null,
    type:           row.type,
    releasedAt:     toDate(row.released_at)!,
    createdById:    row.created_by_id,
    createdByName:  row.created_by_name,
    createdAt:      toISO(row.created_at)!,
    updatedAt:      toISO(row.updated_at)!,
  };
}

// GET /api/changelog
export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM changelog ORDER BY released_at DESC, created_at DESC"
    );
    return NextResponse.json({ entries: rows.map(rowToEntry) });
  } catch (err) {
    console.error("[GET /api/changelog]", err);
    return NextResponse.json({ error: "Failed to load changelog." }, { status: 500 });
  }
}

// POST /api/changelog
export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const { version, title, description, type, releasedAt } = body;

    if (!version?.trim()) return NextResponse.json({ error: "Version is required." }, { status: 400 });
    if (!title?.trim())   return NextResponse.json({ error: "Title is required." }, { status: 400 });
    if (!releasedAt)      return NextResponse.json({ error: "Released date is required." }, { status: 400 });
    if (type && !VALID_TYPES.includes(type as ChangelogType)) {
      return NextResponse.json({ error: "type must be one of: feature, fix, improvement, breaking." }, { status: 400 });
    }

    const db = getDb();
    const id = randomUUID();
    const values = {
      version:     version.trim(),
      title:       title.trim(),
      description: description?.trim() || null,
      type:        (type as ChangelogType) ?? "feature",
      releasedAt,
    };

    await db.execute(
      `INSERT INTO changelog (id, version, title, description, type, released_at, created_by_id, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, values.version, values.title, values.description, values.type, values.releasedAt, user.id, user.name]
    );

    await writeAudit({
      tableName: "changelog", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null, newValues: values,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/changelog]", err);
    return NextResponse.json({ error: "Failed to create changelog entry." }, { status: 500 });
  }
}
