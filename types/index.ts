export interface User {
  id: string;
  name: string;
  email: string;
  avatarInitials: string;
  role: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string | number;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  status: "Published" | "Unpublished";
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type AssetType = "SaaS" | "On-Premise" | "Hybrid" | "Cloud" | "Open Source" | "Other";
export type LifecycleStatus = "Proposed" | "Approved" | "In Development" | "Production" | "Sunset" | "Retired";
export type AssetCategory =
  | "Application"
  | "Platform"
  | "API / Web Service"
  | "Database"
  | "Infrastructure"
  | "Integration / Middleware"
  | "Data / Analytics"
  | "Security Tool"
  | "Development Tool"
  | "Other";

export interface Tier {
  id: string;
  name: string;
  description: string | null;
  slaAvailability: string | null;
  supportHours: string | null;
  responseTime: string | null;
  resolutionTime: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetStrategy {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetComplexity {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Domain {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  country: string | null;
  postalCode: string | null;
  primaryContactName: string | null;
  primaryContactRole: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  notes: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  name: string;
  shortCode: string | null;
  description: string | null;
  type: AssetType;
  category: AssetCategory;
  icon: string | null;
  lifecycleStatus: LifecycleStatus;
  departmentIds: string[];
  departmentNames: string[];
  architectIds: string[];
  architectNames: string[];
  capabilityIds: string[];
  capabilityNames: string[];
  tierId: string | null;
  tierName: string | null;
  strategyId: string | null;
  strategyName: string | null;
  complexityId: string | null;
  complexityName: string | null;
  domainId: string | null;
  domainName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  businessOwner: string | null;
  technicalOwner: string | null;
  slaAvailability: string | null;
  slaRto: string | null;
  slaRpo: string | null;
  goLiveDate: string | null;
  retirementDate: string | null;
  appUrl: string | null;
  docUrl: string | null;
  contractEndDate: string | null;
  contractAmount: number | null;
  notes: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type PermissionLevel = "read-only" | "member" | "admin";

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissionLevel: PermissionLevel;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = "Active" | "On Hold" | "Completed" | "Cancelled";
export type DependencyType = "upstream" | "downstream";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  assetCount: number;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectAsset {
  assetId: string;
  assetName: string;
  assetType: string;
  assetIcon: string | null;
  lifecycleStatus: string;
  tierName: string | null;
  dependencyType: DependencyType;
  notes: string | null;
}

export interface AuditLog {
  id: string;
  tableName: string;
  recordId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  performedById: string;
  performedByName: string;
  performedAt: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
}

export interface DiagramType {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Diagram {
  id: string;
  name: string;
  description: string | null;
  projectId: string | null;
  projectName: string | null;
  diagramTypeId: string | null;
  diagramTypeName: string | null;
  latestVersion: number;
  assetCount: number;
  lastModifiedByName: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiagramVersion {
  id: string;
  diagramId: string;
  versionNumber: number;
  content: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
}

export interface IndustrySector {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessCapability {
  id: string;
  name: string;
  description: string | null;
  industrySectorId: string;
  industrySectorName: string | null;
  sortOrder: number | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}
