/**
 * lib/setup.ts  —  SERVER ONLY
 *
 * Utilities for reading and writing site.config.json.
 * This file is the source of truth for whether the application
 * has been configured. It must never be imported by client components.
 */
import fs from "fs";
import path from "path";

export type DbDialect = "mysql" | "sqlite";

export interface MysqlDbConfig {
  dialect: "mysql";
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
}

export interface SqliteDbConfig {
  dialect: "sqlite";
  file: string;
}

export type DbConfig = MysqlDbConfig | SqliteDbConfig;

// Shape written by setup wizards before this change — no `dialect` key.
interface LegacyDbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
}

export interface SiteConfig {
  setupComplete: boolean;
  appName: string;
  orgName: string;
  db: DbConfig;
}

const CONFIG_PATH = path.join(process.cwd(), "site.config.json");

function normalizeDbConfig(db: DbConfig | LegacyDbConfig): DbConfig {
  if ("dialect" in db) return db;
  return { dialect: "mysql", ...db };
}

export function isSetupComplete(): boolean {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw) as SiteConfig;
    return config.setupComplete === true;
  } catch {
    return false;
  }
}

export function getSiteConfig(): SiteConfig | null {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as SiteConfig;
    return { ...parsed, db: normalizeDbConfig(parsed.db) };
  } catch {
    return null;
  }
}

export function writeSiteConfig(config: SiteConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}
