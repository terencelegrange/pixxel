import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { Asset, AssetCategory, AssetType, LifecycleStatus } from "@/types";

// GET /api/assets/my-assets?userId=<id> — assets where user is an assigned architect
export async function GET(req: NextRequest) {
  try {
    await setupDatabase();
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT
         a.*,
         GROUP_CONCAT(DISTINCT ad.department_id ORDER BY d.name SEPARATOR ',')  AS department_ids,
         GROUP_CONCAT(DISTINCT d.name           ORDER BY d.name SEPARATOR '|')  AS department_names,
         GROUP_CONCAT(DISTINCT aa.user_id       ORDER BY aa.user_name SEPARATOR ',') AS architect_ids,
         GROUP_CONCAT(DISTINCT aa.user_name     ORDER BY aa.user_name SEPARATOR '|') AS architect_names,
         v.name AS vendor_name,
         dom.name AS domain_name,
         s.name AS strategy_name,
         c.name AS complexity_name,
         t.name AS tier_name
       FROM assets a
       INNER JOIN asset_architects my_aa ON my_aa.asset_id = a.id AND my_aa.user_id = ?
       LEFT JOIN asset_departments ad    ON ad.asset_id = a.id
       LEFT JOIN departments d           ON d.id = ad.department_id
       LEFT JOIN asset_architects aa     ON aa.asset_id = a.id
       LEFT JOIN vendors v               ON v.id = a.vendor_id
       LEFT JOIN domains dom             ON dom.id = a.domain_id
       LEFT JOIN asset_strategies s      ON s.id = a.strategy_id
       LEFT JOIN asset_complexities c    ON c.id = a.complexity_id
       LEFT JOIN tiers t                 ON t.id = a.tier_id
       GROUP BY a.id
       ORDER BY a.name ASC`,
      [userId]
    );

    const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
    const toDate = (v: unknown) => !v ? null : (v instanceof Date ? v.toISOString() : String(v)).split("T")[0];

    const assets: Asset[] = rows.map((row) => ({
      id: row.id, name: row.name,
      shortCode: row.short_code ?? null, description: row.description ?? null,
      type: row.type as AssetType, category: (row.category ?? "Application") as AssetCategory,
      icon: row.icon ?? null,
      lifecycleStatus: row.lifecycle_status as LifecycleStatus,
      departmentIds:   row.department_ids   ? String(row.department_ids).split(",").filter(Boolean)   : [],
      departmentNames: row.department_names ? String(row.department_names).split("|").filter(Boolean) : [],
      architectIds:    row.architect_ids    ? String(row.architect_ids).split(",").filter(Boolean)    : [],
      architectNames:  row.architect_names  ? String(row.architect_names).split("|").filter(Boolean)  : [],
      capabilityIds:   [],
      capabilityNames: [],
      tierId:       row.tier_id       ?? null, tierName:     row.tier_name     ?? null,
      strategyId:   row.strategy_id   ?? null, strategyName: row.strategy_name ?? null,
      complexityId:   row.complexity_id   ?? null, complexityName: row.complexity_name ?? null,
      domainId:   row.domain_id   ?? null, domainName: row.domain_name ?? null,
      vendorId:   row.vendor_id   ?? null, vendorName: row.vendor_name ?? null,
      businessOwner: row.business_owner ?? null, technicalOwner: row.technical_owner ?? null,
      vendor: row.vendor ?? null, slaAvailability: row.sla_availability ?? null,
      slaRto: row.sla_rto ?? null, slaRpo: row.sla_rpo ?? null,
      goLiveDate: toDate(row.go_live_date), retirementDate: toDate(row.retirement_date),
      appUrl: row.app_url ?? null, docUrl: row.doc_url ?? null,
      contractEndDate: toDate(row.contract_end_date),
      contractAmount: row.contract_amount != null ? Number(row.contract_amount) : null,
      notes: row.notes ?? null,
      createdById: row.created_by_id, createdByName: row.created_by_name,
      createdAt: toISO(row.created_at)!, updatedAt: toISO(row.updated_at)!,
    }));

    return NextResponse.json({ assets });
  } catch (err) {
    console.error("[GET /api/assets/my-assets]", err);
    return NextResponse.json({ error: "Failed to load assets." }, { status: 500 });
  }
}
