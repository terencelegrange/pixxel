import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { Contract, ContractStatus } from "@/types";
import { requireUser } from "@/lib/require-user";

const VALID_STATUSES: ContractStatus[] = ["Active", "Terminated"];

function rowToContract(row: mysql.RowDataPacket): Contract {
  const toISO = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
  return {
    id: row.id,
    vendorId: row.vendor_id ?? null,
    vendorName: row.vendor_name ?? null,
    assetId: row.asset_id ?? null,
    assetName: row.asset_name ?? null,
    title: row.title,
    value: row.value != null ? Number(row.value) : null,
    startDate: toISO(row.start_date),
    endDate: toISO(row.end_date),
    noticePeriodDays: row.notice_period_days != null ? Number(row.notice_period_days) : null,
    autoRenews: !!row.auto_renews,
    owner: row.owner ?? null,
    status: row.status,
    docUrl: row.doc_url ?? null,
    notes: row.notes ?? null,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    createdAt: toISO(row.created_at)!,
    updatedAt: toISO(row.updated_at)!,
  };
}

// GET /api/contracts/[id]
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT c.*, v.name AS vendor_name, a.name AS asset_name
       FROM contracts c
       LEFT JOIN vendors v ON v.id = c.vendor_id
       LEFT JOIN assets a ON a.id = c.asset_id
       WHERE c.id = ? LIMIT 1`,
      [params.id]
    );
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "Contract not found." }, { status: 404 });
    return NextResponse.json(rowToContract(row));
  } catch (err) {
    logger.error({ err, route: "GET /api/contracts/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to load contract." }, { status: 500 });
  }
}

// PUT /api/contracts/[id]
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const {
      vendorId, assetId, title, value, startDate, endDate,
      noticePeriodDays, autoRenews, owner, status, docUrl, notes,
    } = body;

    if (!title?.trim()) return NextResponse.json({ error: "Contract title is required." }, { status: 400 });

    const resolvedStatus: ContractStatus = status ?? "Active";
    if (!VALID_STATUSES.includes(resolvedStatus)) {
      return NextResponse.json({ error: "Invalid contract status." }, { status: 400 });
    }

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM contracts WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Contract not found." }, { status: 404 });

    const values = {
      vendorId: vendorId || null,
      assetId: assetId || null,
      title: title.trim(),
      value: value != null && value !== "" ? Number(value) : null,
      startDate: startDate || null,
      endDate: endDate || null,
      noticePeriodDays: noticePeriodDays != null && noticePeriodDays !== "" ? Number(noticePeriodDays) : null,
      autoRenews: !!autoRenews,
      owner: owner?.trim() || null,
      status: resolvedStatus,
      docUrl: docUrl?.trim() || null,
      notes: notes?.trim() || null,
    };

    await db.execute(
      `UPDATE contracts SET
         vendor_id=?, asset_id=?, title=?, value=?, start_date=?, end_date=?,
         notice_period_days=?, auto_renews=?, owner=?, status=?, doc_url=?, notes=?
       WHERE id=?`,
      [values.vendorId, values.assetId, values.title, values.value,
       values.startDate, values.endDate, values.noticePeriodDays, values.autoRenews,
       values.owner, values.status, values.docUrl, values.notes, params.id]
    );

    await writeAudit({
      tableName: "contracts", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: {
        vendorId: current.vendor_id, assetId: current.asset_id, title: current.title,
        value: current.value, startDate: current.start_date, endDate: current.end_date,
        noticePeriodDays: current.notice_period_days, autoRenews: !!current.auto_renews,
        owner: current.owner, status: current.status, docUrl: current.doc_url, notes: current.notes,
      },
      newValues: values,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/contracts/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to update contract." }, { status: 500 });
  }
}

// DELETE /api/contracts/[id]
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM contracts WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Contract not found." }, { status: 404 });

    await db.execute("DELETE FROM contracts WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "contracts", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { title: current.title, vendorId: current.vendor_id, assetId: current.asset_id },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/contracts/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to delete contract." }, { status: 500 });
  }
}
