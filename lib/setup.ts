/**
 * lib/setup.ts  —  SERVER ONLY
 *
 * Utilities for reading and writing site.config.json.
 * This file is the source of truth for whether the application
 * has been configured. It must never be imported by client components.
 */
import fs from "fs";
import path from "path";

export interface DbConfig {
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
    return JSON.parse(raw) as SiteConfig;
  } catch {
    return null;
  }
}

export function writeSiteConfig(config: SiteConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}
