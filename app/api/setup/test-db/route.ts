import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

export async function POST(req: Request) {
  const { host, port, user, password, name } = await req.json();

  if (!host || !user || !name) {
    return NextResponse.json(
      { success: false, error: "Host, user, and database name are required." },
      { status: 400 }
    );
  }

  let connection: mysql.Connection | undefined;
  try {
    connection = await mysql.createConnection({
      host,
      port: Number(port) || 3306,
      user,
      password: password ?? "",
      connectTimeout: 8000,
    });

    // Verify we can create (or the database already exists)
    await connection.execute(
      `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Connection failed.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
}
