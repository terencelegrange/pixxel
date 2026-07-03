import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(`
      SELECT bc.*, s.name AS industry_sector_name
      FROM business_capabilities bc
      LEFT JOIN industry_sectors s ON s.id = bc.industry_sector_id
      ORDER BY s.name ASC, bc.sort_order IS NULL, bc.sort_order ASC, bc.name ASC
    `);
    const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
    const capabilities = rows.map((r) => ({
      id: r.id, name: r.name, description: r.description ?? null,
      industrySectorId: r.industry_sector_id,
      industrySectorName: r.industry_sector_name ?? null,
      sortOrder: r.sort_order ?? null,
      createdById: r.created_by_id, createdByName: r.created_by_name,
      createdAt: toISO(r.created_at)!, updatedAt: toISO(r.updated_at)!,
    }));
    return NextResponse.json({ capabilities });
  } catch (err) {
    logger.error({ err, route: "GET /api/business-capabilities" }, "request failed");
    return NextResponse.json({ error: "Failed to load business capabilities." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const { name, description, industrySectorId, sortOrder } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!industrySectorId) return NextResponse.json({ error: "Industry sector is required." }, { status: 400 });

    const db = getDb();
    const id = randomUUID();
    const sortVal = sortOrder != null && sortOrder !== "" ? Number(sortOrder) : null;
    await db.execute(
      `INSERT INTO business_capabilities
         (id, name, description, industry_sector_id, sort_order, created_by_id, created_by_name)
       VALUES (?,?,?,?,?,?,?)`,
      [id, name.trim(), description?.trim() || null, industrySectorId, sortVal, user.id, user.name]
    );
    await writeAudit({
      tableName: "business_capabilities", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null,
      newValues: { name: name.trim(), description: description?.trim() || null, industrySectorId, sortOrder: sortVal },
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: "POST /api/business-capabilities" }, "request failed");
    return NextResponse.json({ error: "Failed to create business capability." }, { status: 500 });
  }
}
