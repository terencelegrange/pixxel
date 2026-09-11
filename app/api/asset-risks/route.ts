import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";
import { AssetRisk, RiskCategory, RiskStatus, RiskLevel } from "@/types";
import logger from "@/lib/logger";

const VALID_CATEGORIES: RiskCategory[] = ["Operational", "Financial", "Compliance", "Security", "Vendor", "Reputational", "Other"];
const VALID_LEVELS: RiskLevel[] = ["Low", "Medium", "High", "Critical"];
const VALID_STATUSES: RiskStatus[] = ["Open", "Mitigating", "Accepted", "Closed"];

function rowToAssetRisk(row: mysql.RowDataPacket): AssetRisk {
  const toISO = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
  return {
    id: row.id,
    assetId: row.asset_id,
    assetName: row.asset_name ?? "",
    title: row.title,
    description: row.description ?? null,
    category: row.category,
    likelihood: row.likelihood,
    impact: row.impact,
    status: row.status,
    owner: row.owner ?? null,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    createdAt: toISO(row.created_at)!,
    updatedAt: toISO(row.updated_at)!,
  };
}

// GET /api/asset-risks
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();

    const assetId = req.nextUrl.searchParams.get("asset");
    const status = req.nextUrl.searchParams.get("status");
    const category = req.nextUrl.searchParams.get("category");

    const where: string[] = [];
    const params: string[] = [];
    if (assetId) { where.push("r.asset_id = ?"); params.push(assetId); }
    if (status) { where.push("r.status = ?"); params.push(status); }
    if (category) { where.push("r.category = ?"); params.push(category); }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT r.*, a.name AS asset_name
       FROM asset_risks r
       LEFT JOIN assets a ON a.id = r.asset_id
       ${whereSql}
       ORDER BY r.created_at DESC`,
      params
    );

    return NextResponse.json({ risks: rows.map(rowToAssetRisk) });
  } catch (err) {
    logger.error({ err, route: "GET /api/asset-risks" }, "request failed");
    return NextResponse.json({ error: "Failed to load risks." }, { status: 500 });
  }
}

// POST /api/asset-risks
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const { assetId, title, description, category, likelihood, impact, status, owner } = body;

    if (!assetId?.trim()) return NextResponse.json({ error: "Asset is required." }, { status: 400 });
    if (!title?.trim()) return NextResponse.json({ error: "Title is required." }, { status: 400 });

    const resolvedCategory: RiskCategory = category ?? "Operational";
    if (!VALID_CATEGORIES.includes(resolvedCategory)) {
      return NextResponse.json({ error: "Invalid risk category." }, { status: 400 });
    }
    const resolvedLikelihood: RiskLevel = likelihood ?? "Medium";
    const resolvedImpact: RiskLevel = impact ?? "Medium";
    if (!VALID_LEVELS.includes(resolvedLikelihood) || !VALID_LEVELS.includes(resolvedImpact)) {
      return NextResponse.json({ error: "likelihood and impact must be one of: Low, Medium, High, Critical." }, { status: 400 });
    }
    const resolvedStatus: RiskStatus = status ?? "Open";
    if (!VALID_STATUSES.includes(resolvedStatus)) {
      return NextResponse.json({ error: "Invalid risk status." }, { status: 400 });
    }

    const db = getDb();
    const id = randomUUID();
    const values = {
      assetId: assetId.trim(),
      title: title.trim(),
      description: description?.trim() || null,
      category: resolvedCategory,
      likelihood: resolvedLikelihood,
      impact: resolvedImpact,
      status: resolvedStatus,
      owner: owner?.trim() || null,
    };

    await db.execute(
      `INSERT INTO asset_risks
         (id, asset_id, title, description, category, likelihood, impact, status, owner, created_by_id, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, values.assetId, values.title, values.description, values.category,
       values.likelihood, values.impact, values.status, values.owner, user.id, user.name]
    );

    await writeAudit({
      tableName: "asset_risks", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null, newValues: values,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: "POST /api/asset-risks" }, "request failed");
    return NextResponse.json({ error: "Failed to create risk." }, { status: 500 });
  }
}
