import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { AssetStrategy } from "@/types";

function rowToStrategy(row: mysql.RowDataPacket): AssetStrategy {
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

// GET /api/asset-strategy
export async function GET() {
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM asset_strategies ORDER BY sort_order IS NULL, sort_order ASC, name ASC"
    );
    return NextResponse.json({ strategies: rows.map(rowToStrategy) });
  } catch (err) {
    console.error("[GET /api/asset-strategy]", err);
    return NextResponse.json({ error: "Failed to load strategies." }, { status: 500 });
  }
}

// POST /api/asset-strategy
export async function POST(req: NextRequest) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, description, sortOrder, userId, userName } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Strategy name is required." }, { status: 400 });
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

    await db.execute(
      `INSERT INTO asset_strategies (id, name, description, sort_order, created_by_id, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, values.name, values.description, values.sortOrder, userId, userName]
    );

    await writeAudit({
      tableName: "asset_strategies", recordId: id, action: "CREATE",
      performedById: userId, performedByName: userName,
      oldValues: null, newValues: values,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/asset-strategy]", err);
    return NextResponse.json({ error: "Failed to create strategy." }, { status: 500 });
  }
}
