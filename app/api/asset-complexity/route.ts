import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { AssetComplexity } from "@/types";

function rowToComplexity(row: mysql.RowDataPacket): AssetComplexity {
  const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
  return {
    id:            row.id,
    name:          row.name,
    description:   row.description ?? null,
    sortOrder:     row.sort_order != null ? Number(row.sort_order) : null,
    createdById:   row.created_by_id,
    createdByName: row.created_by_name,
    createdAt:     toISO(row.created_at)!,
    updatedAt:     toISO(row.updated_at)!,
  };
}

// GET /api/asset-complexity
export async function GET() {
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM asset_complexities ORDER BY sort_order IS NULL, sort_order ASC, name ASC"
    );
    return NextResponse.json({ complexities: rows.map(rowToComplexity) });
  } catch (err) {
    console.error("[GET /api/asset-complexity]", err);
    return NextResponse.json({ error: "Failed to load complexities." }, { status: 500 });
  }
}

// POST /api/asset-complexity
export async function POST(req: NextRequest) {
  try {
    await setupDatabase();
    const { name, description, sortOrder, userId, userName } = await req.json();

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const id = randomUUID();
    const parsedOrder = sortOrder !== undefined && sortOrder !== "" && sortOrder !== null
      ? Number(sortOrder) : null;
    const values = {
      name: name.trim(),
      description: description?.trim() || null,
      sortOrder: parsedOrder,
    };

    try {
      await db.execute(
        `INSERT INTO asset_complexities (id, name, description, sort_order, created_by_id, created_by_name)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, values.name, values.description, values.sortOrder, userId, userName]
      );
    } catch (e: unknown) {
      if ((e as { code?: string }).code === "ER_DUP_ENTRY") {
        return NextResponse.json({ error: "A complexity with that name already exists." }, { status: 409 });
      }
      throw e;
    }

    await writeAudit({
      tableName: "asset_complexities", recordId: id, action: "CREATE",
      performedById: userId, performedByName: userName,
      oldValues: null, newValues: values,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/asset-complexity]", err);
    return NextResponse.json({ error: "Failed to create complexity." }, { status: 500 });
  }
}
