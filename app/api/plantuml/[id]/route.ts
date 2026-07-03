import { NextRequest, NextResponse } from "next/server";
import { getDb, setupDatabase } from "@/lib/db";
import mysql from "mysql2/promise";
import { requireUser } from "@/lib/require-user";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  await setupDatabase();
  const db = getDb();
  const [diagrams] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM plantuml_diagrams WHERE id = ?", [params.id]
  );
  if (!diagrams.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [versions] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM plantuml_versions WHERE diagram_id = ? ORDER BY version_number DESC LIMIT 1", [params.id]
  );
  return NextResponse.json({ diagram: diagrams[0], latestVersion: versions[0] ?? null });
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  await setupDatabase();
  const db = getDb();
  const { name, description } = await req.json();
  await db.execute("UPDATE plantuml_diagrams SET name = ?, description = ? WHERE id = ?", [name, description ?? null, params.id]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  await setupDatabase();
  const db = getDb();
  await db.execute("DELETE FROM plantuml_versions WHERE diagram_id = ?", [params.id]);
  await db.execute("DELETE FROM plantuml_diagrams WHERE id = ?", [params.id]);
  return NextResponse.json({ ok: true });
}
