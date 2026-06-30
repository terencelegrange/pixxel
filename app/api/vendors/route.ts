import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { Vendor } from "@/types";
import { requireUser } from "@/lib/require-user";

function rowToVendor(row: mysql.RowDataPacket): Vendor {
  const toISO = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
  return {
    id: row.id, name: row.name,
    website:              row.website               ?? null,
    email:                row.email                 ?? null,
    phone:                row.phone                 ?? null,
    addressLine1:         row.address_line1         ?? null,
    addressLine2:         row.address_line2         ?? null,
    city:                 row.city                  ?? null,
    stateProvince:        row.state_province        ?? null,
    country:              row.country               ?? null,
    postalCode:           row.postal_code           ?? null,
    primaryContactName:   row.primary_contact_name  ?? null,
    primaryContactRole:   row.primary_contact_role  ?? null,
    primaryContactEmail:  row.primary_contact_email ?? null,
    primaryContactPhone:  row.primary_contact_phone ?? null,
    notes:                row.notes                 ?? null,
    createdById:   row.created_by_id,
    createdByName: row.created_by_name,
    createdAt:     toISO(row.created_at)!,
    updatedAt:     toISO(row.updated_at)!,
  };
}

// GET /api/vendors
export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  try {
    await setupDatabase();
    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM vendors ORDER BY name ASC"
    );
    return NextResponse.json({ vendors: rows.map(rowToVendor) });
  } catch (err) {
    console.error("[GET /api/vendors]", err);
    return NextResponse.json({ error: "Failed to load vendors." }, { status: 500 });
  }
}

// POST /api/vendors
export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;
  const { user } = auth;
  try {
    await setupDatabase();
    const body = await req.json();
    const {
      name, website, email, phone,
      addressLine1, addressLine2, city, stateProvince, country, postalCode,
      primaryContactName, primaryContactRole, primaryContactEmail, primaryContactPhone,
      notes,
    } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Vendor name is required." }, { status: 400 });

    const db = getDb();
    const id = randomUUID();

    const values = {
      name: name.trim(),
      website:             website?.trim()             || null,
      email:               email?.trim()               || null,
      phone:               phone?.trim()               || null,
      addressLine1:        addressLine1?.trim()        || null,
      addressLine2:        addressLine2?.trim()        || null,
      city:                city?.trim()                || null,
      stateProvince:       stateProvince?.trim()       || null,
      country:             country?.trim()             || null,
      postalCode:          postalCode?.trim()          || null,
      primaryContactName:  primaryContactName?.trim()  || null,
      primaryContactRole:  primaryContactRole?.trim()  || null,
      primaryContactEmail: primaryContactEmail?.trim() || null,
      primaryContactPhone: primaryContactPhone?.trim() || null,
      notes:               notes?.trim()               || null,
    };

    await db.execute(
      `INSERT INTO vendors
         (id, name, website, email, phone,
          address_line1, address_line2, city, state_province, country, postal_code,
          primary_contact_name, primary_contact_role, primary_contact_email, primary_contact_phone,
          notes, created_by_id, created_by_name)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, values.name, values.website, values.email, values.phone,
       values.addressLine1, values.addressLine2, values.city, values.stateProvince,
       values.country, values.postalCode,
       values.primaryContactName, values.primaryContactRole,
       values.primaryContactEmail, values.primaryContactPhone,
       values.notes, user.id, user.name]
    );

    await writeAudit({
      tableName: "vendors", recordId: id, action: "CREATE",
      performedById: user.id, performedByName: user.name,
      oldValues: null, newValues: values,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/vendors]", err);
    return NextResponse.json({ error: "Failed to create vendor." }, { status: 500 });
  }
}
