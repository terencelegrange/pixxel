import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

function isValidQuarter(q: string): boolean {
  return /^\d{4}-Q[1-4]$/.test(q);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { classificationId, startQuarter, endQuarter, notes, userId, userName } = body;

    if (!classificationId)
      return NextResponse.json({ error: "classificationId is required." }, { status: 400 });
    if (!startQuarter || !isValidQuarter(startQuarter))
      return NextResponse.json({ error: "startQuarter must be in YYYY-Qn format." }, { status: 400 });
    if (!endQuarter || !isValidQuarter(endQuarter))
      return NextResponse.json({ error: "endQuarter must be in YYYY-Qn format." }, { status: 400 });
    if (endQuarter < startQuarter)
      return NextResponse.json({ error: "endQuarter must be >= startQuarter." }, { status: 400 });
    if (!userId || !userName)
      return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM asset_roadmap_phases WHERE id = ? LIMIT 1", [params.id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Phase not found." }, { status: 404 });
    const current = rows[0];

    // Overlap check - exclude self
    const [overlapping] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT id FROM asset_roadmap_phases
       WHERE asset_id = ? AND id != ? AND start_quarter <= ? AND end_quarter >= ?
       LIMIT 1`,
      [current.asset_id, params.id, endQuarter, startQuarter]
    );
    if (overlapping.length > 0) {
      return NextResponse.json(
        { error: "A phase for this asset overlaps the specified quarter range." },
        { status: 409 }
      );
    }

    await db.execute(
      `UPDATE asset_roadmap_phases
         SET classification_id = ?, start_quarter = ?, end_quarter = ?, notes = ?
       WHERE id = ?`,
      [classificationId, startQuarter, endQuarter, notes?.trim() || null, params.id]
    );

    await writeAudit({
      tableName: "asset_roadmap_phases", recordId: params.id, action: "UPDATE",
      performedById: userId, performedByName: userName,
      oldValues: {
        classificationId: current.classification_id,
        startQuarter: current.start_quarter,
        endQuarter: current.end_quarter,
        notes: current.notes,
      },
      newValues: { classificationId, startQuarter, endQuarter, notes: notes?.trim() || null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/roadmap/phases/[id]]", err);
    return NextResponse.json({ error: "Failed to update roadmap phase." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { userId, userName } = body as { userId?: string; userName?: string };
    if (!userId || !userName)
      return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM asset_roadmap_phases WHERE id = ? LIMIT 1", [params.id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Phase not found." }, { status: 404 });
    const current = rows[0];

    await db.execute("DELETE FROM asset_roadmap_phases WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "asset_roadmap_phases", recordId: params.id, action: "DELETE",
      performedById: userId, performedByName: userName,
      oldValues: {
        assetId: current.asset_id,
        classificationId: current.classification_id,
        startQuarter: current.start_quarter,
        endQuarter: current.end_quarter,
      },
      newValues: null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/roadmap/phases/[id]]", err);
    return NextResponse.json({ error: "Failed to delete roadmap phase." }, { status: 500 });
  }
}
