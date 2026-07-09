import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase, withTransaction, getDbDialect } from "@/lib/db";
import { insertIgnoreSql } from "@/lib/sql-compat";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";
import { VALID_TYPES, VALID_STATUSES } from "@/app/api/assets/route";

function normalizeKey(k: string): string {
  return k.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const REQUIRED_COLUMNS = ["name", "department"];
const KNOWN_COLUMNS = new Set([
  "name", "department", "short_code", "description", "type", "category",
  "lifecycle_status", "business_owner", "technical_owner", "domain", "vendor",
  "tier", "strategy", "notes", "app_url", "architects", "capabilities",
  "complexity", "hero_diagram",
]);

interface RowResult {
  row: number;
  status: "created" | "failed";
  assetId?: string;
  warnings: string[];
  error?: string;
}

function splitMulti(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(/[;|]/).map((s) => s.trim()).filter(Boolean);
}

async function loadNameMap(db: ReturnType<typeof getDb>, table: string): Promise<Map<string, { id: string; name: string }>> {
  const [rows] = await db.execute<mysql.RowDataPacket[]>(`SELECT id, name FROM ${table}`);
  const map = new Map<string, { id: string; name: string }>();
  for (const row of rows) {
    map.set(String(row.name).toLowerCase(), { id: row.id, name: row.name });
  }
  return map;
}

// POST /api/assets/bulk — create many assets from pre-parsed CSV rows
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const rows: Record<string, string>[] = Array.isArray(body?.rows) ? body.rows : [];

    const headerKeys = new Set(Object.keys(rows[0] ?? {}).map(normalizeKey));
    const missingColumns = REQUIRED_COLUMNS.filter((c) => !headerKeys.has(c));
    if (missingColumns.length > 0) {
      return NextResponse.json(
        { error: `Missing required column(s): ${missingColumns.join(", ")}` },
        { status: 400 }
      );
    }

    const db = getDb();

    // Preload all lookup tables up front (one query per table).
    const [domainMap, vendorMap, tierMap, strategyMap, complexityMap, diagramMap, userMap, capabilityMap, departmentMap] =
      await Promise.all([
        loadNameMap(db, "domains"),
        loadNameMap(db, "vendors"),
        loadNameMap(db, "tiers"),
        loadNameMap(db, "asset_strategies"),
        loadNameMap(db, "asset_complexities"),
        loadNameMap(db, "diagrams"),
        loadNameMap(db, "users"),
        loadNameMap(db, "business_capabilities"),
        loadNameMap(db, "departments"),
      ]);

    const departmentsCreated: string[] = [];
    const departmentsCreatedKeys = new Set<string>();

    const results: RowResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i];
      const normRow: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawRow ?? {})) {
        const nk = normalizeKey(k);
        if (KNOWN_COLUMNS.has(nk)) normRow[nk] = v;
      }

      const name = normRow.name?.trim();
      if (!name) {
        results.push({ row: i, status: "failed", warnings: [], error: "Missing required field: name" });
        continue;
      }

      const warnings: string[] = [];

      // department: resolve, creating new departments on the fly (deduped across the request)
      const deptIds: string[] = [];
      for (const deptName of splitMulti(normRow.department)) {
        const key = deptName.toLowerCase();
        let dept = departmentMap.get(key);
        if (!dept) {
          const deptId = randomUUID();
          await db.execute(
            `INSERT INTO departments (id, name, description, status, created_by_id, created_by_name)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [deptId, deptName, null, "Unpublished", user.id, user.name]
          );
          dept = { id: deptId, name: deptName };
          departmentMap.set(key, dept);
          if (!departmentsCreatedKeys.has(key)) {
            departmentsCreatedKeys.add(key);
            departmentsCreated.push(deptName);
          }
          await writeAudit({
            tableName: "departments", recordId: deptId, action: "CREATE",
            performedById: user.id, performedByName: user.name,
            oldValues: null, newValues: { name: deptName, description: null, status: "Unpublished" },
          });
        }
        deptIds.push(dept.id);
      }

      // architects: name lookup, unmatched -> warning (not a failure)
      const architects: { id: string; name: string }[] = [];
      for (const architectName of splitMulti(normRow.architects)) {
        const match = userMap.get(architectName.toLowerCase());
        if (match) architects.push(match);
        else warnings.push(`Architect '${architectName}' not found — skipped`);
      }

      // capabilities: name lookup, unmatched -> warning (not a failure)
      const capabilityIds: string[] = [];
      for (const capName of splitMulti(normRow.capabilities)) {
        const match = capabilityMap.get(capName.toLowerCase());
        if (match) capabilityIds.push(match.id);
        else warnings.push(`Capability '${capName}' not found — skipped`);
      }

      // single-value name lookups: unmatched -> null + warning, never a hard failure
      const resolveSingle = (map: Map<string, { id: string; name: string }>, value: string | undefined, label: string): string | null => {
        const trimmed = value?.trim();
        if (!trimmed) return null;
        const match = map.get(trimmed.toLowerCase());
        if (!match) {
          warnings.push(`${label} '${trimmed}' not found — skipped`);
          return null;
        }
        return match.id;
      };
      const domainId = resolveSingle(domainMap, normRow.domain, "Domain");
      const vendorId = resolveSingle(vendorMap, normRow.vendor, "Vendor");
      const tierId = resolveSingle(tierMap, normRow.tier, "Tier");
      const strategyId = resolveSingle(strategyMap, normRow.strategy, "Strategy");
      const complexityId = resolveSingle(complexityMap, normRow.complexity, "Complexity");
      const heroDiagramId = resolveSingle(diagramMap, normRow.hero_diagram, "Hero diagram");

      // type: default "Other"; invalid -> fall back with warning
      let type = normRow.type?.trim() || "Other";
      if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
        warnings.push(`Type '${type}' is not valid — defaulting to Other`);
        type = "Other";
      }

      // lifecycle_status: default "Proposed"; invalid -> fall back with warning
      let lifecycleStatus = normRow.lifecycle_status?.trim() || "Proposed";
      if (!VALID_STATUSES.includes(lifecycleStatus as (typeof VALID_STATUSES)[number])) {
        warnings.push(`Lifecycle status '${lifecycleStatus}' is not valid — defaulting to Proposed`);
        lifecycleStatus = "Proposed";
      }

      const category = normRow.category?.trim() || "Application";

      const values = {
        name,
        shortCode: normRow.short_code?.trim() || null,
        description: normRow.description?.trim() || null,
        type,
        category,
        icon: "Server",
        heroDiagramId,
        tierId,
        strategyId,
        complexityId,
        domainId,
        vendorId,
        lifecycleStatus,
        businessOwner: normRow.business_owner?.trim() || null,
        technicalOwner: normRow.technical_owner?.trim() || null,
        slaAvailability: null as string | null,
        slaRto: null as string | null,
        slaRpo: null as string | null,
        goLiveDate: null as string | null,
        retirementDate: null as string | null,
        appUrl: normRow.app_url?.trim() || null,
        docUrl: null as string | null,
        contractEndDate: null as string | null,
        contractAmount: null as number | null,
        notes: normRow.notes?.trim() || null,
        departmentIds: deptIds,
        architectIds: architects.map((a) => a.id),
        capabilityIds,
      };

      const assetId = randomUUID();
      try {
        await withTransaction(async (tx) => {
          const dialect = getDbDialect();
          await tx.execute(
            `INSERT INTO assets
               (id, name, short_code, description, type, category, icon, hero_diagram_id, tier_id, strategy_id, complexity_id, domain_id, vendor_id, lifecycle_status,
                business_owner, technical_owner, sla_availability, sla_rto, sla_rpo,
                go_live_date, retirement_date, app_url, doc_url, contract_end_date, contract_amount, notes, created_by_id, created_by_name)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [assetId, values.name, values.shortCode, values.description, values.type, values.category,
             values.icon, values.heroDiagramId, values.tierId, values.strategyId, values.complexityId, values.domainId, values.vendorId, values.lifecycleStatus,
             values.businessOwner, values.technicalOwner, values.slaAvailability, values.slaRto, values.slaRpo,
             values.goLiveDate, values.retirementDate, values.appUrl, values.docUrl, values.contractEndDate, values.contractAmount,
             values.notes, user.id, user.name]
          );

          for (const deptId of deptIds) {
            await tx.execute(
              insertIgnoreSql("asset_departments", ["asset_id", "department_id"], dialect),
              [assetId, deptId]
            );
          }
          for (const architect of architects) {
            await tx.execute(
              insertIgnoreSql("asset_architects", ["asset_id", "user_id", "user_name"], dialect),
              [assetId, architect.id, architect.name]
            );
          }
          for (const capId of capabilityIds) {
            await tx.execute(
              insertIgnoreSql("asset_capabilities", ["asset_id", "business_capability_id"], dialect),
              [assetId, capId]
            );
          }
        });

        await writeAudit({
          tableName: "assets", recordId: assetId, action: "CREATE",
          performedById: user.id, performedByName: user.name,
          oldValues: null, newValues: values,
        });

        results.push({ row: i, status: "created", assetId, warnings });
      } catch (err) {
        logger.error({ err, route: "POST /api/assets/bulk", row: i }, "row insert failed");
        results.push({ row: i, status: "failed", warnings, error: "Failed to create asset." });
      }
    }

    return NextResponse.json({
      summary: {
        total: rows.length,
        created: results.filter((r) => r.status === "created").length,
        failed: results.filter((r) => r.status === "failed").length,
        departmentsCreated,
      },
      results,
    });
  } catch (err) {
    logger.error({ err, route: "POST /api/assets/bulk" }, "request failed");
    return NextResponse.json({ error: "Failed to process bulk upload." }, { status: 500 });
  }
}
