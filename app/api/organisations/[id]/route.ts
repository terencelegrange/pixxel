import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

// PUT /api/organisations/[id] — update a department
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
    const { name, description, status } = body as {
      name?: string;
      description?: string;
      status?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Department name is required." }, { status: 400 });
    }

    const db = getDb();

    // Fetch current state for audit
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM departments WHERE id = ? LIMIT 1",
      [params.id]
    );
    const current = rows[0];
    if (!current) {
      return NextResponse.json({ error: "Department not found." }, { status: 404 });
    }

    // Check name uniqueness (excluding self)
    const [nameCheck] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM departments WHERE name = ? AND id != ? LIMIT 1",
      [name.trim(), params.id]
    );
    if ((nameCheck as mysql.RowDataPacket[]).length > 0) {
      return NextResponse.json({ error: "A department with this name already exists." }, { status: 409 });
    }

    const trimmedName = name.trim();
    const trimmedDesc = description?.trim() || null;
    const resolvedStatus = status === "Published" ? "Published" : "Unpublished";

    await db.execute(
      "UPDATE departments SET name = ?, description = ?, status = ? WHERE id = ?",
      [trimmedName, trimmedDesc, resolvedStatus, params.id]
    );

    await writeAudit({
      tableName: "departments",
      recordId: params.id,
      action: "UPDATE",
      performedById: user.id,
      performedByName: user.name,
      oldValues: { name: current.name, description: current.description ?? null, status: current.status },
      newValues: { name: trimmedName, description: trimmedDesc, status: resolvedStatus },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PUT /api/organisations/:id]", err);
    return NextResponse.json({ error: "Failed to update department." }, { status: 500 });
  }
}

// DELETE /api/organisations/[id] — delete a department
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

    // Fetch current state for audit before deleting
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM departments WHERE id = ? LIMIT 1",
      [params.id]
    );
    const current = rows[0];
    if (!current) {
      return NextResponse.json({ error: "Department not found." }, { status: 404 });
    }

    await db.execute("DELETE FROM departments WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "departments",
      recordId: params.id,
      action: "DELETE",
      performedById: user.id,
      performedByName: user.name,
      oldValues: { name: current.name, description: current.description ?? null },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/organisations/:id]", err);
    return NextResponse.json({ error: "Failed to delete department." }, { status: 500 });
  }
}
