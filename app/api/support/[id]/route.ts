import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { requireUser } from "@/lib/require-user";

const VALID_STATUSES = ["New", "Acknowledged", "Under Review", "Will Fix", "Will Not Implement", "Completed"] as const;
type SupportStatus = typeof VALID_STATUSES[number];

// PATCH /api/support/[id] — update status
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, "Admin");
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const { status } = await req.json() as { status?: string };

    if (!status || !VALID_STATUSES.includes(status as SupportStatus))
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM support_requests WHERE id = ? LIMIT 1", [params.id]
    );
    if (!(rows as mysql.RowDataPacket[])[0])
      return NextResponse.json({ error: "Request not found." }, { status: 404 });

    await db.execute("UPDATE support_requests SET status = ? WHERE id = ?", [status, params.id]);

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PATCH /api/support/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to update status." }, { status: 500 });
  }
}
