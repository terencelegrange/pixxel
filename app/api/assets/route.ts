import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase, withTransaction, getDbDialect } from "@/lib/db";
import { insertIgnoreSql } from "@/lib/sql-compat";
import { writeAudit } from "@/lib/audit";
import { Asset, AssetCategory, AssetType, LifecycleStatus } from "@/types";
import { requireUser } from "@/lib/require-user";

const VALID_TYPES: AssetType[] = ["SaaS", "On-Premise", "Hybrid", "Cloud", "Open Source", "Other"];
const VALID_STATUSES: LifecycleStatus[] = ["Proposed", "Approved", "In Development", "Production", "Sunset", "Retired"];

function rowToAsset(row: mysql.RowDataPacket): Asset {
  const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
  const toDate = (v: unknown) => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().split("T")[0];
    return String(v).split("T")[0];
  };
  return {
    id: row.id,
    name: row.name,
    shortCode: row.short_code ?? null,
    description: row.description ?? null,
    type: row.type as AssetType,
    category: (row.category ?? "Application") as AssetCategory,
    icon: row.icon ?? null,
    heroDiagramId: row.hero_diagram_id ?? null,
    heroDiagramName: row.hero_diagram_name ?? null,
    lifecycleStatus: row.lifecycle_status as LifecycleStatus,
    departmentIds:   row.department_ids   ? String(row.department_ids).split(",").filter(Boolean)   : [],
    departmentNames: row.department_names ? String(row.department_names).split("|").filter(Boolean) : [],
    architectIds:    row.architect_ids    ? String(row.architect_ids).split(",").filter(Boolean)    : [],
    architectNames:  row.architect_names  ? String(row.architect_names).split("|").filter(Boolean)  : [],
    capabilityIds:   row.capability_ids   ? String(row.capability_ids).split(",").filter(Boolean)   : [],
    capabilityNames: row.capability_names ? String(row.capability_names).split("|").filter(Boolean) : [],
    tierId:       row.tier_id        ?? null,
    tierName:     row.tier_name      ?? null,
    strategyId:   row.strategy_id   ?? null,
    strategyName: row.strategy_name ?? null,
    complexityId:   row.complexity_id   ?? null,
    complexityName: row.complexity_name ?? null,
    domainId:   row.domain_id   ?? null,
    domainName: row.domain_name ?? null,
    vendorId:   row.vendor_id   ?? null,
    vendorName: row.vendor_name ?? null,
    businessOwner: row.business_owner ?? null,
    technicalOwner: row.technical_owner ?? null,
    slaAvailability: row.sla_availability ?? null,
    slaRto: row.sla_rto ?? null,
    slaRpo: row.sla_rpo ?? null,
    goLiveDate: toDate(row.go_live_date),
    retirementDate: toDate(row.retirement_date),
    appUrl: row.app_url ?? null,
    docUrl: row.doc_url ?? null,
    notes: row.notes ?? null,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    createdAt: toISO(row.created_at)!,
    updatedAt: toISO(row.updated_at)!,
  };
}

