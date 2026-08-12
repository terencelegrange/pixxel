import { NavGroup } from "@/types";

/**
 * NAVIGATION CONFIG
 * -----------------
 * Add, remove, or reorder menu items here without touching any component code.
 * `icon` must match a valid Lucide icon name (PascalCase).
 * `featureKey` (optional) ties an item to config/features.ts — items without one
 * are always shown; items with one are hidden unless the active feature tier
 * includes that key (see context/FeatureTierContext.tsx).
 */
export const navigationConfig: NavGroup[] = [
  {
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: "LayoutDashboard",
      },
    ],
  },
  {
    title: "Assets",
    items: [
      {
        label: "Asset Registry",
        href: "/assets",
        icon: "Server",
      },
      {
        label: "My Assets",
        href: "/assets/my-assets",
        icon: "UserCheck",
      },
      {
        label: "Asset Security",
        href: "/assets/security",
        icon: "ShieldAlert",
        featureKey: "security",
      },
      {
        label: "Diagrams",
        href: "/diagrams",
        icon: "GitBranch",
        featureKey: "diagrams",
      },
      {
        label: "PlantUML Diagrams",
        href: "/plantuml",
        icon: "FileCode2",
        featureKey: "plantuml",
      },
      {
        label: "Dependency Map",
        href: "/dependencies",
        icon: "Network",
        featureKey: "dependency_map",
      },
      {
        label: "Projects",
        href: "/projects",
        icon: "FolderKanban",
        featureKey: "projects",
      },
    ],
  },
  {
    title: "Reports",
    items: [
      {
        label: "Asset Strategy",
        href: "/reports/assets-by-domain",
        icon: "LayoutGrid",
      },
      {
        label: "Capability Coverage",
        href: "/reports/capabilities-matrix",
        icon: "TableProperties",
        featureKey: "capability_coverage",
      },
      {
        label: "Complexity vs Cost",
        href: "/reports/complexity-cost",
        icon: "TrendingDown",
        featureKey: "complexity_cost",
      },
      {
        label: "Security Quadrant",
        href: "/reports/security-quadrant",
        icon: "Radar",
        featureKey: "security",
      },
    ],
  },
  {
    title: "Roadmap",
    items: [
      {
        label: "Roadmap by Platform",
        href: "/roadmap/by-platform",
        icon: "GanttChart",
        featureKey: "roadmap",
      },
    ],
  },
  {
    title: "Manage",
    items: [
      {
        label: "Settings",
        href: "/settings",
        icon: "Settings",
      },
    ],
  },
  {
    title: "Resources",
    items: [
      {
        label: "Documentation",
        href: "/docs",
        icon: "BookOpen",
      },
      {
        label: "Support",
        href: "/support",
        icon: "LifeBuoy",
      },
    ],
  },
];
