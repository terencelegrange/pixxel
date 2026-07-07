/**
 * Reference/lookup seed data shared by both the MySQL (lib/db.ts) and
 * SQLite (lib/db-sqlite.ts) setup paths, so the two don't drift.
 */
export const SEED_DIAGRAM_TYPES = [
  { id: "dtype000-0000-0000-0000-000000000001", name: "Domain",   description: "High-level domain architecture overview",        sortOrder: 1 },
  { id: "dtype000-0000-0000-0000-000000000002", name: "Program",  description: "Program-level architecture diagram",             sortOrder: 2 },
  { id: "dtype000-0000-0000-0000-000000000003", name: "Solution", description: "Solution architecture diagram",                  sortOrder: 3 },
  { id: "dtype000-0000-0000-0000-000000000004", name: "Detailed", description: "Detailed technical architecture diagram",        sortOrder: 4 },
];

export const SEED_INDUSTRY_SECTORS = [
  { id: "00000001-ind-0000-0000-000000000001", name: "Telecommunications", description: "Providers of voice, data, and broadband connectivity services." },
  { id: "00000001-ind-0000-0000-000000000002", name: "Utilities (Energy)", description: "Providers of electricity, gas, and water distribution services." },
];

export const SEED_TELECOM_CAPABILITIES: [string, string, string, number][] = [
  ["00000002-cap-0000-0000-000000000001", "Network Management",              "Planning, provisioning, and operating the core and access network.",          1],
  ["00000002-cap-0000-0000-000000000002", "Voice & Calling Services",         "Management of voice, conferencing, and unified communications products.",     2],
  ["00000002-cap-0000-0000-000000000003", "Data & Connectivity Services",     "Broadband, mobile data, and enterprise connectivity offerings.",              3],
  ["00000002-cap-0000-0000-000000000004", "Customer Management",              "Acquisition, onboarding, retention, and care of customers.",                  4],
  ["00000002-cap-0000-0000-000000000005", "Billing & Revenue Management",     "Rating, billing, collections, and revenue assurance.",                        5],
  ["00000002-cap-0000-0000-000000000006", "Product Management",               "Design, launch, and lifecycle management of products and services.",          6],
  ["00000002-cap-0000-0000-000000000007", "Service Assurance",                "Monitoring, fault management, and SLA performance management.",               7],
  ["00000002-cap-0000-0000-000000000008", "Network Planning & Engineering",   "Capacity planning, design, and technology evolution of the network.",         8],
  ["00000002-cap-0000-0000-000000000009", "Field Operations",                 "Installation, maintenance, and repair of physical infrastructure.",           9],
  ["00000002-cap-0000-0000-000000000010", "Digital Channels & Self-Service",  "Web, mobile, and API-driven customer interaction channels.",                 10],
  ["00000002-cap-0000-0000-000000000011", "Wholesale & Interconnect",         "Carrier relations, roaming, and inter-operator settlement.",                 11],
  ["00000002-cap-0000-0000-000000000012", "Regulatory & Compliance",          "Licence management, regulatory reporting, and legal compliance.",            12],
];

export const SEED_UTILITY_CAPABILITIES: [string, string, string, number][] = [
  ["00000003-cap-0000-0000-000000000001", "Energy Generation",                  "Operation of power plants and renewable energy assets.",                     1],
  ["00000003-cap-0000-0000-000000000002", "Energy Transmission",                "High-voltage bulk power transmission across the grid.",                      2],
  ["00000003-cap-0000-0000-000000000003", "Energy Distribution",                "Low-voltage distribution of electricity to end consumers.",                  3],
  ["00000003-cap-0000-0000-000000000004", "Metering & Smart Grid",              "Smart meter deployment, data collection, and grid intelligence.",            4],
  ["00000003-cap-0000-0000-000000000005", "Customer Operations",                "Customer acquisition, service requests, and complaint management.",          5],
  ["00000003-cap-0000-0000-000000000006", "Billing & Revenue Management",       "Energy usage billing, tariff management, and debt recovery.",                6],
  ["00000003-cap-0000-0000-000000000007", "Asset Management",                   "Lifecycle management of physical grid and generation assets.",               7],
  ["00000003-cap-0000-0000-000000000008", "Field Operations",                   "Inspection, maintenance, and emergency response for infrastructure.",        8],
  ["00000003-cap-0000-0000-000000000009", "Energy Trading & Risk Management",   "Wholesale energy procurement, trading, and market risk management.",         9],
  ["00000003-cap-0000-0000-000000000010", "Regulatory & Compliance",            "Licence obligations, safety reporting, and environmental compliance.",      10],
  ["00000003-cap-0000-0000-000000000011", "Environmental Management",           "Emissions tracking, sustainability reporting, and carbon management.",      11],
  ["00000003-cap-0000-0000-000000000012", "Network Planning & Investment",      "Grid investment planning, capacity modelling, and project delivery.",       12],
];

export const SEED_INVESTMENT_CLASSIFICATIONS = [
  { name: "Invest",       color: "#22c55e", sortOrder: 1 },
  { name: "Experiment",   color: "#3b82f6", sortOrder: 2 },
  { name: "Contain",      color: "#eab308", sortOrder: 3 },
  { name: "Decommission", color: "#ef4444", sortOrder: 4 },
];
