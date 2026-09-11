import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { LifecycleStatus } from "@/types";
import { requireUser } from "@/lib/require-user";

export interface MatrixAsset {
  id: string;
  name: string;
  type: string;
  icon: string | null;
}

export interface MatrixCapability {
  id: string;
  name: string;
  sortOrder: number | null;
  total: number;
  byStatus: Record<LifecycleStatus, MatrixAsset[]>;
}

export interface MatrixSector {
  id: string;
  name: string;
  capabilities: MatrixCapability[];
}

// GET /api/reports/capabilities-matrix
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();

    // Fetch all sectors → capabilities → assigned assets in one query
    const [rows] = await db.execute<mysql.RowDataPacket[]>(`
      SELECT
        s.id          AS sector_id,
        s.name        AS sector_name,
        bc.id         AS capability_id,
        bc.name       AS capability_name,
        bc.sort_order,
        a.id          AS asset_id,
        a.name        AS asset_name,
        a.type        AS asset_type,
        a.icon        AS asset_icon,
        a.lifecycle_status
      FROM industry_sectors s
      JOIN business_capabilities bc ON bc.industry_sector_id = s.id
      LEFT JOIN asset_capabilities ac ON ac.business_capability_id = bc.id
      LEFT JOIN assets a ON a.id = ac.asset_id
      ORDER BY s.name ASC,
               bc.sort_order IS NULL ASC,
               bc.sort_order ASC,
               bc.name ASC,
               a.name ASC
    `);

    const STATUSES: LifecycleStatus[] = [
      "Proposed", "Approved", "In Development", "Production", "Sunset", "Retired",
    ];

    // Build nested structure
    const sectorMap = new Map<string, MatrixSector>();

    for (const row of rows) {
      // Ensure sector exists
      if (!sectorMap.has(row.sector_id)) {
        sectorMap.set(row.sector_id, {
          id: row.sector_id,
          name: row.sector_name,
          capabilities: [],
        });
      }
      const sector = sectorMap.get(row.sector_id)!;

      // Ensure capability exists within sector
      let cap = sector.capabilities.find((c) => c.id === row.capability_id);
      if (!cap) {
        const emptyByStatus = Object.fromEntries(
          STATUSES.map((s) => [s, [] as MatrixAsset[]])
        ) as unknown as Record<LifecycleStatus, MatrixAsset[]>;
        cap = {
          id: row.capability_id,
          name: row.capability_name,
          sortOrder: row.sort_order ?? null,
          total: 0,
          byStatus: emptyByStatus,
        };
        sector.capabilities.push(cap);
      }

      // Add asset if present (LEFT JOIN means asset may be null)
      if (row.asset_id) {
        const status = row.lifecycle_status as LifecycleStatus;
        if (STATUSES.includes(status)) {
          cap.byStatus[status].push({
            id: row.asset_id,
            name: row.asset_name,
            type: row.asset_type,
            icon: row.asset_icon ?? null,
          });
          cap.total += 1;
        }
      }
    }

    const matrix: MatrixSector[] = Array.from(sectorMap.values());

    return NextResponse.json({ matrix, statuses: STATUSES });
  } catch (err) {
    logger.error({ err, route: "GET /api/reports/capabilities-matrix" }, "request failed");
    return NextResponse.json({ error: "Failed to load capabilities matrix." }, { status: 500 });
  }
}
