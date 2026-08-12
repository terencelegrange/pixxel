import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";

// GET /api/feature-tier/active — resolves the active tier (falling back to the
// default tier if app_settings has no explicit assignment yet) and its features.
export async function GET() {
  try {
    await setupDatabase();
    const db = getDb();

    const [settingRows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT `value` FROM app_settings WHERE `key` = 'feature_tier_id' LIMIT 1"
    );
    const activeTierId = settingRows[0]?.value ?? null;

    const [tierRows] = await db.execute<mysql.RowDataPacket[]>(
      activeTierId
        ? "SELECT id, name FROM feature_tiers WHERE id = ? LIMIT 1"
        : "SELECT id, name FROM feature_tiers WHERE is_default = 1 LIMIT 1",
      activeTierId ? [activeTierId] : []
    );
    const tier = tierRows[0];
    if (!tier) return NextResponse.json({ tierId: null, tierName: null, features: [] });

    const [featureRows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT feature_key FROM feature_tier_features WHERE tier_id = ?", [tier.id]
    );

    return NextResponse.json({
      tierId: tier.id,
      tierName: tier.name,
      features: featureRows.map((r) => r.feature_key),
    });
  } catch (err) {
    console.error("[GET /api/feature-tier/active]", err);
    return NextResponse.json({ error: "Failed to load active feature tier." }, { status: 500 });
  }
}

// PUT /api/feature-tier/active — switch the whole install to a different tier
export async function PUT(req: NextRequest) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { tierId } = body;
    if (!tierId?.trim()) return NextResponse.json({ error: "tierId is required." }, { status: 400 });

    const db = getDb();
    const [tierRows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM feature_tiers WHERE id = ? LIMIT 1", [tierId]
    );
    if (!tierRows[0]) return NextResponse.json({ error: "Feature tier not found." }, { status: 404 });

    await db.execute(
      "INSERT INTO app_settings (`key`, `value`) VALUES ('feature_tier_id', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
      [tierId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PUT /api/feature-tier/active]", err);
    return NextResponse.json({ error: "Failed to switch feature tier." }, { status: 500 });
  }
}
