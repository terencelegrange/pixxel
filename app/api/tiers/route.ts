import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { Tier } from "@/types";

function rowToTier(row: mysql.RowDataPacket): Tier {
  const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
  return {
    id:              row.id,
    name:            row.name,
    description:     row.description     ?? null,
    slaAvailability: row.sla_availability ?? null,
    supportHours:    row.support_hours    ?? null,
    responseTime:    row.response_time    ?? null,
    resolutionTime:  row.resolution_time  ?? null,
    createdById:     row.created_by_id,
    createdByName:   row.created_by_name,
    createdAt:       toISO(row.created_at)!,
    updatedAt:       toISO(row.updated_at)!,
  };
}

// GET /api/tiers
export async function GET() {
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM tiers ORDER BY name ASC"
    );
    return NextResponse.json({ tiers: rows.map(rowToTier) });
  } catch (err) {
    console.error("[GET /api/tiers]", err);
    return NextResponse.json({ error: "Failed to load tiers." }, { status: 500 });
  }
}

// POST /api/tiers
export async function POST(req: NextRequest) {
  try {
    await setupDatabase();
    const body = await req.json();
    const {
      name, description, slaAvailability, supportHours,
      responseTime, resolutionTime, userId, userName,
    } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Tier name is required." }, { status: 400 });
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const id = randomUUID();
    const values = {
      name:            name.trim(),
      description:     description?.trim()     || null,
      slaAvailability: slaAvailability?.trim() || null,
      supportHours:    supportHours?.trim()    || null,
      responseTime:    responseTime?.trim()    || null,
      resolutionTime:  resolutionTime?.trim()  || null,
    };

    await db.execute(
      `INSERT INTO tiers
         (id, name, description, sla_availability, support_hours, response_time, resolution_time,
          created_by_id, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, values.name, values.description, values.slaAvailability, values.supportHours,
       values.responseTime, values.resolutionTime, userId, userName]
    );

    await writeAudit({
      tableName: "tiers", recordId: id, action: "CREATE",
      performedById: userId, performedByName: userName,
      oldValues: null, newValues: values,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/tiers]", err);
    return NextResponse.json({ error: "Failed to create tier." }, { status: 500 });
  }
}
