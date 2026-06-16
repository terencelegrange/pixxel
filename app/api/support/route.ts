import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";

const VALID_TYPES = ["Feature Request", "Report Request", "Bug", "Other"] as const;
type SupportType = typeof VALID_TYPES[number];

// GET /api/support — list all submissions (admin view)
export async function GET() {
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT id, user_id, user_name, type, subject, description, status, created_at
       FROM support_requests
       ORDER BY created_at DESC`
    );
    const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
    const requests = rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      type: r.type,
      subject: r.subject,
      description: r.description ?? null,
      status: r.status,
      createdAt: toISO(r.created_at)!,
    }));
    return NextResponse.json({ requests });
  } catch (err) {
    console.error("[GET /api/support]", err);
    return NextResponse.json({ error: "Failed to load feedback." }, { status: 500 });
  }
}

// POST /api/support — submit a new request
export async function POST(req: NextRequest) {
  try {
    await setupDatabase();
    const body = await req.json();
    const { type, subject, description, userId, userName } = body;

    if (!type || !VALID_TYPES.includes(type as SupportType))
      return NextResponse.json({ error: "type must be one of: Feature Request, Report Request, Bug, Other." }, { status: 400 });
    if (!subject?.trim()) return NextResponse.json({ error: "Subject is required." }, { status: 400 });
    if (subject.trim().length > 500)
      return NextResponse.json({ error: "Subject must be 500 characters or fewer." }, { status: 400 });
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const id = randomUUID();
    await db.execute(
      `INSERT INTO support_requests (id, user_id, user_name, type, subject, description, status)
       VALUES (?, ?, ?, ?, ?, ?, 'New')`,
      [id, userId, userName, type, subject.trim(), description?.trim() || null]
    );

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/support]", err);
    return NextResponse.json({ error: "Failed to submit request." }, { status: 500 });
  }
}
