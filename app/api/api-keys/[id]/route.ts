import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";

// DELETE /api/api-keys/[id] — Admin only. Soft-revoke, idempotent.
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, "Admin");
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM api_keys WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "API key not found." }, { status: 404 });

    if (current.revoked_at == null) {
      await db.execute(
        "UPDATE api_keys SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?", [params.id]
      );

      await writeAudit({
        tableName: "api_keys", recordId: params.id, action: "DELETE",
        performedById: user.id, performedByName: user.name,
        oldValues: { name: current.name, keyPrefix: current.key_prefix },
        newValues: null,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/api-keys/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to revoke API key." }, { status: 500 });
  }
}
