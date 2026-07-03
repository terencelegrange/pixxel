import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { Tier } from "@/types";
import { requireUser } from "@/lib/require-user";

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
export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM tiers ORDER BY name ASC"
    );
    return NextResponse.json({ tiers: rows.map(rowToTier) });
  } catch (err) {
    logger.error({ err, route: "GET /api/tiers" }, "request failed");
    return NextResponse.json({ error: "Failed to load tiers." }, { status: 500 });
  }
}

// POST /api/tiers
export async function POST(req: NextRequest) {
  const auth = requireUser(req, ["Admin", "Member"]);
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
       values.responseTime, values.resolutionTime, user.id, user.name]
    );

    await writeAudit({
      tableName: "tiers", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null, newValues: values,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: "POST /api/tiers" }, "request failed");
    return NextResponse.json({ error: "Failed to create tier." }, { status: 500 });
  }
}
