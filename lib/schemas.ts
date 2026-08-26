/**
 * lib/schemas.ts  —  SERVER ONLY
 *
 * Zod schemas for every write endpoint. Each schema:
 *   - Trims strings automatically (.trim())
 *   - Normalises email to lowercase
 *   - Caps password at 72 chars (bcrypt processes only the first 72 bytes)
 *   - Strips unknown keys (.strict() or .strip() depending on the endpoint)
 *   - Provides consistent enum gating
 *
 * Import the relevant schema in each route and pass it to validate().
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Reusable primitives
// ---------------------------------------------------------------------------
const nonEmptyString = (label: string, max = 255) =>
  z.string().trim().min(1, `${label} is required.`).max(max);

const optionalString = (max = 255) =>
  z.string().trim().max(max).optional().nullable();

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Must be a valid email address.");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.");  // bcrypt limit

// "" and null/undefined both mean "not provided" for numeric form fields --
// z.coerce.number() alone would turn "" into 0, not null.
const optionalNumber = () =>
  z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().nullable());

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const LoginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required."),
});

export const RegisterSchema = z.object({
  name: nonEmptyString("Name"),
  email,
  password,
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const userRole = z.enum(["Admin", "Member", "Viewer"], {
  message: "Role must be Admin, Member, or Viewer.",
});

export const CreateUserSchema = z.object({
  name: nonEmptyString("Name"),
  email,
  password,
  role: userRole,
});

export const UpdateUserSchema = z.object({
  name: nonEmptyString("Name").optional(),
  role: userRole.optional(),
  roleId: z.string().uuid("roleId must be a valid UUID.").optional().nullable(),
});

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
const permissionLevel = z.enum(["read-only", "member", "admin"], {
  message: "permissionLevel must be one of: read-only, member, admin.",
});

export const CreateRoleSchema = z.object({
  name: nonEmptyString("Role name"),
  description: optionalString(1000),
  permissionLevel,
});

export const UpdateRoleSchema = CreateRoleSchema.partial();

// ---------------------------------------------------------------------------
// Organisations / Departments
// ---------------------------------------------------------------------------
export const CreateOrgSchema = z.object({
  name: nonEmptyString("Name"),
  description: optionalString(1000),
  status: z.enum(["Published", "Unpublished"]).optional().default("Unpublished"),
});

export const UpdateOrgSchema = CreateOrgSchema.partial();

// ---------------------------------------------------------------------------
// Domains
// ---------------------------------------------------------------------------
export const CreateDomainSchema = z.object({
  name: nonEmptyString("Name"),
  description: optionalString(1000),
});

export const UpdateDomainSchema = CreateDomainSchema.partial();

// ---------------------------------------------------------------------------
// Asset Strategies
// ---------------------------------------------------------------------------
export const CreateAssetStrategySchema = z.object({
  name: nonEmptyString("Name"),
  description: optionalString(1000),
  sortOrder: z.number().int().nonnegative().optional().nullable(),
});

export const UpdateAssetStrategySchema = CreateAssetStrategySchema.partial();

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------
export const CreateTierSchema = z.object({
  name: nonEmptyString("Name"),
  description: optionalString(1000),
  slaAvailability: optionalString(50),
  supportHours: optionalString(100),
  responseTime: optionalString(100),
  resolutionTime: optionalString(100),
});

export const UpdateTierSchema = CreateTierSchema.partial();

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------
export const CreateVendorSchema = z.object({
  name: nonEmptyString("Vendor name"),
  website: optionalString(500),
  email: z.string().trim().toLowerCase().email().optional().nullable().or(z.literal("")),
  phone: optionalString(100),
  addressLine1: optionalString(),
  addressLine2: optionalString(),
  city: optionalString(100),
  stateProvince: optionalString(100),
  country: optionalString(100),
  postalCode: optionalString(20),
  primaryContactName: optionalString(),
  primaryContactRole: optionalString(100),
  primaryContactEmail: z.string().trim().toLowerCase().email().optional().nullable().or(z.literal("")),
  primaryContactPhone: optionalString(100),
  notes: optionalString(5000),
});

export const UpdateVendorSchema = CreateVendorSchema.partial();

// ---------------------------------------------------------------------------
// Support requests
// ---------------------------------------------------------------------------
export const CreateSupportSchema = z.object({
  type: z.enum(["Feature Request", "Report Request", "Bug", "Other"], {
    message: "Invalid support request type.",
  }),
  subject: nonEmptyString("Subject", 500),
  description: optionalString(5000),
});

export const UpdateSupportStatusSchema = z.object({
  status: z.enum(
    ["New", "Acknowledged", "Under Review", "Will Fix", "Will Not Implement", "Completed"],
    { message: "Invalid status value." }
  ),
});

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export const CreateProjectSchema = z.object({
  name: nonEmptyString("Project name"),
  description: optionalString(1000),
  status: z.enum(["Active", "On Hold", "Completed", "Cancelled"]).optional().default("Active"),
  startDate: z.string().trim().optional().nullable(),
  endDate: z.string().trim().optional().nullable(),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------
export const CreateAssetSchema = z.object({
  name: nonEmptyString("Asset name"),
  shortCode: optionalString(50),
  description: optionalString(5000),
  type: z.enum(["SaaS", "On-Premise", "Hybrid", "Cloud", "Open Source", "Other"], {
    message: "Invalid asset type.",
  }),
  category: optionalString(100),
  icon: optionalString(100),
  lifecycleStatus: z.enum(
    ["Proposed", "Approved", "In Development", "Production", "Sunset", "Retired"],
    { message: "Invalid lifecycle status." }
  ),
  departmentIds: z.array(z.string()).min(1, "At least one department is required."),
  architectIds: z.array(z.string()).optional().default([]),
  capabilityIds: z.array(z.string()).optional().default([]),
  tierId: optionalString(),
  strategyId: optionalString(),
  complexityId: optionalString(),
  domainId: optionalString(),
  vendorId: optionalString(),
  businessOwner: optionalString(),
  technicalOwner: optionalString(),
  slaAvailability: optionalString(50),
  slaRto: optionalString(100),
  slaRpo: optionalString(100),
  goLiveDate: z.string().trim().optional().nullable(),
  retirementDate: z.string().trim().optional().nullable(),
  appUrl: optionalString(500),
  docUrl: optionalString(500),
  notes: optionalString(5000),
  heroDiagramId: optionalString(),
});

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------
export const CreateContractSchema = z.object({
  vendorId: optionalString(),
  assetId: optionalString(),
  title: nonEmptyString("Contract title"),
  value: optionalNumber(),
  startDate: z.string().trim().optional().nullable(),
  endDate: z.string().trim().optional().nullable(),
  noticePeriodDays: optionalNumber(),
  autoRenews: z.boolean().optional().default(false),
  owner: optionalString(),
  status: z.enum(["Active", "Terminated"], { message: "Invalid contract status." }).optional().default("Active"),
  docUrl: optionalString(500),
  notes: optionalString(5000),
});
