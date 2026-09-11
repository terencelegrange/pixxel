import { navigationConfig } from "@/config/navigation";
import { SearchableItem } from "@/types";

/**
 * SEARCH INDEX
 * ------------
 * Powers the header's global search (find a page or setting by name).
 * Built from two sources:
 *   1. `navigationConfig` — the sidebar's own pages, flattened here.
 *   2. `SETTINGS_PAGES` below — the Settings landing page's tiles, which
 *      aren't in the sidebar nav (they're one level deeper, under /settings)
 *      so they need to be listed separately to be searchable.
 * Keep `SETTINGS_PAGES` in sync with app/(dashboard)/settings/page.tsx when
 * tiles are added, removed, or reworded there.
 */

const NAV_PAGES: SearchableItem[] = navigationConfig.flatMap((group) =>
  group.items.map((item) => ({
    label: item.label,
    href: item.href,
    icon: item.icon,
    group: group.title ?? "General",
    featureKey: item.featureKey,
  }))
);

const SETTINGS_PAGES: SearchableItem[] = [
  {
    label: "Users", href: "/users", icon: "Users", group: "Settings",
    description: "Manage user accounts, roles, and access levels.",
  },
  {
    label: "Audit Log", href: "/audit", icon: "ClipboardList", group: "Settings",
    description: "Review a full history of changes made across the platform.",
  },
  {
    label: "Departments", href: "/organisations", icon: "Building2", group: "Settings",
    description: "Manage the business units and teams that own assets.",
  },
  {
    label: "Domains", href: "/domains", icon: "Network", group: "Settings",
    description: "Classify assets by technology domain such as Application or Infrastructure.",
  },
  {
    label: "Asset Strategy", href: "/asset-strategy", icon: "Target", group: "Settings",
    description: "Define strategic dispositions such as Adopt, Scale, Replace, or Retire.",
  },
  {
    label: "Vendors", href: "/vendors", icon: "Package2", group: "Settings",
    description: "Register the vendors and suppliers your assets depend on.",
  },
  {
    label: "Tiers", href: "/tiers", icon: "BarChart2", group: "Settings",
    description: "Set criticality tiers to capture SLA expectations and support obligations.",
  },
  {
    label: "Platform", href: "/settings/platform", icon: "Blocks", group: "Settings",
    description: "Choose which feature set is enabled for this install, and manage feature tiers.",
  },
  {
    label: "Roles", href: "/settings/roles", icon: "ShieldCheck", group: "Settings",
    description: "Define roles and permission levels for users.",
  },
  {
    label: "API Keys", href: "/settings/api-keys", icon: "KeyRound", group: "Settings",
    description: "Generate and manage keys for programmatic API access.",
  },
  {
    label: "Feedback", href: "/settings/feedback", icon: "MessageSquare", group: "Settings",
    description: "View and manage user feedback submissions.",
  },
  {
    label: "Changelog", href: "/settings/changelog", icon: "ScrollText", group: "Settings",
    description: "Record and publish what has changed in each platform release.",
  },
  {
    label: "Security Configuration", href: "/settings/security-configuration", icon: "ShieldAlert", group: "Settings",
    description: "Configure risk attributes, characteristics, and how they map to asset categories.",
    featureKey: "security",
  },
  {
    label: "Investment Classifications", href: "/settings/investment-classifications", icon: "MapPin", group: "Settings",
    description: "Configure roadmap investment labels and their colours.",
    featureKey: "roadmap",
  },
  {
    label: "Industry Sectors", href: "/settings/industry-sectors", icon: "Globe", group: "Settings",
    description: "Manage industry sectors for business capability categorisation.",
    featureKey: "capability_coverage",
  },
  {
    label: "Business Capabilities", href: "/settings/business-capabilities", icon: "Layers", group: "Settings",
    description: "Define and manage business capabilities by industry sector.",
    featureKey: "capability_coverage",
  },
  {
    label: "Diagram Types", href: "/settings/diagram-types", icon: "GitBranch", group: "Settings",
    description: "Configure diagram classification types (Domain, Program, Solution, Detailed).",
    featureKey: "diagrams",
  },
  {
    label: "Asset Complexity", href: "/settings/asset-complexity", icon: "Gauge", group: "Settings",
    description: "Define complexity levels for classifying assets (e.g. Low, Medium, High, Critical).",
    featureKey: "complexity_cost",
  },
  {
    label: "General", href: "/settings/general", icon: "Settings", group: "Settings",
    description: "Manage account name, branding, timezone, and language.",
  },
  {
    label: "Notifications", href: "/settings/notifications", icon: "Bell", group: "Settings",
    description: "Choose what shows up in your notification bell.",
  },
  {
    label: "Security", href: "/settings/security", icon: "Lock", group: "Settings",
    description: "Update your password and manage 2FA settings.",
  },
  {
    label: "Integrations", href: "/settings/integrations", icon: "Globe", group: "Settings",
    description: "Connect third-party services such as Confluence.",
  },
  {
    label: "Observability", href: "/settings/observability", icon: "Activity", group: "Settings",
    description: "Forward application logs to an external log collector.",
  },
];

export const searchIndex: SearchableItem[] = [...NAV_PAGES, ...SETTINGS_PAGES];
