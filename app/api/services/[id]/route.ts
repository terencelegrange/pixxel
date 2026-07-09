import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import mysql from "mysql2/promise";
import { getDb, setupDatabase, getDbDialect } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/require-user";
import { getComposedService } from "@/lib/services";
import { slugify, uniqueSlug } from "@/lib/slug";

const VALID_STATUSES = ["Planned", "Active", "Degraded", "Retired"] as const;
type ServiceStatus = typeof VALID_STATUSES[number];

// GET /api/services/[id]
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const service = await getComposedService(getDb(), getDbDialect(), { id: params.id });
    if (!service) return NextResponse.json({ error: "Service not found." }, { status: 404 });
    return NextResponse.json(service);
  } catch (err) {
    logger.error({ err, route: "GET /api/services/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to load service." }, { status: 500 });
  }
}

// PUT /api/services/[id]
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const { name, description, status, tierId, domainId, businessOwner, technicalOwner } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!VALID_STATUSES.includes(status as ServiceStatus))
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id, name, slug, description, status FROM services WHERE id = ? LIMIT 1",
      [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Service not found." }, { status: 404 });

    const trimmedName = name.trim();

    // Renames must not auto-change the slug; only recompute if an explicit
    // new slug is supplied and it differs from the current one.
    let slug = current.slug;
    if (body.slug && body.slug.trim() && slugify(body.slug.trim()) !== current.slug) {
      const base = slugify(body.slug.trim());
      slug = await uniqueSlug(base, async (c) => {
        const [r] = await db.execute<any[]>("SELECT 1 FROM services WHERE slug = ? AND id != ?", [c, params.id]);
        return r.length > 0;
      });
    }

    await db.execute(
      "UPDATE services SET name = ?, slug = ?, description = ?, status = ?, tier_id = ?, domain_id = ?, business_owner = ?, technical_owner = ? WHERE id = ?",
      [trimmedName, slug, description?.trim() || null, status, tierId || null, domainId || null, businessOwner?.trim() || null, technicalOwner?.trim() || null, params.id]
    );

    await writeAudit({
      tableName: "services", recordId: params.id, action: "UPDATE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name, slug: current.slug, status: current.status },
      newValues: { name: trimmedName, slug, status },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "PUT /api/services/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to update service." }, { status: 500 });
  }
}

// DELETE /api/services/[id]
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser(req, ["Admin", "Member"]);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id, name FROM services WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Service not found." }, { status: 404 });

    await db.execute("DELETE FROM service_assets WHERE service_id = ?", [params.id]);
    await db.execute("DELETE FROM services WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "services", recordId: params.id, action: "DELETE",
      performedById: user.id, performedByName: user.name,
      oldValues: { name: current.name },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, route: "DELETE /api/services/:id" }, "request failed");
    return NextResponse.json({ error: "Failed to delete service." }, { status: 500 });
  }
}
