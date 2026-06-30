import { NextRequest, NextResponse } from "next/server";
import { getDb, setupDatabase } from "@/lib/db";
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/require-user";

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  await setupDatabase();
  const db = getDb();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(`
    SELECT pd.id, pd.name, pd.description, pd.project_id,
           pd.created_by_name, pd.created_at, pd.updated_at,
           COALESCE(MAX(pv.version_number), 0) AS latest_version,
           COUNT(pv.id) AS version_count
    FROM plantuml_diagrams pd
    LEFT JOIN plantuml_versions pv ON pv.diagram_id = pd.id
    GROUP BY pd.id
    ORDER BY pd.updated_at DESC
  `);
  return NextResponse.json({ diagrams: rows });
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  await setupDatabase();
  const db = getDb();
  const { name, description } = await req.json();
  const id = randomUUID();
  const defaultSource = `@startuml\nactor User\nUser -> System : Request\nSystem --> User : Response\n@enduml`;
  await db.execute(
    "INSERT INTO plantuml_diagrams (id, name, description, created_by_id, created_by_name) VALUES (?, ?, ?, ?, ?)",
    [id, name, description ?? null, user.id, user.name]
  );
  const versionId = randomUUID();
  await db.execute(
    "INSERT INTO plantuml_versions (id, diagram_id, version_number, source, created_by_id, created_by_name) VALUES (?, ?, 1, ?, ?, ?)",
    [versionId, id, defaultSource, user.id, user.name]
  );
  return NextResponse.json({ id, versionNumber: 1 }, { status: 201 });
}
