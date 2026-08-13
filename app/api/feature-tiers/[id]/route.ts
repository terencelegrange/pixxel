import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";
import logger from "@/lib/logger";

// PUT /api/feature-tiers/[id]
export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    const params = await props.params;
    await setupDatabase();
    const body = await req.json();
    const { name, description, sortOrder, isDefault, features } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM feature_tiers WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Feature tier not found." }, { status: 404 });

    const values = {
      name:        name.trim(),
      description: description?.trim() || null,
      sortOrder:   sortOrder != null && sortOrder !== "" ? Number(sortOrder) : null,
      isDefault:   !!isDefault,
    };

    if (values.isDefault) {
      await db.execute("UPDATE feature_tiers SET is_default = 0 WHERE id != ?", [params.id]);
    }

    await db.execute(
      `UPDATE feature_tiers SET name=?, description=?, sort_order=?, is_default=? WHERE id=?`,
      [values.name, values.description, values.sortOrder, values.isDefault ? 1 : 0, params.id]
    );

    const featureList: string[] = Array.isArray(features) ? features : [];
    await db.execute("DELETE FROM feature_tier_features WHERE tier_id = ?", [params.id]);
    for (const key of featureList) {
      await db.execute("INSERT INTO feature_tier_features (tier_id, feature_key) VALUES (?, ?)", [params.id, key]);
    }

    await writeAudit({
      tableName: "feature_tiers", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: {
        name: current.name, description: current.description,
        sortOrder: current.sort_order, isDefault: !!current.is_default,
      },
      newValues: { ...values, features: featureList },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/feature-tiers/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to update feature tier." }, { status: 500 });
  }
}

// DELETE /api/feature-tiers/[id]
export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    const params = await props.params;
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM feature_tiers WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Feature tier not found." }, { status: 404 });

    const [countRows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM feature_tiers"
    );
    if (countRows[0].count <= 1) {
      return NextResponse.json({ error: "Cannot delete the last remaining feature tier." }, { status: 400 });
    }

    const [activeRows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT `value` FROM app_settings WHERE `key` = 'feature_tier_id' LIMIT 1"
    );
    const activeTierId = activeRows[0]?.value ?? null;
    if (activeTierId === params.id) {
      return NextResponse.json({ error: "Cannot delete the active feature tier. Switch to a different tier first." }, { status: 400 });
    }

    await db.execute("DELETE FROM feature_tier_features WHERE tier_id = ?", [params.id]);
    await db.execute("DELETE FROM feature_tiers WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "feature_tiers", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/feature-tiers/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to delete feature tier." }, { status: 500 });
  }
}
