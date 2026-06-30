import { NextRequest, NextResponse } from "next/server";
import { getDb, setupDatabase } from "@/lib/db";
import mysql from "mysql2/promise";
import { requireUser } from "@/lib/require-user";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  await setupDatabase();
  const db = getDb();
  const { participantNames } = await req.json() as { participantNames: string[] };

  if (!participantNames?.length) {
    return NextResponse.json({ tagged: [], unmatched: [] });
  }

  // Find assets matching any participant name by name OR short_code (case-insensitive)
  const placeholders = participantNames.map(() => "?").join(", ");
  const [assets] = await db.execute<mysql.RowDataPacket[]>(`
    SELECT id, name, short_code AS shortCode
    FROM assets
    WHERE LOWER(name) IN (${placeholders})
       OR LOWER(short_code) IN (${placeholders})
  `, [...participantNames.map(n => n.toLowerCase()), ...participantNames.map(n => n.toLowerCase())]);

  const tagged: { id: string; name: string; shortCode: string | null; matchedOn: string }[] = [];
  const matchedParticipants = new Set<string>();

  for (const asset of assets) {
    const nameLower = (asset.name as string).toLowerCase();
    const codeLower = (asset.shortCode as string | null)?.toLowerCase() ?? null;
    const matchedParticipant = participantNames.find(p => {
      const pl = p.toLowerCase();
      return pl === nameLower || (codeLower && pl === codeLower);
    });
    if (!matchedParticipant) continue;

    const matchedOn = (asset.name as string).toLowerCase() === matchedParticipant.toLowerCase() ? "name" : "short_code";
    matchedParticipants.add(matchedParticipant.toLowerCase());

    await db.execute(
      `INSERT INTO plantuml_diagram_assets (diagram_id, asset_id, matched_on)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE matched_on = VALUES(matched_on)`,
      [params.id, asset.id, matchedOn]
    );
    tagged.push({ id: asset.id, name: asset.name, shortCode: asset.shortCode, matchedOn });
  }

  const unmatched = participantNames.filter(p => !matchedParticipants.has(p.toLowerCase()));
  return NextResponse.json({ tagged, unmatched });
}
