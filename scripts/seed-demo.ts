/**
 * scripts/seed-demo.ts
 *
 * Populates the database with 50 demo assets across realistic domains.
 * Idempotent: exits without changes if any assets already exist.
 *
 * Run:
 *   npx ts-node --project tsconfig.seed.json scripts/seed-demo.ts
 *
 * Credentials are read from .env.local (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)
 * or from site.config.json if present.
 */

import mysql from "mysql2/promise";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------
function getCredentials() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "site.config.json"), "utf-8");
    const c = JSON.parse(raw);
    if (c?.db?.host) return { host: c.db.host, port: Number(c.db.port ?? 3306), user: c.db.user, password: c.db.password, database: c.db.name };
  } catch {}
  return {
    host:     process.env.DB_HOST     ?? "localhost",
    port:     Number(process.env.DB_PORT ?? 3306),
    user:     process.env.DB_USER     ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME     ?? "pixxel_dev",
  };
}

// ---------------------------------------------------------------------------
// Lookup data
// ---------------------------------------------------------------------------
const DOMAINS = [
  { id: randomUUID(), name: "Infrastructure" },
  { id: randomUUID(), name: "Integration & Middleware" },
  { id: randomUUID(), name: "Enterprise Applications" },
  { id: randomUUID(), name: "Digital & Customer" },
  { id: randomUUID(), name: "Data & Analytics" },
  { id: randomUUID(), name: "Security" },
  { id: randomUUID(), name: "Developer & DevOps" },
];

const TIERS = [
  { id: randomUUID(), name: "Tier 1 - Mission Critical" },
  { id: randomUUID(), name: "Tier 2 - Business Critical" },
  { id: randomUUID(), name: "Tier 3 - Business Support" },
  { id: randomUUID(), name: "Tier 4 - Administrative" },
];

const STRATEGIES = [
  { id: randomUUID(), name: "Retain",   sort_order: 1 },
  { id: randomUUID(), name: "Replace",  sort_order: 2 },
  { id: randomUUID(), name: "Retire",   sort_order: 3 },
  { id: randomUUID(), name: "Invest",   sort_order: 4 },
  { id: randomUUID(), name: "Tolerate", sort_order: 5 },
];

const COMPLEXITIES = [
  { id: randomUUID(), name: "Low",       sort_order: 1 },
  { id: randomUUID(), name: "Medium",    sort_order: 2 },
  { id: randomUUID(), name: "High",      sort_order: 3 },
  { id: randomUUID(), name: "Very High", sort_order: 4 },
];

// Short helpers to resolve by name
const d = (name: string) => DOMAINS.find(x => x.name === name)!.id;
const t = (name: string) => TIERS.find(x => x.name === name)!.id;
const s = (name: string) => STRATEGIES.find(x => x.name === name)!.id;
const c = (name: string) => COMPLEXITIES.find(x => x.name === name)!.id;

type AssetType = "SaaS" | "On-Premise" | "Hybrid" | "Cloud" | "Open Source" | "Other";
type Lifecycle  = "Proposed" | "Approved" | "In Development" | "Production" | "Sunset" | "Retired";

interface AssetRow {
  id: string;
  name: string;
  short_code: string;
  description: string;
  type: AssetType;
  category: string;
  icon: string;
  lifecycle_status: Lifecycle;
  business_owner: string;
  technical_owner: string;
  vendor: string;
  sla_availability: string | null;
  sla_rto: string | null;
  sla_rpo: string | null;
  go_live_date: string | null;
  domain_id: string;
  tier_id: string;
  strategy_id: string;
  complexity_id: string;
}

