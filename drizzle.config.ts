import type { Config } from "drizzle-kit";
import { getDbCredentials } from "./lib/db";

const creds = getDbCredentials();
if (!creds) {
  throw new Error(
    "Database credentials not configured. Set DB_* environment variables or complete /setup before running drizzle-kit."
  );
}

export default {
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "mysql",
  dbCredentials: {
    host: creds.host,
    port: creds.port,
    user: creds.user,
    password: creds.password,
    database: creds.database,
  },
} satisfies Config;
