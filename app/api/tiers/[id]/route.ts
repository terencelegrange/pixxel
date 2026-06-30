import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

// PUT /api/tiers/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const {
      name, description, slaAvailability, supportHours,
      responseTime, resolutionTime,
    } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Tier name is required." }, { status: 400 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM tiers WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Tier not found." }, { status: 404 });

    const values = {
      name:            name.trim(),
      description:     description?.trim()     || null,
      slaAvailability: slaAvailability?.trim() || null,
      supportHours:    supportHours?.trim()    || null,
      responseTime:    responseTime?.trim()    || null,
      resolutionTime:  resolutionTime?.trim()  || null,
    };

    await db.execute(
      `UPDATE tiers SET
         name=?, description=?, sla_availability=?, support_hours=?,
         response_time=?, resolution_time=?
       WHERE id=?`,
      [values.name, values.description, values.slaAvailability, values.supportHours,
       values.responseTime, values.resolutionTime, params.id]
    );

    await writeAudit({
      tableName: "tiers", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: {
        name: current.name, description: current.description,
        slaAvailability: current.sla_availability, supportHours: current.support_hours,
        responseTime: current.response_time, resolutionTime: current.resolution_time,
      },
      newValues: values,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PUT /api/tiers/:id]", err);
    return NextResponse.json({ error: "Failed to update tier." }, { status: 500 });
  }
}

// DELETE /api/tiers/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM tiers WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Tier not found." }, { status: 404 });

    await db.execute("UPDATE assets SET tier_id = NULL WHERE tier_id = ?", [params.id]);
    await db.execute("DELETE FROM tiers WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "tiers", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, slaAvailability: current.sla_availability },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/tiers/:id]", err);
    return NextResponse.json({ error: "Failed to delete tier." }, { status: 500 });
  }
}
