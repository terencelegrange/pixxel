import { NextRequest, NextResponse } from "next/server";
import { getDb, setupDatabase } from "@/lib/db";
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/require-user";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  await setupDatabase();
  const db = getDb();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM plantuml_versions WHERE diagram_id = ? ORDER BY version_number DESC", [params.id]
  );
  return NextResponse.json({ versions: rows });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  await setupDatabase();
  const db = getDb();
  const { source } = await req.json();
  const [maxRows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT COALESCE(MAX(version_number), 0) AS max_v FROM plantuml_versions WHERE diagram_id = ?", [params.id]
  );
  const nextVersion = Number(maxRows[0].max_v) + 1;
  const versionId = randomUUID();
  await db.execute(
    "INSERT INTO plantuml_versions (id, diagram_id, version_number, source, created_by_id, created_by_name) VALUES (?, ?, ?, ?, ?, ?)",
    [versionId, params.id, nextVersion, source, user.id, user.name]
  );
  await db.execute("UPDATE plantuml_diagrams SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [params.id]);
  return NextResponse.json({ versionNumber: nextVersion });
}
