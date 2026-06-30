import { NextRequest, NextResponse } from "next/server";
import { getDb, setupDatabase } from "@/lib/db";
import mysql from "mysql2/promise";
import { requireUser } from "@/lib/require-user";

// GET — list tagged assets for this diagram
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  await setupDatabase();
  const db = getDb();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(`
    SELECT a.id, a.name, a.short_code AS shortCode, a.category, a.lifecycle_status AS lifecycleStatus,
           pda.matched_on AS matchedOn, pda.tagged_at AS taggedAt
    FROM plantuml_diagram_assets pda
    JOIN assets a ON a.id = pda.asset_id
    WHERE pda.diagram_id = ?
    ORDER BY a.name ASC
  `, [params.id]);
  return NextResponse.json({ assets: rows });
}

// DELETE — remove a specific asset tag (assetId in body)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  await setupDatabase();
  const db = getDb();
  const { assetId } = await req.json();
  await db.execute(
    "DELETE FROM plantuml_diagram_assets WHERE diagram_id = ? AND asset_id = ?",
    [params.id, assetId]
  );
  return NextResponse.json({ ok: true });
}
