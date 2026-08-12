import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

function rowToFeatureTier(row: mysql.RowDataPacket) {
  const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
  return {
    id:            row.id,
    name:          row.name,
    description:   row.description ?? null,
    sortOrder:     row.sort_order ?? null,
    isDefault:     !!row.is_default,
    features:      row.features ? String(row.features).split(",") : [],
    createdById:   row.created_by_id,
    createdByName: row.created_by_name,
    createdAt:     toISO(row.created_at)!,
    updatedAt:     toISO(row.updated_at)!,
  };
}

// GET /api/feature-tiers
export async function GET() {
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(`
      SELECT ft.*, GROUP_CONCAT(ftf.feature_key ORDER BY ftf.feature_key) AS features
      FROM feature_tiers ft
      LEFT JOIN feature_tier_features ftf ON ftf.tier_id = ft.id
      GROUP BY ft.id
      ORDER BY ft.sort_order IS NULL, ft.sort_order ASC, ft.name ASC
    `);
    return NextResponse.json({ tiers: rows.map(rowToFeatureTier) });
  } catch (err) {
    console.error("[GET /api/feature-tiers]", err);
    return NextResponse.json({ error: "Failed to load feature tiers." }, { status: 500 });
  }
}

// POST /api/feature-tiers
export async function POST(req: NextRequest) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, description, sortOrder, isDefault, features, userId, userName } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const id = randomUUID();
    const values = {
      name:        name.trim(),
      description: description?.trim() || null,
      sortOrder:   sortOrder != null && sortOrder !== "" ? Number(sortOrder) : null,
      isDefault:   !!isDefault,
    };

    if (values.isDefault) {
      await db.execute("UPDATE feature_tiers SET is_default = 0");
    }

    await db.execute(
      `INSERT INTO feature_tiers (id, name, description, sort_order, is_default, created_by_id, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, values.name, values.description, values.sortOrder, values.isDefault ? 1 : 0, userId, userName]
    );

    const featureList: string[] = Array.isArray(features) ? features : [];
    for (const key of featureList) {
      await db.execute("INSERT INTO feature_tier_features (tier_id, feature_key) VALUES (?, ?)", [id, key]);
    }

    await writeAudit({
      tableName: "feature_tiers", recordId: id, action: "CREATE",
      performedById: userId, performedByName: userName,
      oldValues: null, newValues: { ...values, features: featureList },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/feature-tiers]", err);
    return NextResponse.json({ error: "Failed to create feature tier." }, { status: 500 });
  }
}
