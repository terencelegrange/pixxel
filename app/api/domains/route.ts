import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { Domain } from "@/types";

function rowToDomain(row: mysql.RowDataPacket): Domain {
  const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
  return {
    id:             row.id,
    name:           row.name,
    description:    row.description ?? null,
    createdById:    row.created_by_id,
    createdByName:  row.created_by_name,
    createdAt:      toISO(row.created_at)!,
    updatedAt:      toISO(row.updated_at)!,
  };
}

// GET /api/domains
export async function GET() {
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM domains ORDER BY name ASC"
    );
    return NextResponse.json({ domains: rows.map(rowToDomain) });
  } catch (err) {
    console.error("[GET /api/domains]", err);
    return NextResponse.json({ error: "Failed to load domains." }, { status: 500 });
  }
}

// POST /api/domains
export async function POST(req: NextRequest) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, description, userId, userName } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Domain name is required." }, { status: 400 });
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const id = randomUUID();
    const values = {
      name: name.trim(),
      description: description?.trim() || null,
    };

    await db.execute(
      `INSERT INTO domains (id, name, description, created_by_id, created_by_name)
       VALUES (?, ?, ?, ?, ?)`,
      [id, values.name, values.description, userId, userName]
    );

    await writeAudit({
      tableName: "domains", recordId: id, action: "CREATE",
      performedById: userId, performedByName: userName,
      oldValues: null, newValues: values,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/domains]", err);
    return NextResponse.json({ error: "Failed to create domain." }, { status: 500 });
  }
}
