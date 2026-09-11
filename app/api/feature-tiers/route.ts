import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, getDbDialect, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";
import logger from "@/lib/logger";

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
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    // MySQL/MariaDB rejects a correlated reference (ft.id) from inside a
    // derived table in the FROM clause — "Unknown column 'ft.id' in
    // 'WHERE'" — since a derived table is materialized independently of
    // the outer query. SQLite has no such restriction, and its GROUP_CONCAT
    // has no ORDER BY clause of its own, so the derived-table wrapper is
    // needed there to get a deterministic feature order. Branch per dialect,
    // same as app/api/assets/route.ts's department/architect/capability lists.
    const dialect = getDbDialect();
    const query = dialect === "sqlite" ? `
      SELECT ft.*,
        (SELECT GROUP_CONCAT(feature_key, ',') FROM (
          SELECT ftf.feature_key AS feature_key FROM feature_tier_features ftf
          WHERE ftf.tier_id = ft.id ORDER BY ftf.feature_key
        )) AS features
      FROM feature_tiers ft
      ORDER BY ft.sort_order IS NULL, ft.sort_order ASC, ft.name ASC
    ` : `
      SELECT ft.*,
        GROUP_CONCAT(DISTINCT ftf.feature_key ORDER BY ftf.feature_key SEPARATOR ',') AS features
      FROM feature_tiers ft
      LEFT JOIN feature_tier_features ftf ON ftf.tier_id = ft.id
      GROUP BY ft.id
      ORDER BY ft.sort_order IS NULL, ft.sort_order ASC, ft.name ASC
    `;
    const [rows] = await db.execute<mysql.RowDataPacket[]>(query);
    return NextResponse.json({ tiers: rows.map(rowToFeatureTier) });
  } catch (err) {
    logger.error({ err, route: "GET /api/feature-tiers" }, "request failed");
    return NextResponse.json({ error: "Failed to load feature tiers." }, { status: 500 });
  }
}

// POST /api/feature-tiers
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, description, sortOrder, isDefault, features } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });

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
      [id, values.name, values.description, values.sortOrder, values.isDefault ? 1 : 0, user.id, user.name]
    );

    const featureList: string[] = Array.isArray(features) ? features : [];
    for (const key of featureList) {
      await db.execute("INSERT INTO feature_tier_features (tier_id, feature_key) VALUES (?, ?)", [id, key]);
    }

    await writeAudit({
      tableName: "feature_tiers", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null, newValues: { ...values, features: featureList },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: "POST /api/feature-tiers" }, "request failed");
    return NextResponse.json({ error: "Failed to create feature tier." }, { status: 500 });
  }
}
