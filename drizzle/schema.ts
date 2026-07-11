/**
 * drizzle/schema.ts
 *
 * Source of truth for the database schema, used only to generate migration
 * SQL via drizzle-kit — the app itself still queries through mysql2 (see
 * lib/db.ts). Keep this in sync with reality: after changing a table here,
 * run `npx drizzle-kit generate` to produce the migration file, then
 * `npx drizzle-kit migrate` (or just boot the app) to apply it.
 */
import {
  mysqlTable, char, varchar, text, longtext, int, datetime, date, decimal,
  mysqlEnum, primaryKey, index, uniqueIndex, boolean,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

// drizzle-orm's .defaultNow()/.onUpdateNow() chain methods only exist on the
// `timestamp` column builder, not `datetime` — but the real columns are
// DATETIME (not TIMESTAMP, which is tz-converting and 2038-limited), so we
// express the same defaults as raw SQL to match the actual column type.
const createdAt = () => datetime("created_at").default(sql`CURRENT_TIMESTAMP`).notNull();
const updatedAt = () => datetime("updated_at").default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull();
const createdBy = () => ({
  createdById: char("created_by_id", { length: 36 }).notNull(),
  createdByName: varchar("created_by_name", { length: 255 }).notNull(),
});

export const users = mysqlTable("users", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique("uq_users_email"),
  password: varchar("password", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("Member"),
  roleId: char("role_id", { length: 36 }),
  tokenVersion: int("token_version", { unsigned: true }).notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const departments = mysqlTable("departments", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique("uq_departments_name"),
  description: text("description"),
  status: mysqlEnum("status", ["Published", "Unpublished"]).notNull().default("Unpublished"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assets = mysqlTable("assets", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  shortCode: varchar("short_code", { length: 50 }),
  description: text("description"),
  type: mysqlEnum("type", ["SaaS", "On-Premise", "Hybrid", "Cloud", "Open Source", "Other"]).notNull().default("Other"),
  category: varchar("category", { length: 100 }).notNull().default("Application"),
  icon: varchar("icon", { length: 100 }).default("Server"),
  heroDiagramId: char("hero_diagram_id", { length: 36 }),
  vendorId: char("vendor_id", { length: 36 }),
  lifecycleStatus: mysqlEnum("lifecycle_status", ["Proposed", "Approved", "In Development", "Production", "Sunset", "Retired"]).notNull().default("Proposed"),
  businessOwner: varchar("business_owner", { length: 255 }),
  technicalOwner: varchar("technical_owner", { length: 255 }),
  vendor: varchar("vendor", { length: 255 }),
  slaAvailability: varchar("sla_availability", { length: 50 }),
  slaRto: varchar("sla_rto", { length: 100 }),
  slaRpo: varchar("sla_rpo", { length: 100 }),
  goLiveDate: date("go_live_date"),
  retirementDate: date("retirement_date"),
  appUrl: varchar("app_url", { length: 500 }),
  notes: text("notes"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  domainId: char("domain_id", { length: 36 }),
  tierId: char("tier_id", { length: 36 }),
  strategyId: char("strategy_id", { length: 36 }),
  docUrl: varchar("doc_url", { length: 500 }),
  contractEndDate: date("contract_end_date"),
  contractAmount: decimal("contract_amount", { precision: 15, scale: 2 }),
  complexityId: char("complexity_id", { length: 36 }),
}, (t) => [
  index("idx_assets_lifecycle").on(t.lifecycleStatus),
]);

export const tiers = mysqlTable("tiers", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique("uq_tiers_name"),
  description: text("description"),
  slaAvailability: varchar("sla_availability", { length: 50 }),
  supportHours: varchar("support_hours", { length: 100 }),
  responseTime: varchar("response_time", { length: 100 }),
  resolutionTime: varchar("resolution_time", { length: 100 }),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assetStrategies = mysqlTable("asset_strategies", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique("uq_asset_strategies_name"),
  description: text("description"),
  sortOrder: int("sort_order", { unsigned: true }),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const domains = mysqlTable("domains", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique("uq_domains_name"),
  description: text("description"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const vendors = mysqlTable("vendors", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique("uq_vendors_name"),
  website: varchar("website", { length: 500 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 100 }),
  addressLine1: varchar("address_line1", { length: 255 }),
  addressLine2: varchar("address_line2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  stateProvince: varchar("state_province", { length: 100 }),
  country: varchar("country", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  primaryContactName: varchar("primary_contact_name", { length: 255 }),
  primaryContactRole: varchar("primary_contact_role", { length: 100 }),
  primaryContactEmail: varchar("primary_contact_email", { length: 255 }),
  primaryContactPhone: varchar("primary_contact_phone", { length: 100 }),
  notes: text("notes"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const contracts = mysqlTable("contracts", {
  id: char("id", { length: 36 }).primaryKey(),
  vendorId: char("vendor_id", { length: 36 }),
  assetId: char("asset_id", { length: 36 }),
  title: varchar("title", { length: 255 }).notNull(),
  value: decimal("value", { precision: 15, scale: 2 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  noticePeriodDays: int("notice_period_days", { unsigned: true }),
  autoRenews: boolean("auto_renews").notNull().default(false),
  owner: varchar("owner", { length: 255 }),
  status: mysqlEnum("status", ["Active", "Terminated"]).notNull().default("Active"),
  docUrl: varchar("doc_url", { length: 500 }),
  notes: text("notes"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_contracts_vendor").on(t.vendorId),
  index("idx_contracts_asset").on(t.assetId),
]);

export const assetDepartments = mysqlTable("asset_departments", {
  assetId: char("asset_id", { length: 36 }).notNull(),
  departmentId: char("department_id", { length: 36 }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.assetId, t.departmentId] }),
  index("idx_asset_departments_dept").on(t.departmentId),
]);

export const auditLog = mysqlTable("audit_log", {
  id: char("id", { length: 36 }).primaryKey(),
  tableName: varchar("table_name", { length: 100 }).notNull(),
  recordId: char("record_id", { length: 36 }).notNull(),
  action: mysqlEnum("action", ["CREATE", "UPDATE", "DELETE"]).notNull(),
  performedById: char("performed_by_id", { length: 36 }).notNull(),
  performedByName: varchar("performed_by_name", { length: 255 }).notNull(),
  performedAt: datetime("performed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  oldValues: longtext("old_values"),
  newValues: longtext("new_values"),
}, (t) => [
  index("idx_audit_table_record").on(t.tableName, t.recordId),
  index("idx_audit_performed_at").on(t.performedAt),
]);

export const roles = mysqlTable("roles", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique("uq_roles_name"),
  description: text("description"),
  permissionLevel: mysqlEnum("permission_level", ["read-only", "member", "admin"]).notNull().default("member"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const supportRequests = mysqlTable("support_requests", {
  id: char("id", { length: 36 }).primaryKey(),
  userId: char("user_id", { length: 36 }).notNull(),
  userName: varchar("user_name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["Feature Request", "Report Request", "Bug", "Other"]).notNull().default("Feature Request"),
  subject: varchar("subject", { length: 500 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["New", "Acknowledged", "Under Review", "Will Fix", "Will Not Implement", "Completed"]).notNull().default("New"),
  createdAt: datetime("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => [
  index("idx_support_user").on(t.userId),
]);

export const projects = mysqlTable("projects", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["Active", "On Hold", "Completed", "Cancelled"]).notNull().default("Active"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assetArchitects = mysqlTable("asset_architects", {
  assetId: char("asset_id", { length: 36 }).notNull(),
  userId: char("user_id", { length: 36 }).notNull(),
  userName: varchar("user_name", { length: 255 }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.assetId, t.userId] }),
  index("idx_asset_architects_user").on(t.userId),
]);

export const projectAssets = mysqlTable("project_assets", {
  projectId: char("project_id", { length: 36 }).notNull(),
  assetId: char("asset_id", { length: 36 }).notNull(),
  dependencyType: mysqlEnum("dependency_type", ["upstream", "downstream"]).notNull().default("downstream"),
  notes: text("notes"),
}, (t) => [
  primaryKey({ columns: [t.projectId, t.assetId] }),
  index("idx_project_assets_asset").on(t.assetId),
]);

export const diagrams = mysqlTable("diagrams", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  projectId: char("project_id", { length: 36 }),
  diagramTypeId: char("diagram_type_id", { length: 36 }),
});

export const diagramVersions = mysqlTable("diagram_versions", {
  id: char("id", { length: 36 }).primaryKey(),
  diagramId: char("diagram_id", { length: 36 }).notNull(),
  versionNumber: int("version_number", { unsigned: true }).notNull(),
  content: longtext("content").notNull(),
  createdById: char("created_by_id", { length: 36 }).notNull(),
  createdByName: varchar("created_by_name", { length: 255 }).notNull(),
  createdAt: datetime("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => [
  uniqueIndex("uq_diagram_version").on(t.diagramId, t.versionNumber),
  index("idx_diagram_versions_diagram").on(t.diagramId),
]);

export const diagramAssets = mysqlTable("diagram_assets", {
  diagramId: char("diagram_id", { length: 36 }).notNull(),
  assetId: char("asset_id", { length: 36 }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.diagramId, t.assetId] }),
  index("idx_diagram_assets_asset").on(t.assetId),
]);

export const diagramTypes = mysqlTable("diagram_types", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique("uq_diagram_type_name"),
  description: text("description"),
  sortOrder: int("sort_order", { unsigned: true }),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assetComplexities = mysqlTable("asset_complexities", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique("uq_asset_complexities_name"),
  description: text("description"),
  sortOrder: int("sort_order", { unsigned: true }),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assetCapabilities = mysqlTable("asset_capabilities", {
  assetId: char("asset_id", { length: 36 }).notNull(),
  businessCapabilityId: char("business_capability_id", { length: 36 }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.assetId, t.businessCapabilityId] }),
  index("idx_asset_capabilities_cap").on(t.businessCapabilityId),
]);

export const industrySectors = mysqlTable("industry_sectors", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique("uq_industry_sectors_name"),
  description: text("description"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const businessCapabilities = mysqlTable("business_capabilities", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  industrySectorId: char("industry_sector_id", { length: 36 }).notNull(),
  sortOrder: int("sort_order", { unsigned: true }),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_business_capabilities_industry").on(t.industrySectorId),
]);

export const changelog = mysqlTable("changelog", {
  id: char("id", { length: 36 }).primaryKey(),
  version: varchar("version", { length: 50 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["feature", "fix", "improvement", "breaking"]).notNull().default("feature"),
  releasedAt: date("released_at").notNull(),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_changelog_released_at").on(t.releasedAt),
]);

export const appSettings = mysqlTable("app_settings", {
  key: varchar("key", { length: 255 }).primaryKey(),
  value: text("value"),
  updatedAt: updatedAt(),
});

export const plantumlDiagrams = mysqlTable("plantuml_diagrams", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  projectId: char("project_id", { length: 36 }),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const plantumlVersions = mysqlTable("plantuml_versions", {
  id: char("id", { length: 36 }).primaryKey(),
  diagramId: char("diagram_id", { length: 36 }).notNull(),
  versionNumber: int("version_number", { unsigned: true }).notNull(),
  source: longtext("source").notNull(),
  createdById: char("created_by_id", { length: 36 }).notNull(),
  createdByName: varchar("created_by_name", { length: 255 }).notNull(),
  createdAt: datetime("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => [
  uniqueIndex("uq_plantuml_version").on(t.diagramId, t.versionNumber),
  index("idx_plantuml_versions_diagram").on(t.diagramId),
]);

export const plantumlDiagramAssets = mysqlTable("plantuml_diagram_assets", {
  diagramId: char("diagram_id", { length: 36 }).notNull(),
  assetId: char("asset_id", { length: 36 }).notNull(),
  matchedOn: varchar("matched_on", { length: 255 }),
  taggedAt: datetime("tagged_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => [
  primaryKey({ columns: [t.diagramId, t.assetId] }),
  index("idx_pda_asset").on(t.assetId),
]);

export const investmentClassifications = mysqlTable("investment_classifications", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).notNull(),
  sortOrder: int("sort_order", { unsigned: true }),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assetRoadmapPhases = mysqlTable("asset_roadmap_phases", {
  id: char("id", { length: 36 }).primaryKey(),
  assetId: char("asset_id", { length: 36 }).notNull(),
  classificationId: char("classification_id", { length: 36 }).notNull(),
  startQuarter: varchar("start_quarter", { length: 7 }).notNull(),
  endQuarter: varchar("end_quarter", { length: 7 }).notNull(),
  notes: text("notes"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_phases_asset_id").on(t.assetId),
  index("idx_phases_classification_id").on(t.classificationId),
]);

export const assetDependencies = mysqlTable("asset_dependencies", {
  id: char("id", { length: 36 }).primaryKey(),
  sourceAssetId: char("source_asset_id", { length: 36 }).notNull(),
  targetAssetId: char("target_asset_id", { length: 36 }).notNull(),
  type: mysqlEnum("type", ["API", "Database", "File Transfer", "Event / Message", "UI Embed", "Other"]).notNull().default("API"),
  direction: mysqlEnum("direction", ["outbound", "bidirectional"]).notNull().default("outbound"),
  notes: text("notes"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("uq_dep_pair").on(t.sourceAssetId, t.targetAssetId),
  index("idx_dep_source").on(t.sourceAssetId),
  index("idx_dep_target").on(t.targetAssetId),
]);

// Referenced above only so `sql` stays imported for future defaults that need
// raw SQL (e.g. seed data migrations) — harmless if unused by a given table.
void sql;
