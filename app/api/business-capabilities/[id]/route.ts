import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const { name, description, industrySectorId, sortOrder, userId, userName } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!industrySectorId) return NextResponse.json({ error: "Industry sector is required." }, { status: 400 });
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

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
      performedById: userId, performedByName: userName,
      oldValues: { name: current.name, description: current.description, industrySectorId: current.industry_sector_id, sortOrder: current.sort_order },
      newValues: { name: name.trim(), description: description?.trim() || null, industrySectorId, sortOrder: sortVal },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PUT /api/business-capabilities/:id]", err);
    return NextResponse.json({ error: "Failed to update business capability." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const { userId, userName } = await req.json() as { userId?: string; userName?: string };
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM business_capabilities WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Business capability not found." }, { status: 404 });

    await db.execute("DELETE FROM business_capabilities WHERE id = ?", [params.id]);
    await writeAudit({
      tableName: "business_capabilities", recordId: params.id, action: "DELETE",
      performedById: userId, performedByName: userName,
      oldValues: { name: current.name, description: current.description, industrySectorId: current.industry_sector_id },
      newValues: null,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/business-capabilities/:id]", err);
    return NextResponse.json({ error: "Failed to delete business capability." }, { status: 500 });
  }
}
