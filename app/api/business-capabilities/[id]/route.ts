import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const { name, description, industrySectorId, sortOrder } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!industrySectorId) return NextResponse.json({ error: "Industry sector is required." }, { status: 400 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM business_capabilities WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Business capability not found." }, { status: 404 });

    const sortVal = sortOrder != null && sortOrder !== "" ? Number(sortOrder) : null;
    await db.execute(
      "UPDATE business_capabilities SET name = ?, description = ?, industry_sector_id = ?, sort_order = ? WHERE id = ?",
      [name.trim(), description?.trim() || null, industrySectorId, sortVal, params.id]
    );
    await writeAudit({
      tableName: "business_capabilities", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, description: current.description, industrySectorId: current.industry_sector_id, sortOrder: current.sort_order },
      newValues: { name: name.trim(), description: description?.trim() || null, industrySectorId, sortOrder: sortVal },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/business-capabilities/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to update business capability." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM business_capabilities WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Business capability not found." }, { status: 404 });

    await db.execute("DELETE FROM business_capabilities WHERE id = ?", [params.id]);
    await writeAudit({
      tableName: "business_capabilities", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, description: current.description, industrySectorId: current.industry_sector_id },
      newValues: null,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/business-capabilities/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to delete business capability." }, { status: 500 });
  }
}
