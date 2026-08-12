import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

// PUT /api/feature-tiers/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, description, sortOrder, isDefault, features, userId, userName } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

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
      performedById: userId, performedByName: userName,
      oldValues: {
        name: current.name, description: current.description,
        sortOrder: current.sort_order, isDefault: !!current.is_default,
      },
      newValues: { ...values, features: featureList },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PUT /api/feature-tiers/:id]", err);
    return NextResponse.json({ error: "Failed to update feature tier." }, { status: 500 });
  }
}

// DELETE /api/feature-tiers/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const { userId, userName } = await req.json() as { userId?: string; userName?: string };
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

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
      performedById: userId, performedByName: userName,
      oldValues: { name: current.name },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/feature-tiers/:id]", err);
    return NextResponse.json({ error: "Failed to delete feature tier." }, { status: 500 });
  }
}
