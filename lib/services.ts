import type { DbClient } from "@/lib/db-sqlite";
import type { DbDialect } from "@/lib/setup";
import type { Service, ServiceAsset } from "@/types";

const ROLE_ORDER: Record<string, number> = { Core: 0, Supporting: 1, Dependency: 2 };

export async function getComposedService(
  db: DbClient,
  _dialect: DbDialect,
  opts: { id?: string; slug?: string }
): Promise<(Service & { members: ServiceAsset[] }) | null> {
  const [rows] = await db.execute<any[]>(
    `SELECT s.*, t.name AS tier_name, d.name AS domain_name
     FROM services s
     LEFT JOIN tiers t ON t.id = s.tier_id
     LEFT JOIN domains d ON d.id = s.domain_id
     WHERE ${opts.id ? "s.id = ?" : "s.slug = ?"}`,
    [opts.id ?? opts.slug]
  );
  const row = rows[0];
  if (!row) return null;

  const [memberRows] = await db.execute<any[]>(
    `SELECT sa.role, sa.notes, a.id AS asset_id, a.name AS asset_name, a.type AS asset_type,
            a.icon AS asset_icon, a.lifecycle_status, t.name AS tier_name
     FROM service_assets sa
     JOIN assets a ON a.id = sa.asset_id
     LEFT JOIN tiers t ON t.id = a.tier_id
     WHERE sa.service_id = ?`,
    [row.id]
  );

  const toISO = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : "");
  const members: ServiceAsset[] = memberRows
    .map((r: any) => ({
      assetId: r.asset_id, assetName: r.asset_name, assetType: r.asset_type,
      assetIcon: r.asset_icon ?? null, lifecycleStatus: r.lifecycle_status,
      tierName: r.tier_name ?? null, role: r.role, notes: r.notes ?? null,
    }))
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);

  return {
    id: row.id, name: row.name, slug: row.slug, description: row.description ?? null,
    status: row.status, tierId: row.tier_id ?? null, tierName: row.tier_name ?? null,
    domainId: row.domain_id ?? null, domainName: row.domain_name ?? null,
    businessOwner: row.business_owner ?? null, technicalOwner: row.technical_owner ?? null,
    createdById: row.created_by_id, createdByName: row.created_by_name,
    createdAt: toISO(row.created_at), updatedAt: toISO(row.updated_at),
    members,
  };
}
