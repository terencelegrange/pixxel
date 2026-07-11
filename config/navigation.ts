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
        label: "PlantUML Diagrams",
        href: "/plantuml",
        icon: "FileCode2",
      },
      {
        label: "Dependency Map",
        href: "/dependencies",
        icon: "Network",
      },
      {
        label: "Projects",
        href: "/projects",
        icon: "FolderKanban",
      },
      {
        label: "Contracts",
        href: "/contracts",
        icon: "FileText",
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
    title: "Roadmap",
    items: [
      {
        label: "Roadmap by Platform",
        href: "/roadmap/by-platform",
        icon: "GanttChart",
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
