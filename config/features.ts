/**
 * FEATURE REGISTRY
 * ----------------
 * Every gate-able capability in the app, keyed by a stable string used in
 * `feature_tier_features` and on `NavItem.featureKey` / settings tile configs.
 * Asset Registry, My Assets, Asset Strategy, Dashboard, and the core lookups
 * (Departments/Domains/Vendors/Tiers/Users/Audit) are NOT here — they're the
 * always-on baseline, not an optional add-on.
 */
export interface FeatureDef {
  key: string;
  label: string;
  description: string;
  category: string;
}

export const FEATURES: FeatureDef[] = [
  { key: "diagrams", label: "Architecture Diagrams", category: "Diagramming",
    description: "Excalidraw-based domain/program/solution diagrams, tagged to assets." },
  { key: "plantuml", label: "PlantUML Diagrams", category: "Diagramming",
    description: "PlantUML source diagrams, auto-tagged to matching assets." },
  { key: "dependency_map", label: "Dependency Map", category: "Diagramming",
    description: "Cross-asset dependency graph, independent of projects." },
  { key: "projects", label: "Projects", category: "Planning",
    description: "Project tracking with upstream/downstream asset dependencies." },
  { key: "roadmap", label: "Roadmap", category: "Planning",
    description: "Investment-classification roadmap by platform, over time." },
  { key: "capability_coverage", label: "Capability Coverage", category: "Reporting",
    description: "Business capability coverage matrix by industry sector." },
  { key: "complexity_cost", label: "Complexity vs Cost", category: "Reporting",
    description: "Asset complexity vs. contract cost report." },
  { key: "security", label: "Security Assessment", category: "Security",
    description: "Risk attributes/characteristics, per-asset assessment, and the security quadrant report." },
  { key: "risk_register", label: "Risk Register", category: "Security",
    description: "Log and track freeform risks against assets — operational, financial, compliance, and more." },
];

export const FEATURE_CATEGORIES = Array.from(new Set(FEATURES.map((f) => f.category)));
