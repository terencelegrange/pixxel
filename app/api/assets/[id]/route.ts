import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase, withTransaction } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { Asset, AssetCategory, AssetType, LifecycleStatus } from "@/types";
import { requireUser } from "@/lib/require-user";

const VALID_TYPES: AssetType[] = ["SaaS", "On-Premise", "Hybrid", "Cloud", "Open Source", "Other"];
const VALID_STATUSES: LifecycleStatus[] = ["Proposed", "Approved", "In Development", "Production", "Sunset", "Retired"];

// GET /api/assets/[id] — fetch a single asset with aggregated departments
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT
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
       WHERE a.id = ?
       GROUP BY a.id
       LIMIT 1`,
      [params.id]
    );
    if (!rows[0]) return NextResponse.json({ error: "Asset not found." }, { status: 404 });

    const row = rows[0];
    const toISO  = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
    const toDate = (v: unknown) => !v ? null : (v instanceof Date ? v.toISOString() : String(v)).split("T")[0];

    const asset: Asset = {
      id: row.id, name: row.name,
      shortCode: row.short_code ?? null, description: row.description ?? null,
      type: row.type as AssetType, category: (row.category ?? "Application") as AssetCategory,
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
      tierId:       row.tier_id       ?? null,
      tierName:     row.tier_name     ?? null,
      strategyId:   row.strategy_id   ?? null,
      strategyName: row.strategy_name ?? null,
      complexityId:   row.complexity_id   ?? null,
      complexityName: row.complexity_name ?? null,
      domainId:   row.domain_id   ?? null,
      domainName: row.domain_name ?? null,
      vendorId:   row.vendor_id   ?? null,
      vendorName: row.vendor_name ?? null,
      businessOwner: row.business_owner ?? null, technicalOwner: row.technical_owner ?? null,
      slaAvailability: row.sla_availability ?? null,
      slaRto: row.sla_rto ?? null, slaRpo: row.sla_rpo ?? null,
      goLiveDate: toDate(row.go_live_date), retirementDate: toDate(row.retirement_date),
      appUrl: row.app_url ?? null,
      docUrl: row.doc_url ?? null,
      contractEndDate: toDate(row.contract_end_date),
      contractAmount: row.contract_amount != null ? Number(row.contract_amount) : null,
      notes: row.notes ?? null,
      createdById: row.created_by_id, createdByName: row.created_by_name,
      createdAt: toISO(row.created_at)!, updatedAt: toISO(row.updated_at)!,
    };

    return NextResponse.json({ asset });
  } catch (err) {
    logger.error({ err, route: "GET /api/assets/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to load asset." }, { status: 500 });
  }
}

// PUT /api/assets/[id] — update an asset
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const {
      name, shortCode, description, type, category, icon, lifecycleStatus,
      departmentIds, architectIds, capabilityIds, tierId, strategyId, complexityId, domainId, vendorId, businessOwner, technicalOwner,
      slaAvailability, slaRto, slaRpo,
      goLiveDate, retirementDate, appUrl, docUrl, contractEndDate, contractAmount, notes,
      heroDiagramId,
    } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Asset name is required." }, { status: 400 });
    if (!Array.isArray(departmentIds) || departmentIds.length === 0)
      return NextResponse.json({ error: "At least one department is required." }, { status: 400 });
    if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: "Invalid asset type." }, { status: 400 });
    if (!VALID_STATUSES.includes(lifecycleStatus)) return NextResponse.json({ error: "Invalid lifecycle status." }, { status: 400 });

    const db = getDb();

    // Fetch current state for audit
    const [[currentRows], [currentDepts], [currentArchs], [currentCaps]] = await Promise.all([
      db.execute<mysql.RowDataPacket[]>("SELECT * FROM assets WHERE id = ? LIMIT 1", [params.id]),
      db.execute<mysql.RowDataPacket[]>("SELECT department_id FROM asset_departments WHERE asset_id = ?", [params.id]),
      db.execute<mysql.RowDataPacket[]>("SELECT user_id FROM asset_architects WHERE asset_id = ?", [params.id]),
      db.execute<mysql.RowDataPacket[]>("SELECT business_capability_id FROM asset_capabilities WHERE asset_id = ?", [params.id]),
    ]);
    const current = currentRows[0];
    if (!current) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    const oldDeptIds = currentDepts.map((r) => r.department_id as string);
    const oldArchIds = currentArchs.map((r) => r.user_id as string);
    const oldCapIds = currentCaps.map((r) => r.business_capability_id as string);

    const toDate = (v: unknown) => v instanceof Date ? v.toISOString().split("T")[0] : v ? String(v).split("T")[0] : null;

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
      contractEndDate: contractEndDate || null,
      contractAmount: contractAmount != null && contractAmount !== "" ? Number(contractAmount) : null,
      notes: notes?.trim() || null,
    };

    await withTransaction(async (tx) => {
      await tx.execute(
        `UPDATE assets SET
           name=?, short_code=?, description=?, type=?, category=?, icon=?, hero_diagram_id=?, tier_id=?, strategy_id=?, complexity_id=?, domain_id=?, vendor_id=?,
           lifecycle_status=?, business_owner=?, technical_owner=?,
           sla_availability=?, sla_rto=?, sla_rpo=?,
           go_live_date=?, retirement_date=?, app_url=?, doc_url=?, contract_end_date=?, contract_amount=?, notes=?
         WHERE id=?`,
        [values.name, values.shortCode, values.description, values.type, values.category,
         values.icon, values.heroDiagramId, values.tierId, values.strategyId, values.complexityId, values.domainId, values.vendorId, values.lifecycleStatus,
         values.businessOwner, values.technicalOwner,
         values.slaAvailability, values.slaRto, values.slaRpo,
         values.goLiveDate, values.retirementDate, values.appUrl, values.docUrl, values.contractEndDate, values.contractAmount,
         values.notes, params.id]
      );

      // Replace department junction rows
      await tx.execute("DELETE FROM asset_departments WHERE asset_id = ?", [params.id]);
      for (const deptId of values.departmentIds) {
        await tx.execute(
          "INSERT IGNORE INTO asset_departments (asset_id, department_id) VALUES (?, ?)",
          [params.id, deptId]
        );
      }
      // Replace architect junction rows
      await tx.execute("DELETE FROM asset_architects WHERE asset_id = ?", [params.id]);
      for (const uid of values.architectIds) {
        const [uRows] = await tx.execute<mysql.RowDataPacket[]>(
          "SELECT name FROM users WHERE id = ? LIMIT 1", [uid]
        );
        if (uRows[0]) {
          await tx.execute(
            "INSERT IGNORE INTO asset_architects (asset_id, user_id, user_name) VALUES (?, ?, ?)",
            [params.id, uid, uRows[0].name]
          );
        }
      }
      // Replace capability junction rows
      await tx.execute("DELETE FROM asset_capabilities WHERE asset_id = ?", [params.id]);
      for (const capId of values.capabilityIds) {
        await tx.execute(
          "INSERT IGNORE INTO asset_capabilities (asset_id, business_capability_id) VALUES (?, ?)",
          [params.id, capId]
        );
      }
    });

    await writeAudit({
      tableName: "assets", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: {
        name: current.name, shortCode: current.short_code, description: current.description,
        type: current.type, category: current.category, icon: current.icon,
        heroDiagramId: current.hero_diagram_id ?? null,
        lifecycleStatus: current.lifecycle_status, departmentIds: oldDeptIds,
        architectIds: oldArchIds, capabilityIds: oldCapIds,
        tierId: current.tier_id,
        strategyId: current.strategy_id,
        complexityId: current.complexity_id,
        domainId: current.domain_id,
        vendorId: current.vendor_id,
        businessOwner: current.business_owner, technicalOwner: current.technical_owner, slaAvailability: current.sla_availability,
        slaRto: current.sla_rto, slaRpo: current.sla_rpo,
        goLiveDate: toDate(current.go_live_date), retirementDate: toDate(current.retirement_date),
        appUrl: current.app_url, docUrl: current.doc_url,
        contractEndDate: toDate(current.contract_end_date), contractAmount: current.contract_amount,
        notes: current.notes,
      },
      newValues: values,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/assets/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to update asset." }, { status: 500 });
  }
}

// DELETE /api/assets/[id] — delete an asset and its department links
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();

    const db = getDb();

    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM assets WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Asset not found." }, { status: 404 });

    await withTransaction(async (tx) => {
      await tx.execute("DELETE FROM asset_departments WHERE asset_id = ?", [params.id]);
      await tx.execute("DELETE FROM asset_architects WHERE asset_id = ?", [params.id]);
      await tx.execute("DELETE FROM asset_capabilities WHERE asset_id = ?", [params.id]);
      await tx.execute("DELETE FROM assets WHERE id = ?", [params.id]);
    });

    await writeAudit({
      tableName: "assets", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, type: current.type, lifecycleStatus: current.lifecycle_status },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/assets/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to delete asset." }, { status: 500 });
  }
}
