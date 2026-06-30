import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

const VALID_TYPES = ["feature", "fix", "improvement", "breaking"] as const;
type ChangelogType = typeof VALID_TYPES[number];

// PUT /api/changelog/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM changelog WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Changelog entry not found." }, { status: 404 });

    const values = {
      version:     version.trim(),
      title:       title.trim(),
      description: description?.trim() || null,
      type:        (type as ChangelogType) ?? "feature",
      releasedAt,
    };

    await db.execute(
      `UPDATE changelog SET version=?, title=?, description=?, type=?, released_at=? WHERE id=?`,
      [values.version, values.title, values.description, values.type, values.releasedAt, params.id]
    );

    await writeAudit({
      tableName: "changelog", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: {
        version:     current.version,
        title:       current.title,
        description: current.description,
        type:        current.type,
        releasedAt:  current.released_at instanceof Date
                       ? current.released_at.toISOString().slice(0, 10)
                       : String(current.released_at).slice(0, 10),
      },
      newValues: values,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PUT /api/changelog/:id]", err);
    return NextResponse.json({ error: "Failed to update changelog entry." }, { status: 500 });
  }
}

// DELETE /api/changelog/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM changelog WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Changelog entry not found." }, { status: 404 });

    await db.execute("DELETE FROM changelog WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "changelog", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { version: current.version, title: current.title, type: current.type },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/changelog/:id]", err);
    return NextResponse.json({ error: "Failed to delete changelog entry." }, { status: 500 });
  }
}