const ASSETS: AssetRow[] = [
  // ── Infrastructure ────────────────────────────────────────────────────────
  {
    id: randomUUID(), name: "VMware vSphere", short_code: "VSPH",
    description: "Core virtualisation platform hosting on-premise workloads.",
    type: "On-Premise", category: "Virtualisation", icon: "Server",
    lifecycle_status: "Production", business_owner: "Head of IT", technical_owner: "Infrastructure Lead",
    vendor: "Broadcom", sla_availability: "99.95%", sla_rto: "1 hour", sla_rpo: "4 hours",
    go_live_date: "2018-03-01",
    domain_id: d("Infrastructure"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Retain"), complexity_id: c("High"),
  },
  {
    id: randomUUID(), name: "Cisco Catalyst Switching", short_code: "CCsw",
    description: "Core and distribution layer network switching infrastructure.",
    type: "On-Premise", category: "Networking", icon: "Network",
    lifecycle_status: "Production", business_owner: "Head of IT", technical_owner: "Network Engineer",
    vendor: "Cisco", sla_availability: "99.99%", sla_rto: "2 hours", sla_rpo: null,
    go_live_date: "2017-06-15",
    domain_id: d("Infrastructure"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Retain"), complexity_id: c("Medium"),
  },
  {
    id: randomUUID(), name: "NetApp ONTAP", short_code: "NTAP",
    description: "Primary SAN/NAS storage array for on-premise workloads.",
    type: "On-Premise", category: "Storage", icon: "HardDrive",
    lifecycle_status: "Production", business_owner: "Head of IT", technical_owner: "Storage Engineer",
    vendor: "NetApp", sla_availability: "99.99%", sla_rto: "1 hour", sla_rpo: "15 minutes",
    go_live_date: "2019-09-01",
    domain_id: d("Infrastructure"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Retain"), complexity_id: c("High"),
  },
  {
    id: randomUUID(), name: "Veeam Backup & Replication", short_code: "VEEM",
    description: "Backup, recovery and replication for virtual and physical workloads.",
    type: "On-Premise", category: "Backup & Recovery", icon: "RefreshCw",
    lifecycle_status: "Production", business_owner: "Head of IT", technical_owner: "Infrastructure Lead",
    vendor: "Veeam", sla_availability: null, sla_rto: "4 hours", sla_rpo: "1 hour",
    go_live_date: "2019-01-15",
    domain_id: d("Infrastructure"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Retain"), complexity_id: c("Medium"),
  },
  {
    id: randomUUID(), name: "Zabbix Monitoring", short_code: "ZBBX",
    description: "Open-source infrastructure monitoring for servers, network and services.",
    type: "Open Source", category: "Monitoring", icon: "Activity",
    lifecycle_status: "Production", business_owner: "Head of IT", technical_owner: "Infrastructure Lead",
    vendor: "Zabbix LLC", sla_availability: "99.5%", sla_rto: "4 hours", sla_rpo: null,
    go_live_date: "2020-04-01",
    domain_id: d("Infrastructure"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Replace"), complexity_id: c("Low"),
  },
  {
    id: randomUUID(), name: "Fortinet FortiGate", short_code: "FTGT",
    description: "Next-generation perimeter firewall and unified threat management.",
    type: "On-Premise", category: "Security Appliance", icon: "Shield",
    lifecycle_status: "Production", business_owner: "CISO", technical_owner: "Network Security Engineer",
    vendor: "Fortinet", sla_availability: "99.99%", sla_rto: "1 hour", sla_rpo: null,
    go_live_date: "2021-02-01",
    domain_id: d("Infrastructure"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Retain"), complexity_id: c("High"),
  },
  {
    id: randomUUID(), name: "Pure Storage FlashArray", short_code: "PURE",
    description: "All-flash primary storage for latency-sensitive database workloads.",
    type: "On-Premise", category: "Storage", icon: "HardDrive",
    lifecycle_status: "Production", business_owner: "Head of IT", technical_owner: "Storage Engineer",
    vendor: "Pure Storage", sla_availability: "99.9999%", sla_rto: "30 minutes", sla_rpo: "5 minutes",
    go_live_date: "2022-08-01",
    domain_id: d("Infrastructure"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Invest"), complexity_id: c("Medium"),
  },
  {
    id: randomUUID(), name: "Cisco Meraki", short_code: "MRKI",
    description: "Cloud-managed WiFi, switching and SD-WAN across all branch sites.",
    type: "Cloud", category: "Networking", icon: "Wifi",
    lifecycle_status: "Production", business_owner: "Head of IT", technical_owner: "Network Engineer",
    vendor: "Cisco", sla_availability: "99.9%", sla_rto: "4 hours", sla_rpo: null,
    go_live_date: "2021-11-01",
    domain_id: d("Infrastructure"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Retain"), complexity_id: c("Low"),
  },

  // ── Integration & Middleware ───────────────────────────────────────────────
  {
    id: randomUUID(), name: "MuleSoft Anypoint", short_code: "MULE",
    description: "Enterprise iPaaS connecting SaaS, on-premise and cloud systems.",
    type: "SaaS", category: "Integration Platform", icon: "GitMerge",
    lifecycle_status: "Production", business_owner: "CTO", technical_owner: "Integration Architect",
    vendor: "Salesforce", sla_availability: "99.9%", sla_rto: "2 hours", sla_rpo: "1 hour",
    go_live_date: "2020-07-01",
    domain_id: d("Integration & Middleware"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Invest"), complexity_id: c("Very High"),
  },
  {
    id: randomUUID(), name: "Azure Service Bus", short_code: "AZSB",
    description: "Cloud messaging service for reliable async communication between services.",
    type: "Cloud", category: "Messaging", icon: "MessageSquare",
    lifecycle_status: "Production", business_owner: "CTO", technical_owner: "Integration Architect",
    vendor: "Microsoft", sla_availability: "99.9%", sla_rto: "1 hour", sla_rpo: "15 minutes",
    go_live_date: "2021-03-15",
    domain_id: d("Integration & Middleware"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Retain"), complexity_id: c("Medium"),
  },
  {
    id: randomUUID(), name: "Apache Kafka", short_code: "KAFK",
    description: "Distributed event streaming platform for real-time data pipelines.",
    type: "Open Source", category: "Event Streaming", icon: "Zap",
    lifecycle_status: "Production", business_owner: "CTO", technical_owner: "Data Platform Engineer",
    vendor: "Apache / Confluent", sla_availability: "99.9%", sla_rto: "2 hours", sla_rpo: "30 minutes",
    go_live_date: "2022-01-01",
    domain_id: d("Integration & Middleware"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Invest"), complexity_id: c("High"),
  },
  {
    id: randomUUID(), name: "IBM MQ", short_code: "IBMQ",
    description: "Enterprise message broker for legacy system integration.",
    type: "On-Premise", category: "Messaging", icon: "MessageSquare",
    lifecycle_status: "Production", business_owner: "Head of IT", technical_owner: "Middleware Engineer",
    vendor: "IBM", sla_availability: "99.9%", sla_rto: "2 hours", sla_rpo: "1 hour",
    go_live_date: "2014-06-01",
    domain_id: d("Integration & Middleware"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Replace"), complexity_id: c("High"),
  },
  {
    id: randomUUID(), name: "AWS API Gateway", short_code: "APIG",
    description: "Managed API gateway for RESTful and WebSocket APIs on AWS.",
    type: "Cloud", category: "API Management", icon: "Globe",
    lifecycle_status: "Production", business_owner: "CTO", technical_owner: "Integration Architect",
    vendor: "Amazon", sla_availability: "99.95%", sla_rto: "1 hour", sla_rpo: null,
    go_live_date: "2021-09-01",
    domain_id: d("Integration & Middleware"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Retain"), complexity_id: c("Medium"),
  },
  {
    id: randomUUID(), name: "SnapLogic", short_code: "SNPL",
    description: "Cloud integration platform for self-service data and app integration.",
    type: "SaaS", category: "Integration Platform", icon: "Link",
    lifecycle_status: "In Development", business_owner: "CFO", technical_owner: "Integration Architect",
    vendor: "SnapLogic", sla_availability: "99.9%", sla_rto: "4 hours", sla_rpo: "2 hours",
    go_live_date: null,
    domain_id: d("Integration & Middleware"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Invest"), complexity_id: c("Medium"),
  },

  // ── Enterprise Applications ────────────────────────────────────────────────
  {
    id: randomUUID(), name: "SAP S/4HANA", short_code: "S4H",
    description: "Core ERP system for finance, procurement, manufacturing and supply chain.",
    type: "On-Premise", category: "ERP", icon: "Building2",
    lifecycle_status: "Production", business_owner: "CFO", technical_owner: "SAP Basis Lead",
    vendor: "SAP", sla_availability: "99.9%", sla_rto: "1 hour", sla_rpo: "30 minutes",
    go_live_date: "2016-01-01",
    domain_id: d("Enterprise Applications"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Retain"), complexity_id: c("Very High"),
  },
  {
    id: randomUUID(), name: "Salesforce CRM", short_code: "SFDC",
    description: "Customer relationship management platform for sales, service and marketing.",
    type: "SaaS", category: "CRM", icon: "Users",
    lifecycle_status: "Production", business_owner: "Chief Revenue Officer", technical_owner: "Salesforce Admin",
    vendor: "Salesforce", sla_availability: "99.9%", sla_rto: "2 hours", sla_rpo: "1 hour",
    go_live_date: "2018-11-01",
    domain_id: d("Enterprise Applications"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Invest"), complexity_id: c("High"),
  },
  {
    id: randomUUID(), name: "ServiceNow", short_code: "SNOW",
    description: "ITSM, ITOM and enterprise service management platform.",
    type: "SaaS", category: "ITSM", icon: "TicketCheck",
    lifecycle_status: "Production", business_owner: "Head of IT", technical_owner: "ServiceNow Developer",
    vendor: "ServiceNow", sla_availability: "99.8%", sla_rto: "2 hours", sla_rpo: "1 hour",
    go_live_date: "2019-04-01",
    domain_id: d("Enterprise Applications"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Invest"), complexity_id: c("High"),
  },
  {
    id: randomUUID(), name: "Workday HCM", short_code: "WDAY",
    description: "Cloud HR and workforce management platform.",
    type: "SaaS", category: "HCM", icon: "UserCheck",
    lifecycle_status: "Production", business_owner: "Chief People Officer", technical_owner: "Workday Analyst",
    vendor: "Workday", sla_availability: "99.9%", sla_rto: "4 hours", sla_rpo: "2 hours",
    go_live_date: "2020-06-01",
    domain_id: d("Enterprise Applications"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Retain"), complexity_id: c("Medium"),
  },
  {
    id: randomUUID(), name: "Microsoft Dynamics 365", short_code: "D365",
    description: "Business applications suite for field service, operations and finance.",
    type: "SaaS", category: "ERP", icon: "Building2",
    lifecycle_status: "In Development", business_owner: "COO", technical_owner: "D365 Architect",
    vendor: "Microsoft", sla_availability: "99.9%", sla_rto: "2 hours", sla_rpo: "1 hour",
    go_live_date: null,
    domain_id: d("Enterprise Applications"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Invest"), complexity_id: c("High"),
  },
  {
    id: randomUUID(), name: "Concur Expense", short_code: "CONC",
    description: "Travel and expense management integrated with SAP ERP.",
    type: "SaaS", category: "Finance", icon: "Receipt",
    lifecycle_status: "Production", business_owner: "CFO", technical_owner: "Finance Systems Analyst",
    vendor: "SAP", sla_availability: "99.5%", sla_rto: "8 hours", sla_rpo: "4 hours",
    go_live_date: "2019-01-01",
    domain_id: d("Enterprise Applications"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Tolerate"), complexity_id: c("Low"),
  },
  {
    id: randomUUID(), name: "DocuSign", short_code: "DSIG",
    description: "eSignature and digital agreement management platform.",
    type: "SaaS", category: "Legal & Compliance", icon: "FileSignature",
    lifecycle_status: "Production", business_owner: "General Counsel", technical_owner: "IT Operations",
    vendor: "DocuSign", sla_availability: "99.9%", sla_rto: "4 hours", sla_rpo: null,
    go_live_date: "2020-01-15",
    domain_id: d("Enterprise Applications"), tier_id: t("Tier 3 - Business Support"),
    strategy_id: s("Retain"), complexity_id: c("Low"),
  },
  {
    id: randomUUID(), name: "Coupa Procurement", short_code: "COUP",
    description: "Business spend management and procurement automation platform.",
    type: "SaaS", category: "Procurement", icon: "ShoppingCart",
    lifecycle_status: "Production", business_owner: "CPO", technical_owner: "Finance Systems Analyst",
    vendor: "Coupa", sla_availability: "99.5%", sla_rto: "8 hours", sla_rpo: "4 hours",
    go_live_date: "2021-07-01",
    domain_id: d("Enterprise Applications"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Retain"), complexity_id: c("Medium"),
  },
  {
    id: randomUUID(), name: "Jira Software", short_code: "JIRA",
    description: "Agile project tracking and issue management for software teams.",
    type: "SaaS", category: "Project Management", icon: "Kanban",
    lifecycle_status: "Production", business_owner: "CTO", technical_owner: "Atlassian Admin",
    vendor: "Atlassian", sla_availability: "99.9%", sla_rto: "4 hours", sla_rpo: "2 hours",
    go_live_date: "2017-03-01",
    domain_id: d("Enterprise Applications"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Retain"), complexity_id: c("Low"),
  },
  {
    id: randomUUID(), name: "Confluence", short_code: "CONF",
    description: "Team wiki and knowledge management platform.",
    type: "SaaS", category: "Collaboration", icon: "BookOpen",
    lifecycle_status: "Production", business_owner: "CTO", technical_owner: "Atlassian Admin",
    vendor: "Atlassian", sla_availability: "99.9%", sla_rto: "8 hours", sla_rpo: "4 hours",
    go_live_date: "2017-03-01",
    domain_id: d("Enterprise Applications"), tier_id: t("Tier 3 - Business Support"),
    strategy_id: s("Retain"), complexity_id: c("Low"),
  },

  // ── Digital & Customer ────────────────────────────────────────────────────
  {
    id: randomUUID(), name: "Adobe Experience Manager", short_code: "AEM",
    description: "Headless CMS powering the corporate website and marketing microsites.",
    type: "Hybrid", category: "CMS", icon: "LayoutTemplate",
    lifecycle_status: "Production", business_owner: "Chief Marketing Officer", technical_owner: "Web Platform Lead",
    vendor: "Adobe", sla_availability: "99.9%", sla_rto: "2 hours", sla_rpo: "1 hour",
    go_live_date: "2019-10-01",
    domain_id: d("Digital & Customer"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Retain"), complexity_id: c("High"),
  },
  {
    id: randomUUID(), name: "Salesforce Marketing Cloud", short_code: "SFMC",
    description: "Email, SMS and multi-channel marketing automation platform.",
    type: "SaaS", category: "Marketing Automation", icon: "Send",
    lifecycle_status: "Production", business_owner: "Chief Marketing Officer", technical_owner: "MarTech Engineer",
    vendor: "Salesforce", sla_availability: "99.9%", sla_rto: "4 hours", sla_rpo: "2 hours",
    go_live_date: "2020-02-01",
    domain_id: d("Digital & Customer"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Invest"), complexity_id: c("Medium"),
  },
  {
    id: randomUUID(), name: "Twilio", short_code: "TWLO",
    description: "CPaaS platform for SMS, voice, WhatsApp and email communications.",
    type: "SaaS", category: "Communications Platform", icon: "Phone",
    lifecycle_status: "Production", business_owner: "Chief Marketing Officer", technical_owner: "Integration Architect",
    vendor: "Twilio", sla_availability: "99.95%", sla_rto: "2 hours", sla_rpo: null,
    go_live_date: "2021-05-01",
    domain_id: d("Digital & Customer"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Retain"), complexity_id: c("Low"),
  },
  {
    id: randomUUID(), name: "Zendesk", short_code: "ZNDK",
    description: "Omni-channel customer support ticketing and live chat platform.",
    type: "SaaS", category: "Customer Support", icon: "HeadphonesIcon",
    lifecycle_status: "Production", business_owner: "Head of Customer Experience", technical_owner: "IT Operations",
    vendor: "Zendesk", sla_availability: "99.5%", sla_rto: "4 hours", sla_rpo: "2 hours",
    go_live_date: "2018-08-01",
    domain_id: d("Digital & Customer"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Retain"), complexity_id: c("Low"),
  },
  {
    id: randomUUID(), name: "Customer Self-Service Portal", short_code: "CSSP",
    description: "Web portal for customers to manage accounts, orders and support cases.",
    type: "Cloud", category: "Web Application", icon: "Globe",
    lifecycle_status: "Production", business_owner: "Chief Digital Officer", technical_owner: "Digital Lead",
    vendor: "Internal", sla_availability: "99.9%", sla_rto: "1 hour", sla_rpo: "30 minutes",
    go_live_date: "2022-03-01",
    domain_id: d("Digital & Customer"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Invest"), complexity_id: c("High"),
  },
  {
    id: randomUUID(), name: "Mobile App - iOS", short_code: "MAPIOS",
    description: "Native iOS mobile app for customers, published to App Store.",
    type: "Other", category: "Mobile Application", icon: "Smartphone",
    lifecycle_status: "Production", business_owner: "Chief Digital Officer", technical_owner: "Mobile Lead",
    vendor: "Internal", sla_availability: "99.9%", sla_rto: "2 hours", sla_rpo: "1 hour",
    go_live_date: "2022-06-01",
    domain_id: d("Digital & Customer"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Invest"), complexity_id: c("High"),
  },
  {
    id: randomUUID(), name: "Mobile App - Android", short_code: "MAPAND",
    description: "Native Android mobile app for customers, published to Google Play.",
    type: "Other", category: "Mobile Application", icon: "Smartphone",
    lifecycle_status: "Production", business_owner: "Chief Digital Officer", technical_owner: "Mobile Lead",
    vendor: "Internal", sla_availability: "99.9%", sla_rto: "2 hours", sla_rpo: "1 hour",
    go_live_date: "2022-06-01",
    domain_id: d("Digital & Customer"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Invest"), complexity_id: c("High"),
  },
  {
    id: randomUUID(), name: "Contentful", short_code: "CTFL",
    description: "Headless CMS for structured content delivered to web and mobile.",
    type: "SaaS", category: "CMS", icon: "FileText",
    lifecycle_status: "In Development", business_owner: "Chief Marketing Officer", technical_owner: "Web Platform Lead",
    vendor: "Contentful", sla_availability: "99.9%", sla_rto: "4 hours", sla_rpo: "2 hours",
    go_live_date: null,
    domain_id: d("Digital & Customer"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Invest"), complexity_id: c("Medium"),
  },

  // ── Data & Analytics ─────────────────────────────────────────────────────
  {
    id: randomUUID(), name: "Snowflake", short_code: "SNWF",
    description: "Cloud data warehouse powering enterprise reporting and analytics.",
    type: "Cloud", category: "Data Warehouse", icon: "Database",
    lifecycle_status: "Production", business_owner: "Chief Data Officer", technical_owner: "Data Platform Lead",
    vendor: "Snowflake", sla_availability: "99.9%", sla_rto: "1 hour", sla_rpo: "30 minutes",
    go_live_date: "2021-08-01",
    domain_id: d("Data & Analytics"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Invest"), complexity_id: c("High"),
  },
  {
    id: randomUUID(), name: "Power BI", short_code: "PWBI",
    description: "Microsoft BI and reporting platform connected to Snowflake.",
    type: "SaaS", category: "Business Intelligence", icon: "BarChart2",
    lifecycle_status: "Production", business_owner: "Chief Data Officer", technical_owner: "BI Developer",
    vendor: "Microsoft", sla_availability: "99.9%", sla_rto: "4 hours", sla_rpo: "2 hours",
    go_live_date: "2022-01-01",
    domain_id: d("Data & Analytics"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Retain"), complexity_id: c("Medium"),
  },
  {
    id: randomUUID(), name: "Tableau", short_code: "TBLAU",
    description: "Self-service data visualisation and analytics platform for business users.",
    type: "SaaS", category: "Business Intelligence", icon: "PieChart",
    lifecycle_status: "Sunset", business_owner: "Chief Data Officer", technical_owner: "BI Developer",
    vendor: "Salesforce", sla_availability: "99.9%", sla_rto: "8 hours", sla_rpo: "4 hours",
    go_live_date: "2017-06-01",
    domain_id: d("Data & Analytics"), tier_id: t("Tier 3 - Business Support"),
    strategy_id: s("Retire"), complexity_id: c("Low"),
  },
  {
    id: randomUUID(), name: "Informatica IICS", short_code: "IICS",
    description: "Cloud data integration and ETL orchestration platform.",
    type: "SaaS", category: "Data Integration", icon: "ArrowLeftRight",
    lifecycle_status: "Production", business_owner: "Chief Data Officer", technical_owner: "Data Engineer",
    vendor: "Informatica", sla_availability: "99.5%", sla_rto: "4 hours", sla_rpo: "2 hours",
    go_live_date: "2020-10-01",
    domain_id: d("Data & Analytics"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Retain"), complexity_id: c("High"),
  },
  {
    id: randomUUID(), name: "Databricks", short_code: "DBRK",
    description: "Unified data lakehouse platform for ML, data engineering and analytics.",
    type: "Cloud", category: "Data Platform", icon: "Layers",
    lifecycle_status: "Production", business_owner: "Chief Data Officer", technical_owner: "Data Platform Lead",
    vendor: "Databricks", sla_availability: "99.9%", sla_rto: "2 hours", sla_rpo: "1 hour",
    go_live_date: "2023-02-01",
    domain_id: d("Data & Analytics"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Invest"), complexity_id: c("Very High"),
  },
  {
    id: randomUUID(), name: "Collibra", short_code: "COLB",
    description: "Data governance, cataloguing and lineage platform.",
    type: "SaaS", category: "Data Governance", icon: "BookMarked",
    lifecycle_status: "In Development", business_owner: "Chief Data Officer", technical_owner: "Data Governance Lead",
    vendor: "Collibra", sla_availability: "99.9%", sla_rto: "8 hours", sla_rpo: "4 hours",
    go_live_date: null,
    domain_id: d("Data & Analytics"), tier_id: t("Tier 3 - Business Support"),
    strategy_id: s("Invest"), complexity_id: c("Medium"),
  },

  // ── Security ──────────────────────────────────────────────────────────────
  {
    id: randomUUID(), name: "CrowdStrike Falcon", short_code: "CRWD",
    description: "Cloud-native EDR and endpoint protection platform.",
    type: "SaaS", category: "Endpoint Security", icon: "ShieldCheck",
    lifecycle_status: "Production", business_owner: "CISO", technical_owner: "Security Operations Lead",
    vendor: "CrowdStrike", sla_availability: "99.9%", sla_rto: "2 hours", sla_rpo: null,
    go_live_date: "2021-06-01",
    domain_id: d("Security"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Retain"), complexity_id: c("Low"),
  },
  {
    id: randomUUID(), name: "Okta Identity Cloud", short_code: "OKTA",
    description: "Identity and access management platform, SSO and MFA for all applications.",
    type: "SaaS", category: "Identity & Access Management", icon: "KeyRound",
    lifecycle_status: "Production", business_owner: "CISO", technical_owner: "Identity Engineer",
    vendor: "Okta", sla_availability: "99.99%", sla_rto: "1 hour", sla_rpo: "30 minutes",
    go_live_date: "2020-03-01",
    domain_id: d("Security"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Invest"), complexity_id: c("Medium"),
  },
  {
    id: randomUUID(), name: "CyberArk PAM", short_code: "CARK",
    description: "Privileged access management for securing admin and service accounts.",
    type: "On-Premise", category: "Privileged Access Management", icon: "Lock",
    lifecycle_status: "Production", business_owner: "CISO", technical_owner: "Security Engineer",
    vendor: "CyberArk", sla_availability: "99.9%", sla_rto: "2 hours", sla_rpo: "1 hour",
    go_live_date: "2022-04-01",
    domain_id: d("Security"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Retain"), complexity_id: c("High"),
  },
  {
    id: randomUUID(), name: "Qualys VMDR", short_code: "QLYS",
    description: "Cloud-based vulnerability management, detection and response.",
    type: "SaaS", category: "Vulnerability Management", icon: "ScanLine",
    lifecycle_status: "Production", business_owner: "CISO", technical_owner: "Security Operations Lead",
    vendor: "Qualys", sla_availability: "99.5%", sla_rto: "8 hours", sla_rpo: null,
    go_live_date: "2021-09-01",
    domain_id: d("Security"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Retain"), complexity_id: c("Low"),
  },
  {
    id: randomUUID(), name: "Splunk SIEM", short_code: "SPLK",
    description: "Security information and event management platform for threat detection.",
    type: "On-Premise", category: "SIEM", icon: "Radio",
    lifecycle_status: "Production", business_owner: "CISO", technical_owner: "Security Operations Lead",
    vendor: "Splunk / Cisco", sla_availability: "99.9%", sla_rto: "1 hour", sla_rpo: "30 minutes",
    go_live_date: "2020-11-01",
    domain_id: d("Security"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Retain"), complexity_id: c("High"),
  },
  {
    id: randomUUID(), name: "Mimecast", short_code: "MIME",
    description: "Email security, archiving and continuity service.",
    type: "SaaS", category: "Email Security", icon: "Mail",
    lifecycle_status: "Production", business_owner: "CISO", technical_owner: "Security Engineer",
    vendor: "Mimecast", sla_availability: "99.99%", sla_rto: "4 hours", sla_rpo: null,
    go_live_date: "2018-01-01",
    domain_id: d("Security"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Tolerate"), complexity_id: c("Low"),
  },

  // ── Developer & DevOps ────────────────────────────────────────────────────
  {
    id: randomUUID(), name: "Azure DevOps", short_code: "AZDO",
    description: "CI/CD pipelines, repos, boards and artifact management on Azure.",
    type: "SaaS", category: "DevOps", icon: "GitBranch",
    lifecycle_status: "Production", business_owner: "CTO", technical_owner: "DevOps Lead",
    vendor: "Microsoft", sla_availability: "99.9%", sla_rto: "2 hours", sla_rpo: "1 hour",
    go_live_date: "2020-01-01",
    domain_id: d("Developer & DevOps"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Retain"), complexity_id: c("Medium"),
  },
  {
    id: randomUUID(), name: "GitHub Enterprise", short_code: "GHE",
    description: "Self-hosted source control and collaboration for engineering teams.",
    type: "SaaS", category: "Source Control", icon: "Github",
    lifecycle_status: "Production", business_owner: "CTO", technical_owner: "DevOps Lead",
    vendor: "GitHub / Microsoft", sla_availability: "99.9%", sla_rto: "4 hours", sla_rpo: "2 hours",
    go_live_date: "2019-07-01",
    domain_id: d("Developer & DevOps"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Retain"), complexity_id: c("Low"),
  },
  {
    id: randomUUID(), name: "Kubernetes (AKS)", short_code: "AKS",
    description: "Managed Kubernetes container orchestration on Azure.",
    type: "Cloud", category: "Container Platform", icon: "Container",
    lifecycle_status: "Production", business_owner: "CTO", technical_owner: "Platform Engineer",
    vendor: "Microsoft", sla_availability: "99.9%", sla_rto: "1 hour", sla_rpo: "30 minutes",
    go_live_date: "2022-05-01",
    domain_id: d("Developer & DevOps"), tier_id: t("Tier 1 - Mission Critical"),
    strategy_id: s("Invest"), complexity_id: c("Very High"),
  },
  {
    id: randomUUID(), name: "HashiCorp Vault", short_code: "HVLT",
    description: "Secrets management and dynamic credentials for applications and CI/CD.",
    type: "On-Premise", category: "Secrets Management", icon: "Vault",
    lifecycle_status: "Production", business_owner: "CISO", technical_owner: "Platform Engineer",
    vendor: "HashiCorp", sla_availability: "99.9%", sla_rto: "2 hours", sla_rpo: "1 hour",
    go_live_date: "2022-09-01",
    domain_id: d("Developer & DevOps"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Retain"), complexity_id: c("High"),
  },
  {
    id: randomUUID(), name: "SonarQube", short_code: "SONR",
    description: "Continuous code quality and security static analysis.",
    type: "On-Premise", category: "Code Quality", icon: "Code2",
    lifecycle_status: "Production", business_owner: "CTO", technical_owner: "DevOps Lead",
    vendor: "SonarSource", sla_availability: null, sla_rto: "8 hours", sla_rpo: null,
    go_live_date: "2021-01-01",
    domain_id: d("Developer & DevOps"), tier_id: t("Tier 3 - Business Support"),
    strategy_id: s("Retain"), complexity_id: c("Low"),
  },
  {
    id: randomUUID(), name: "Nexus Repository", short_code: "NXRM",
    description: "Artifact repository manager for Maven, npm, Docker and NuGet.",
    type: "On-Premise", category: "Artifact Management", icon: "Package",
    lifecycle_status: "Production", business_owner: "CTO", technical_owner: "DevOps Lead",
    vendor: "Sonatype", sla_availability: null, sla_rto: "8 hours", sla_rpo: null,
    go_live_date: "2020-06-01",
    domain_id: d("Developer & DevOps"), tier_id: t("Tier 3 - Business Support"),
    strategy_id: s("Retain"), complexity_id: c("Low"),
  },
  {
    id: randomUUID(), name: "Dynatrace", short_code: "DYNT",
    description: "Full-stack APM, observability and AIOps platform.",
    type: "SaaS", category: "Observability", icon: "LineChart",
    lifecycle_status: "Production", business_owner: "CTO", technical_owner: "Platform Engineer",
    vendor: "Dynatrace", sla_availability: "99.9%", sla_rto: "1 hour", sla_rpo: null,
    go_live_date: "2023-01-01",
    domain_id: d("Developer & DevOps"), tier_id: t("Tier 2 - Business Critical"),
    strategy_id: s("Invest"), complexity_id: c("Medium"),
  },
];

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------
async function upsertLookup(
  db: mysql.Connection,
  table: string,
  row: Record<string, string | number | null>
) {
  const cols = Object.keys(row);
  const vals: (string | number | null)[] = Object.values(row);
  const placeholders = cols.map(() => "?").join(", ");
  const setCols = cols.filter(col => col !== "id").map(col => `${col} = VALUES(${col})`).join(", ");
  await db.execute(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})
     ON DUPLICATE KEY UPDATE ${setCols}`,
    vals
  );
}

async function run() {
  const creds = getCredentials();
  console.log(`Connecting to ${creds.host}:${creds.port}/${creds.database} ...`);

  const db = await mysql.createConnection({ ...creds, multipleStatements: false });

  // Guard: skip if assets already exist
  const [existing] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM assets"
  );
  const count = (existing as mysql.RowDataPacket[])[0].n as number;
  if (count > 0) {
    console.log(`Skipping: ${count} assets already exist. Drop or clear the assets table to re-seed.`);
    await db.end();
    return;
  }

  const SYSTEM_ID   = "00000000-0000-0000-0000-000000000000";
  const SYSTEM_NAME = "System";

  // Upsert lookup tables
  console.log("Seeding domains ...");
  for (const row of DOMAINS) {
    await upsertLookup(db, "domains", {
      id: row.id, name: row.name,
      created_by_id: SYSTEM_ID, created_by_name: SYSTEM_NAME,
    });
  }

  console.log("Seeding tiers ...");
  for (const row of TIERS) {
    await upsertLookup(db, "tiers", {
      id: row.id, name: row.name,
      created_by_id: SYSTEM_ID, created_by_name: SYSTEM_NAME,
    });
  }

  console.log("Seeding strategies ...");
  for (const row of STRATEGIES) {
    await upsertLookup(db, "asset_strategies", {
      id: row.id, name: row.name, sort_order: row.sort_order,
      created_by_id: SYSTEM_ID, created_by_name: SYSTEM_NAME,
    });
  }

  console.log("Seeding complexities ...");
  for (const row of COMPLEXITIES) {
    await upsertLookup(db, "asset_complexities", {
      id: row.id, name: row.name, sort_order: row.sort_order,
      created_by_id: SYSTEM_ID, created_by_name: SYSTEM_NAME,
    });
  }

  console.log(`Seeding ${ASSETS.length} assets ...`);
  for (const a of ASSETS) {
    await db.execute(
      `INSERT INTO assets
         (id, name, short_code, description, type, category, icon,
          lifecycle_status, business_owner, technical_owner, vendor,
          sla_availability, sla_rto, sla_rpo, go_live_date,
          domain_id, tier_id, strategy_id, complexity_id,
          created_by_id, created_by_name)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        a.id, a.name, a.short_code, a.description, a.type, a.category, a.icon,
        a.lifecycle_status, a.business_owner, a.technical_owner, a.vendor,
        a.sla_availability, a.sla_rto, a.sla_rpo, a.go_live_date,
        a.domain_id, a.tier_id, a.strategy_id, a.complexity_id,
        SYSTEM_ID, SYSTEM_NAME,
      ]
    );
  }

  await db.end();
  console.log(`Done. Seeded ${ASSETS.length} assets across ${DOMAINS.length} domains.`);
}

run().catch(err => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
