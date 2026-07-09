/**
 * SQLite mirror of drizzle/schema.ts, used only to generate migration SQL
 * for SQLite trial mode via `npm run db:generate:sqlite`. Applied by a
 * custom runner in lib/db-sqlite.ts (not drizzle-orm's migrate()), so this
 * file's only job is producing correct CREATE TABLE statements.
 *
 * Enum columns use sqlite-core's `text(col, { enum: [...] })` for
 * TypeScript-level literal typing; SQLite has no ENUM/CHECK constraint
 * generated for these (app-level validation, already present in every
 * route before a write, is the enforcement layer for this trial-only path).
 */
import {
  sqliteTable, text, integer, real, primaryKey, index, uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const createdAt = () => text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull();
const updatedAt = () => text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull();
const createdBy = () => ({
  createdById: text("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique("uq_users_email"),
  password: text("password").notNull(),
  role: text("role").notNull().default("Member"),
  roleId: text("role_id"),
  tokenVersion: integer("token_version").notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const departments = sqliteTable("departments", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique("uq_departments_name"),
  description: text("description"),
  status: text("status", { enum: ["Published", "Unpublished"] }).notNull().default("Unpublished"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortCode: text("short_code"),
  description: text("description"),
  type: text("type", { enum: ["SaaS", "On-Premise", "Hybrid", "Cloud", "Open Source", "Other"] }).notNull().default("Other"),
  category: text("category").notNull().default("Application"),
  icon: text("icon").default("Server"),
  heroDiagramId: text("hero_diagram_id"),
  vendorId: text("vendor_id"),
  lifecycleStatus: text("lifecycle_status", { enum: ["Proposed", "Approved", "In Development", "Production", "Sunset", "Retired"] }).notNull().default("Proposed"),
  businessOwner: text("business_owner"),
  technicalOwner: text("technical_owner"),
  vendor: text("vendor"),
  slaAvailability: text("sla_availability"),
  slaRto: text("sla_rto"),
  slaRpo: text("sla_rpo"),
  goLiveDate: text("go_live_date"),
  retirementDate: text("retirement_date"),
  appUrl: text("app_url"),
  notes: text("notes"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  domainId: text("domain_id"),
  tierId: text("tier_id"),
  strategyId: text("strategy_id"),
  docUrl: text("doc_url"),
  contractEndDate: text("contract_end_date"),
  contractAmount: real("contract_amount"),
  complexityId: text("complexity_id"),
}, (t) => [
  index("idx_assets_lifecycle").on(t.lifecycleStatus),
]);

export const tiers = sqliteTable("tiers", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique("uq_tiers_name"),
  description: text("description"),
  slaAvailability: text("sla_availability"),
  supportHours: text("support_hours"),
  responseTime: text("response_time"),
  resolutionTime: text("resolution_time"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assetStrategies = sqliteTable("asset_strategies", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique("uq_asset_strategies_name"),
  description: text("description"),
  sortOrder: integer("sort_order"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const domains = sqliteTable("domains", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique("uq_domains_name"),
  description: text("description"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const vendors = sqliteTable("vendors", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique("uq_vendors_name"),
  website: text("website"),
  email: text("email"),
  phone: text("phone"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  stateProvince: text("state_province"),
  country: text("country"),
  postalCode: text("postal_code"),
  primaryContactName: text("primary_contact_name"),
  primaryContactRole: text("primary_contact_role"),
  primaryContactEmail: text("primary_contact_email"),
  primaryContactPhone: text("primary_contact_phone"),
  notes: text("notes"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assetDepartments = sqliteTable("asset_departments", {
  assetId: text("asset_id").notNull(),
  departmentId: text("department_id").notNull(),
}, (t) => [
  primaryKey({ columns: [t.assetId, t.departmentId] }),
  index("idx_asset_departments_dept").on(t.departmentId),
]);

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  action: text("action", { enum: ["CREATE", "UPDATE", "DELETE"] }).notNull(),
  performedById: text("performed_by_id").notNull(),
  performedByName: text("performed_by_name").notNull(),
  performedAt: text("performed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  oldValues: text("old_values"),
  newValues: text("new_values"),
}, (t) => [
  index("idx_audit_table_record").on(t.tableName, t.recordId),
  index("idx_audit_performed_at").on(t.performedAt),
]);

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique("uq_roles_name"),
  description: text("description"),
  permissionLevel: text("permission_level", { enum: ["read-only", "member", "admin"] }).notNull().default("member"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const supportRequests = sqliteTable("support_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  type: text("type", { enum: ["Feature Request", "Report Request", "Bug", "Other"] }).notNull().default("Feature Request"),
  subject: text("subject").notNull(),
  description: text("description"),
  status: text("status", { enum: ["New", "Acknowledged", "Under Review", "Will Fix", "Will Not Implement", "Completed"] }).notNull().default("New"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => [
  index("idx_support_user").on(t.userId),
]);

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["Active", "On Hold", "Completed", "Cancelled"] }).notNull().default("Active"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assetArchitects = sqliteTable("asset_architects", {
  assetId: text("asset_id").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
}, (t) => [
  primaryKey({ columns: [t.assetId, t.userId] }),
  index("idx_asset_architects_user").on(t.userId),
]);

export const projectAssets = sqliteTable("project_assets", {
  projectId: text("project_id").notNull(),
  assetId: text("asset_id").notNull(),
  dependencyType: text("dependency_type", { enum: ["upstream", "downstream"] }).notNull().default("downstream"),
  notes: text("notes"),
}, (t) => [
  primaryKey({ columns: [t.projectId, t.assetId] }),
  index("idx_project_assets_asset").on(t.assetId),
]);

export const diagrams = sqliteTable("diagrams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  projectId: text("project_id"),
  diagramTypeId: text("diagram_type_id"),
});

export const diagramVersions = sqliteTable("diagram_versions", {
  id: text("id").primaryKey(),
  diagramId: text("diagram_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  content: text("content").notNull(),
  createdById: text("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => [
  uniqueIndex("uq_diagram_version").on(t.diagramId, t.versionNumber),
  index("idx_diagram_versions_diagram").on(t.diagramId),
]);

export const diagramAssets = sqliteTable("diagram_assets", {
  diagramId: text("diagram_id").notNull(),
  assetId: text("asset_id").notNull(),
}, (t) => [
  primaryKey({ columns: [t.diagramId, t.assetId] }),
  index("idx_diagram_assets_asset").on(t.assetId),
]);

export const diagramTypes = sqliteTable("diagram_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique("uq_diagram_type_name"),
  description: text("description"),
  sortOrder: integer("sort_order"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assetComplexities = sqliteTable("asset_complexities", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique("uq_asset_complexities_name"),
  description: text("description"),
  sortOrder: integer("sort_order"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assetCapabilities = sqliteTable("asset_capabilities", {
  assetId: text("asset_id").notNull(),
  businessCapabilityId: text("business_capability_id").notNull(),
}, (t) => [
  primaryKey({ columns: [t.assetId, t.businessCapabilityId] }),
  index("idx_asset_capabilities_cap").on(t.businessCapabilityId),
]);

export const industrySectors = sqliteTable("industry_sectors", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique("uq_industry_sectors_name"),
  description: text("description"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const businessCapabilities = sqliteTable("business_capabilities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  industrySectorId: text("industry_sector_id").notNull(),
  sortOrder: integer("sort_order"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_business_capabilities_industry").on(t.industrySectorId),
]);

export const changelog = sqliteTable("changelog", {
  id: text("id").primaryKey(),
  version: text("version").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type", { enum: ["feature", "fix", "improvement", "breaking"] }).notNull().default("feature"),
  releasedAt: text("released_at").notNull(),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_changelog_released_at").on(t.releasedAt),
]);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: updatedAt(),
});

export const plantumlDiagrams = sqliteTable("plantuml_diagrams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  projectId: text("project_id"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const plantumlVersions = sqliteTable("plantuml_versions", {
  id: text("id").primaryKey(),
  diagramId: text("diagram_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  source: text("source").notNull(),
  createdById: text("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => [
  uniqueIndex("uq_plantuml_version").on(t.diagramId, t.versionNumber),
  index("idx_plantuml_versions_diagram").on(t.diagramId),
]);

export const plantumlDiagramAssets = sqliteTable("plantuml_diagram_assets", {
  diagramId: text("diagram_id").notNull(),
  assetId: text("asset_id").notNull(),
  matchedOn: text("matched_on"),
  taggedAt: text("tagged_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => [
  primaryKey({ columns: [t.diagramId, t.assetId] }),
  index("idx_pda_asset").on(t.assetId),
]);

export const investmentClassifications = sqliteTable("investment_classifications", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  sortOrder: integer("sort_order"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assetRoadmapPhases = sqliteTable("asset_roadmap_phases", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull(),
  classificationId: text("classification_id").notNull(),
  startQuarter: text("start_quarter").notNull(),
  endQuarter: text("end_quarter").notNull(),
  notes: text("notes"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_phases_asset_id").on(t.assetId),
  index("idx_phases_classification_id").on(t.classificationId),
]);

export const assetDependencies = sqliteTable("asset_dependencies", {
  id: text("id").primaryKey(),
  sourceAssetId: text("source_asset_id").notNull(),
  targetAssetId: text("target_asset_id").notNull(),
  type: text("type", { enum: ["API", "Database", "File Transfer", "Event / Message", "UI Embed", "Other"] }).notNull().default("API"),
  direction: text("direction", { enum: ["outbound", "bidirectional"] }).notNull().default("outbound"),
  notes: text("notes"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("uq_dep_pair").on(t.sourceAssetId, t.targetAssetId),
  index("idx_dep_source").on(t.sourceAssetId),
  index("idx_dep_target").on(t.targetAssetId),
]);

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique("uq_services_slug"),
  description: text("description"),
  status: text("status", { enum: ["Planned", "Active", "Degraded", "Retired"] }).notNull().default("Planned"),
  tierId: text("tier_id"),
  domainId: text("domain_id"),
  businessOwner: text("business_owner"),
  technicalOwner: text("technical_owner"),
  ...createdBy(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const serviceAssets = sqliteTable("service_assets", {
  serviceId: text("service_id").notNull(),
  assetId: text("asset_id").notNull(),
  role: text("role", { enum: ["Core", "Supporting", "Dependency"] }).notNull().default("Supporting"),
  notes: text("notes"),
}, (t) => [
  primaryKey({ columns: [t.serviceId, t.assetId] }),
  index("idx_service_assets_asset").on(t.assetId),
]);
