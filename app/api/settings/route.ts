import { NextResponse } from "next/server";
import { getDb, setupDatabase } from "@/lib/db";
import mysql from "mysql2/promise";

export async function GET() {
  await setupDatabase();
  const db = getDb();
  const [rows] = await db.execute<mysql.RowDataPacket[]>("SELECT `key`, `value` FROM app_settings");
  const settings: Record<string, string> = {};
  rows.forEach((r) => { settings[r.key] = r.value ?? ""; });
  return NextResponse.json({ settings });
}

export async function PUT(req: Request) {
  await setupDatabase();
  const db = getDb();
  const body = await req.json();
  // body.settings is Record<string, string>
  const settings = (body.settings ?? {}) as Record<string, string>;
  for (const [key, value] of Object.entries(settings)) {
    await db.execute(
      "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
      [key, value]
    );
  }
  return NextResponse.json({ ok: true });
}
