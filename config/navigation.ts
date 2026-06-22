import { NavGroup } from "@/types";

/**
 * NAVIGATION CONFIG
 * -----------------
 * Add, remove, or reorder menu items here without touching any component code.
 * `icon` must match a valid Lucide icon name (PascalCase).
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
        label: "Diagrams",
        href: "/diagrams",
        icon: "GitBranch",
      },
      {
        label: "Projects",
        href: "/projects",
        icon: "FolderKanban",
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
      },
      {
        label: "Complexity vs Cost",
        href: "/reports/complexity-cost",
        icon: "TrendingDown",
      },
    ],
  },
  {
    title: "Manage",
    items: [
      {
        label: "Departments",
        href: "/organisations",
        icon: "Building2",
      },
      {
        label: "Domains",
        href: "/domains",
        icon: "Layers",
      },
      {
        label: "Asset Strategy",
        href: "/asset-strategy",
        icon: "Target",
      },
      {
        label: "Vendors",
        href: "/vendors",
        icon: "Package2",
      },
      {
        label: "Tier",
        href: "/tiers",
        icon: "Gauge",
      },
      {
        label: "Users",
        href: "/users",
        icon: "Users",
      },
      {
        label: "Settings",
        href: "/settings",
        icon: "Settings",
      },
      {
        label: "Audit",
        href: "/audit",
        icon: "ClipboardList",
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
