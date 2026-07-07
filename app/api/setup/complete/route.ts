import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { isSetupComplete, writeSiteConfig, type DbConfig } from "@/lib/setup";

export async function POST(req: Request) {
  // Guard: prevent re-running setup
  if (isSetupComplete()) {
    return NextResponse.json(
      { error: "Setup has already been completed." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { db, appName, orgName, admin } = body;

  // Validate
  if (!db?.dialect) {
    return NextResponse.json(
      { error: "Missing database configuration." },
      { status: 400 }
    );
  }
  if (db.dialect === "mysql" && (!db.host || !db.user || !db.name)) {
    return NextResponse.json(
      { error: "Missing database configuration." },
      { status: 400 }
    );
  }
  if (db.dialect === "sqlite" && !db.file?.trim()) {
    return NextResponse.json(
      { error: "A SQLite file path is required." },
      { status: 400 }
    );
  }
  if (!appName?.trim() || !orgName?.trim()) {
    return NextResponse.json(
      { error: "Application name and organisation name are required." },
      { status: 400 }
    );
  }
  if (!admin?.name?.trim() || !admin?.email?.trim() || !admin?.password) {
    return NextResponse.json(
      { error: "Admin name, email, and password are required." },
      { status: 400 }
    );
  }

  const dbConfig: DbConfig =
    db.dialect === "sqlite"
      ? { dialect: "sqlite", file: db.file.trim() }
      : {
          dialect: "mysql",
          host: db.host.trim(),
          port: Number(db.port) || 3306,
          user: db.user.trim(),
          password: db.password ?? "",
          name: db.name.trim(),
        };

  // 1. Write site.config.json (setupComplete: false for now so the DB
  //    pool can read credentials but setup isn't marked done yet)
  writeSiteConfig({
    setupComplete: false,
    appName: appName.trim(),
    orgName: orgName.trim(),
    db: dbConfig,
  });

  // 2. Write .env.local so credentials survive server restarts
  const envContent = (
    dbConfig.dialect === "sqlite"
      ? [`DB_TYPE=sqlite`, `DB_FILE=${dbConfig.file}`]
      : [
          `DB_TYPE=mysql`,
          `DB_HOST=${dbConfig.host}`,
          `DB_PORT=${dbConfig.port}`,
          `DB_USER=${dbConfig.user}`,
          `DB_PASSWORD=${dbConfig.password}`,
          `DB_NAME=${dbConfig.name}`,
        ]
  )
    .concat("")
    .join("\n");

  fs.writeFileSync(
    path.join(process.cwd(), ".env.local"),
    envContent,
    "utf-8"
  );

  try {
    // 3. Bootstrap the schema using the credentials just written to site.config.json.
    //    Reset any existing pool so it is recreated with the new credentials
    //    rather than the stale env vars that were loaded when the server started.
    const { setupDatabase, getDb, resetPool } = await import("@/lib/db");
    resetPool();
    await setupDatabase();

    // 4. Create the first admin user
    const hashedPassword = await bcrypt.hash(admin.password, 12);
    const userId = randomUUID();
    const db_pool = getDb();

    await db_pool.execute(
      `INSERT INTO users (id, name, email, password, role)
       VALUES (?, ?, ?, ?, 'Admin')`,
      [
        userId,
        admin.name.trim(),
        admin.email.toLowerCase().trim(),
        hashedPassword,
      ]
    );

    // 5. Mark setup complete
    writeSiteConfig({
      setupComplete: true,
      appName: appName.trim(),
      orgName: orgName.trim(),
      db: dbConfig,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    // Roll back site.config.json to incomplete state so the user can retry
    writeSiteConfig({
      setupComplete: false,
      appName: appName.trim(),
      orgName: orgName.trim(),
      db: dbConfig,
    });

    const message = err instanceof Error ? err.message : "Setup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
