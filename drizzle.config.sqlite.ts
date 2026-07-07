import type { Config } from "drizzle-kit";

export default {
  schema: "./drizzle/schema.sqlite.ts",
  out: "./drizzle/migrations-sqlite",
  dialect: "sqlite",
} satisfies Config;
