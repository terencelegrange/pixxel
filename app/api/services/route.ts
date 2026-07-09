import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase, getDbDialect } from "@/lib/db";
import { nowSql } from "@/lib/sql-compat";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";
import { slugify, uniqueSlug } from "@/lib/slug";

const VALID_STATUSES = ["Planned", "Active", "Degraded", "Retired"] as const;

// GET /api/services — list all services with asset count
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(`
      SELECT s.id, s.name, s.slug, s.description, s.status,
             s.tier_id, t.name AS tier_name,
             s.domain_id, d.name AS domain_name,
             s.business_owner, s.technical_owner,
             s.created_by_id, s.created_by_name,
             s.created_at, s.updated_at,
             COUNT(sa.asset_id) AS asset_count
      FROM services s
      LEFT JOIN service_assets sa ON sa.service_id = s.id
      LEFT JOIN tiers t ON t.id = s.tier_id
      LEFT JOIN domains d ON d.id = s.domain_id
      GROUP BY s.id
      ORDER BY s.name ASC
    `);
    const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
    const services = rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description ?? null,
      status: r.status,
      tierId: r.tier_id ?? null,
      tierName: r.tier_name ?? null,
      domainId: r.domain_id ?? null,
      domainName: r.domain_name ?? null,
      businessOwner: r.business_owner ?? null,
      technicalOwner: r.technical_owner ?? null,
      assetCount: Number(r.asset_count),
      createdById: r.created_by_id,
      createdByName: r.created_by_name,
      createdAt: toISO(r.created_at)!,
      updatedAt: toISO(r.updated_at)!,
    }));
    return NextResponse.json({ services });
  } catch (err) {
    logger.error({ err, route: "GET /api/services" }, "request failed");
    return NextResponse.json({ error: "Failed to load services." }, { status: 500 });
  }
}

// POST /api/services — create service
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, description, status, tierId, domainId, businessOwner, technicalOwner } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (status && !VALID_STATUSES.includes(status))
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });

    const id = randomUUID();
    const trimmedName = name.trim();
    const resolvedStatus = status ?? "Planned";

    const db = getDb();
    const base = slugify(body.slug?.trim() || name);
    const slug = await uniqueSlug(base, async (c) => {
      const [r] = await db.execute<any[]>("SELECT 1 FROM services WHERE slug = ?", [c]);
      return r.length > 0;
    });

    const now = nowSql(getDbDialect());
    await db.execute(
      `INSERT INTO services (id, name, slug, description, status, tier_id, domain_id, business_owner, technical_owner, created_by_id, created_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${now}, ${now})`,
      [id, trimmedName, slug, description?.trim() || null, resolvedStatus, tierId || null, domainId || null, businessOwner?.trim() || null, technicalOwner?.trim() || null, user.id, user.name]
    );

    await writeAudit({
      tableName: "services", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null,
      newValues: { name: trimmedName, slug, status: resolvedStatus },
    });

    return NextResponse.json({ id, slug }, { status: 201 });
  } catch (err) {
    logger.error({ err, route: "POST /api/services" }, "request failed");
    return NextResponse.json({ error: "Failed to create service." }, { status: 500 });
  }
}