// GET /api/assets — list all, aggregating department names via junction table
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const dialect = getDbDialect();
    const query = dialect === "sqlite" ? `
      SELECT
        a.*,
        (SELECT GROUP_CONCAT(department_id, ',') FROM (SELECT ad.department_id AS department_id FROM asset_departments ad JOIN departments d ON d.id = ad.department_id WHERE ad.asset_id = a.id ORDER BY d.name)) AS department_ids,
        (SELECT GROUP_CONCAT(name, '|') FROM (SELECT d.name AS name FROM asset_departments ad JOIN departments d ON d.id = ad.department_id WHERE ad.asset_id = a.id ORDER BY d.name)) AS department_names,
        (SELECT GROUP_CONCAT(user_id, ',') FROM (SELECT aa.user_id AS user_id FROM asset_architects aa WHERE aa.asset_id = a.id ORDER BY aa.user_name)) AS architect_ids,
        (SELECT GROUP_CONCAT(user_name, '|') FROM (SELECT aa.user_name AS user_name FROM asset_architects aa WHERE aa.asset_id = a.id ORDER BY aa.user_name)) AS architect_names,
        (SELECT GROUP_CONCAT(business_capability_id, ',') FROM (SELECT ac.business_capability_id AS business_capability_id FROM asset_capabilities ac JOIN business_capabilities bc ON bc.id = ac.business_capability_id WHERE ac.asset_id = a.id ORDER BY bc.name)) AS capability_ids,
        (SELECT GROUP_CONCAT(name, '|') FROM (SELECT bc.name AS name FROM asset_capabilities ac JOIN business_capabilities bc ON bc.id = ac.business_capability_id WHERE ac.asset_id = a.id ORDER BY bc.name)) AS capability_names,
        v.name AS vendor_name,
        dom.name AS domain_name,
        s.name AS strategy_name,
        c.name AS complexity_name,
        t.name AS tier_name,
        hd.name AS hero_diagram_name
      FROM assets a
      LEFT JOIN vendors v             ON v.id = a.vendor_id
      LEFT JOIN domains dom           ON dom.id = a.domain_id
      LEFT JOIN asset_strategies s    ON s.id = a.strategy_id
      LEFT JOIN asset_complexities c  ON c.id = a.complexity_id
      LEFT JOIN tiers t               ON t.id = a.tier_id
      LEFT JOIN diagrams hd           ON hd.id = a.hero_diagram_id
      ORDER BY a.name ASC
    ` : `
      SELECT
        a.*,
        GROUP_CONCAT(DISTINCT ad.department_id ORDER BY d.name SEPARATOR ',')  AS department_ids,
        GROUP_CONCAT(DISTINCT d.name           ORDER BY d.name SEPARATOR '|')  AS department_names,
        GROUP_CONCAT(DISTINCT aa.user_id       ORDER BY aa.user_name SEPARATOR ',') AS architect_ids,
        GROUP_CONCAT(DISTINCT aa.user_name     ORDER BY aa.user_name SEPARATOR '|') AS architect_names,
        GROUP_CONCAT(DISTINCT ac.business_capability_id ORDER BY bc.name SEPARATOR ',') AS capability_ids,
        GROUP_CONCAT(DISTINCT bc.name                   ORDER BY bc.name SEPARATOR '|') AS capability_names,
        v.name AS vendor_name,
        dom.name AS domain_name,
        s.name AS strategy_name,
        c.name AS complexity_name,
        t.name AS tier_name,
        hd.name AS hero_diagram_name
      FROM assets a
      LEFT JOIN asset_departments ad  ON ad.asset_id = a.id
      LEFT JOIN departments d         ON d.id = ad.department_id
      LEFT JOIN asset_architects aa   ON aa.asset_id = a.id
      LEFT JOIN asset_capabilities ac    ON ac.asset_id = a.id
      LEFT JOIN business_capabilities bc ON bc.id = ac.business_capability_id
      LEFT JOIN vendors v             ON v.id = a.vendor_id
      LEFT JOIN domains dom           ON dom.id = a.domain_id
      LEFT JOIN asset_strategies s    ON s.id = a.strategy_id
      LEFT JOIN asset_complexities c  ON c.id = a.complexity_id
      LEFT JOIN tiers t               ON t.id = a.tier_id
      LEFT JOIN diagrams hd           ON hd.id = a.hero_diagram_id
      GROUP BY a.id
      ORDER BY a.name ASC
    `;
    const [rows] = await db.execute<mysql.RowDataPacket[]>(query);
    return NextResponse.json({ assets: rows.map(rowToAsset) });
  } catch (err) {
    logger.error({ err, route: "GET /api/assets" }, "request failed");
    return NextResponse.json({ error: "Failed to load assets." }, { status: 500 });
  }
}

