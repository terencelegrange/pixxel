import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { RoadmapDomainGroup, RoadmapAsset, AssetRoadmapPhase } from "@/types";
import { requireUser } from "@/lib/require-user";

function isValidQuarter(q: string): boolean {
  return /^\d{4}-Q[1-4]$/.test(q);
}

// GET /api/roadmap/phases?from=YYYY-Qn&to=YYYY-Qn
export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") ?? "2026-Q1";
    const to   = searchParams.get("to")   ?? "2028-Q4";

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT
         d.id            AS domain_id,
         d.name          AS domain_name,
         a.id            AS asset_id,
         a.name          AS asset_name,
         p.id            AS phase_id,
         p.classification_id,
         ic.name         AS classification_name,
         ic.color        AS classification_color,
         p.start_quarter,
         p.end_quarter,
         p.notes,
         p.created_by_id,
         p.created_by_name,
         p.created_at    AS phase_created_at,
         p.updated_at    AS phase_updated_at
       FROM assets a
       LEFT JOIN domains d ON a.domain_id = d.id
       LEFT JOIN tiers t ON a.tier_id = t.id
       LEFT JOIN asset_roadmap_phases p
         ON p.asset_id = a.id
         AND p.start_quarter <= ? AND p.end_quarter >= ?
       LEFT JOIN investment_classifications ic ON p.classification_id = ic.id
       ORDER BY d.name ASC, t.name ASC, a.name ASC, p.start_quarter ASC`,
      [to, from]
    );

    const groupMap = new Map<string, RoadmapDomainGroup>();
    const assetMap = new Map<string, RoadmapAsset>();

    const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;

    for (const row of rows) {
      const domainId   = row.domain_id   ?? "no-domain";
      const domainName = row.domain_name ?? "No Domain";

      if (!groupMap.has(domainId)) {
        groupMap.set(domainId, { domainId, domainName, assets: [] });
      }
      const group = groupMap.get(domainId)!;

      if (!assetMap.has(row.asset_id)) {
        const asset: RoadmapAsset = { id: row.asset_id, name: row.asset_name, phases: [] };
        assetMap.set(row.asset_id, asset);
        group.assets.push(asset);
      }

      if (row.phase_id) {
        const phase: AssetRoadmapPhase = {
          id:                  row.phase_id,
          assetId:             row.asset_id,
          classificationId:    row.classification_id,
          classificationName:  row.classification_name,
          classificationColor: row.classification_color,
          startQuarter:        row.start_quarter,
          endQuarter:          row.end_quarter,
          notes:               row.notes ?? null,
          createdById:         row.created_by_id,
          createdByName:       row.created_by_name,
          createdAt:           toISO(row.phase_created_at)!,
          updatedAt:           toISO(row.phase_updated_at)!,
        };
        assetMap.get(row.asset_id)!.phases.push(phase);
      }
    }

    return NextResponse.json({ groups: Array.from(groupMap.values()) });
  } catch (err) {
    console.error("[GET /api/roadmap/phases]", err);
    return NextResponse.json({ error: "Failed to load roadmap phases." }, { status: 500 });
  }
}

// POST /api/roadmap/phases
export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const { assetId, classificationId, startQuarter, endQuarter, notes } = body;

    if (!assetId)          return NextResponse.json({ error: "assetId is required." }, { status: 400 });
    if (!classificationId) return NextResponse.json({ error: "classificationId is required." }, { status: 400 });
    if (!startQuarter || !isValidQuarter(startQuarter))
      return NextResponse.json({ error: "startQuarter must be in YYYY-Qn format." }, { status: 400 });
    if (!endQuarter || !isValidQuarter(endQuarter))
      return NextResponse.json({ error: "endQuarter must be in YYYY-Qn format." }, { status: 400 });
    if (endQuarter < startQuarter)
      return NextResponse.json({ error: "endQuarter must be >= startQuarter." }, { status: 400 });

    const db = getDb();

    // Overlap check
    const [overlapping] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT id FROM asset_roadmap_phases
       WHERE asset_id = ? AND start_quarter <= ? AND end_quarter >= ?
       LIMIT 1`,
      [assetId, endQuarter, startQuarter]
    );
    if (overlapping.length > 0) {
      return NextResponse.json(
        { error: "A phase for this asset overlaps the specified quarter range." },
        { status: 409 }
      );
    }

    const id = randomUUID();
    await db.execute(
      `INSERT INTO asset_roadmap_phases
         (id, asset_id, classification_id, start_quarter, end_quarter, notes, created_by_id, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, assetId, classificationId, startQuarter, endQuarter, notes?.trim() || null, user.id, user.name]
    );

    await writeAudit({
      tableName: "asset_roadmap_phases", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null,
      newValues: { assetId, classificationId, startQuarter, endQuarter, notes: notes?.trim() || null },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/roadmap/phases]", err);
    return NextResponse.json({ error: "Failed to create roadmap phase." }, { status: 500 });
  }
}
