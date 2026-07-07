import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  const body = await req.json();
  const { dialect } = body;

  if (dialect === "sqlite") {
    const file = (body.file as string)?.trim();
    if (!file) {
      return NextResponse.json({ success: false, error: "A file path is required." }, { status: 400 });
    }
    if (path.isAbsolute(file) || !path.resolve(process.cwd(), file).startsWith(process.cwd())) {
      return NextResponse.json(
        { success: false, error: "Database file path must be a relative path within the project directory." },
        { status: 400 }
      );
    }
    try {
      // Mirror lib/db-sqlite.ts's getConnection(), which derives the directory
      // directly from the raw filePath (not joined with process.cwd() first).
      const dir = path.dirname(file);
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return NextResponse.json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Path is not writable.";
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
  }

  const { host, port, user, password, name } = body;
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
