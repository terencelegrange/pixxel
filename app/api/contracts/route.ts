import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { Contract, ContractStatus } from "@/types";
import { requireUser } from "@/lib/require-user";
import { isExpiringWithin } from "@/lib/contracts";

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

// GET /api/contracts
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();

    const vendorId = req.nextUrl.searchParams.get("vendor");
    const assetId = req.nextUrl.searchParams.get("asset");
    const expiringParam = req.nextUrl.searchParams.get("expiring");

    const where: string[] = [];
    const params: string[] = [];
    if (vendorId) { where.push("c.vendor_id = ?"); params.push(vendorId); }
    if (assetId) { where.push("c.asset_id = ?"); params.push(assetId); }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT c.*, v.name AS vendor_name, a.name AS asset_name
       FROM contracts c
       LEFT JOIN vendors v ON v.id = c.vendor_id
       LEFT JOIN assets a ON a.id = c.asset_id
       ${whereSql}
       ORDER BY c.end_date IS NULL, c.end_date ASC, c.title ASC`,
      params
    );

    let contracts = rows.map(rowToContract);
    if (expiringParam) {
      const days = Number(expiringParam);
      contracts = contracts.filter((c) => isExpiringWithin(c, days));
    }

    return NextResponse.json({ contracts });
  } catch (err) {
    logger.error({ err, route: "GET /api/contracts" }, "request failed");
    return NextResponse.json({ error: "Failed to load contracts." }, { status: 500 });
  }
}

// POST /api/contracts
export async function POST(req: NextRequest) {
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
    const id = randomUUID();

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
      `INSERT INTO contracts
         (id, vendor_id, asset_id, title, value, start_date, end_date,
          notice_period_days, auto_renews, owner, status, doc_url, notes,
          created_by_id, created_by_name)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, values.vendorId, values.assetId, values.title, values.value,
       values.startDate, values.endDate, values.noticePeriodDays, values.autoRenews,
       values.owner, values.status, values.docUrl, values.notes, user.id, user.name]
    );

    await writeAudit({
      tableName: "contracts", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null, newValues: values,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: "POST /api/contracts" }, "request failed");
    return NextResponse.json({ error: "Failed to create contract." }, { status: 500 });
  }
}
