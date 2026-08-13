import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";
import { RiskCategory, RiskStatus, RiskLevel } from "@/types";
import logger from "@/lib/logger";

const VALID_CATEGORIES: RiskCategory[] = ["Operational", "Financial", "Compliance", "Security", "Vendor", "Reputational", "Other"];
const VALID_LEVELS: RiskLevel[] = ["Low", "Medium", "High", "Critical"];
const VALID_STATUSES: RiskStatus[] = ["Open", "Mitigating", "Accepted", "Closed"];

// PUT /api/asset-risks/[id]
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM asset_risks WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Risk not found." }, { status: 404 });

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
      `UPDATE asset_risks SET
         asset_id=?, title=?, description=?, category=?, likelihood=?, impact=?, status=?, owner=?
       WHERE id=?`,
      [values.assetId, values.title, values.description, values.category,
       values.likelihood, values.impact, values.status, values.owner, params.id]
    );

    await writeAudit({
      tableName: "asset_risks", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: {
        assetId: current.asset_id, title: current.title, description: current.description,
        category: current.category, likelihood: current.likelihood, impact: current.impact,
        status: current.status, owner: current.owner,
      },
      newValues: values,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/asset-risks/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to update risk." }, { status: 500 });
  }
}

// DELETE /api/asset-risks/[id]
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM asset_risks WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Risk not found." }, { status: 404 });

    await db.execute("DELETE FROM asset_risks WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "asset_risks", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { title: current.title, assetId: current.asset_id },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/asset-risks/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to delete risk." }, { status: 500 });
  }
}