// POST /api/assets — create an asset
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const {
      name, shortCode, description, type, category, icon, lifecycleStatus,
      departmentIds, architectIds, capabilityIds, tierId, strategyId, complexityId, domainId, vendorId, businessOwner, technicalOwner,
      slaAvailability, slaRto, slaRpo,
      goLiveDate, retirementDate, appUrl, docUrl, notes,
      heroDiagramId,
    } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Asset name is required." }, { status: 400 });
    if (!Array.isArray(departmentIds) || departmentIds.length === 0)
      return NextResponse.json({ error: "At least one department is required." }, { status: 400 });
    if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: "Invalid asset type." }, { status: 400 });
    if (!VALID_STATUSES.includes(lifecycleStatus)) return NextResponse.json({ error: "Invalid lifecycle status." }, { status: 400 });

    const id = randomUUID();

    const values = {
      name: name.trim(),
      shortCode: shortCode?.trim() || null,
      description: description?.trim() || null,
      type,
      category: category || "Application",
      icon: icon || "Server",
      heroDiagramId: heroDiagramId || null,
      lifecycleStatus,
      departmentIds: departmentIds as string[],
      architectIds: Array.isArray(architectIds) ? architectIds as string[] : [],
      capabilityIds: Array.isArray(capabilityIds) ? capabilityIds as string[] : [],
      tierId: tierId || null,
      strategyId: strategyId || null,
      complexityId: complexityId || null,
      domainId: domainId || null,
      vendorId: vendorId || null,
      businessOwner: businessOwner?.trim() || null,
      technicalOwner: technicalOwner?.trim() || null,
      slaAvailability: slaAvailability?.trim() || null,
      slaRto: slaRto?.trim() || null,
      slaRpo: slaRpo?.trim() || null,
      goLiveDate: goLiveDate || null,
      retirementDate: retirementDate || null,
      appUrl: appUrl?.trim() || null,
      docUrl: docUrl?.trim() || null,
      notes: notes?.trim() || null,
    };

    await withTransaction(async (tx) => {
      const dialect = getDbDialect();
      await tx.execute(
        `INSERT INTO assets
           (id, name, short_code, description, type, category, icon, hero_diagram_id, tier_id, strategy_id, complexity_id, domain_id, vendor_id, lifecycle_status,
            business_owner, technical_owner, sla_availability, sla_rto, sla_rpo,
            go_live_date, retirement_date, app_url, doc_url, notes, created_by_id, created_by_name)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, values.name, values.shortCode, values.description, values.type, values.category,
         values.icon, values.heroDiagramId, values.tierId, values.strategyId, values.complexityId, values.domainId, values.vendorId, values.lifecycleStatus, values.businessOwner,
         values.technicalOwner, values.slaAvailability, values.slaRto, values.slaRpo,
         values.goLiveDate, values.retirementDate, values.appUrl, values.docUrl,
         values.notes, user.id, user.name]
      );

      // Insert junction rows
      for (const deptId of values.departmentIds) {
        await tx.execute(
          insertIgnoreSql("asset_departments", ["asset_id", "department_id"], dialect),
          [id, deptId]
        );
      }
      // Insert architect junction rows (fetch user names from users table)
      for (const uid of values.architectIds) {
        const [uRows] = await tx.execute<mysql.RowDataPacket[]>(
          "SELECT name FROM users WHERE id = ? LIMIT 1", [uid]
        );
        if (uRows[0]) {
          await tx.execute(
            insertIgnoreSql("asset_architects", ["asset_id", "user_id", "user_name"], dialect),
            [id, uid, uRows[0].name]
          );
        }
      }
      // Insert capability junction rows
      for (const capId of values.capabilityIds) {
        await tx.execute(
          insertIgnoreSql("asset_capabilities", ["asset_id", "business_capability_id"], dialect),
          [id, capId]
        );
      }
    });

    await writeAudit({
      tableName: "assets", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null, newValues: { ...values, departmentIds: values.departmentIds, capabilityIds: values.capabilityIds },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: "POST /api/assets" }, "request failed");
    return NextResponse.json({ error: "Failed to create asset." }, { status: 500 });
  }
}
