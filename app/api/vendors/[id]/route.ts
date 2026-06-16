import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getDb, setupDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

// PUT /api/vendors/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const body = await req.json();
    const {
      name, website, email, phone,
      addressLine1, addressLine2, city, stateProvince, country, postalCode,
      primaryContactName, primaryContactRole, primaryContactEmail, primaryContactPhone,
      notes, userId, userName,
    } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Vendor name is required." }, { status: 400 });
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM vendors WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });

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
      `UPDATE vendors SET
         name=?, website=?, email=?, phone=?,
         address_line1=?, address_line2=?, city=?, state_province=?, country=?, postal_code=?,
         primary_contact_name=?, primary_contact_role=?, primary_contact_email=?, primary_contact_phone=?,
         notes=?
       WHERE id=?`,
      [values.name, values.website, values.email, values.phone,
       values.addressLine1, values.addressLine2, values.city, values.stateProvince,
       values.country, values.postalCode,
       values.primaryContactName, values.primaryContactRole,
       values.primaryContactEmail, values.primaryContactPhone,
       values.notes, params.id]
    );

    await writeAudit({
      tableName: "vendors", recordId: params.id, action: "UPDATE",
      performedById: userId, performedByName: userName,
      oldValues: {
        name: current.name, website: current.website, email: current.email, phone: current.phone,
        addressLine1: current.address_line1, addressLine2: current.address_line2,
        city: current.city, stateProvince: current.state_province,
        country: current.country, postalCode: current.postal_code,
        primaryContactName: current.primary_contact_name,
        primaryContactRole: current.primary_contact_role,
        primaryContactEmail: current.primary_contact_email,
        primaryContactPhone: current.primary_contact_phone,
        notes: current.notes,
      },
      newValues: values,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PUT /api/vendors/:id]", err);
    return NextResponse.json({ error: "Failed to update vendor." }, { status: 500 });
  }
}

// DELETE /api/vendors/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await setupDatabase();
    const { userId, userName } = await req.json() as { userId?: string; userName?: string };
    if (!userId || !userName) return NextResponse.json({ error: "Authenticated user is required." }, { status: 401 });

    const db = getDb();
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM vendors WHERE id = ? LIMIT 1", [params.id]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });

    // Unlink assets before deleting
    await db.execute("UPDATE assets SET vendor_id = NULL WHERE vendor_id = ?", [params.id]);
    await db.execute("DELETE FROM vendors WHERE id = ?", [params.id]);

    await writeAudit({
      tableName: "vendors", recordId: params.id, action: "DELETE",
      performedById: userId, performedByName: userName,
      oldValues: { name: current.name, email: current.email, country: current.country },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/vendors/:id]", err);
    return NextResponse.json({ error: "Failed to delete vendor." }, { status: 500 });
  }
}
