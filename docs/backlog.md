# Pixxel — Product Backlog

Enterprise architecture tool gap analysis against LeanIX, Ardoq, Planview, Bizzdesign, and Sparx EA.
Items are ordered by priority within each tier.

---

## Priority 1 — Core EA Gaps (deliver before calling this production-ready)

### 1. Application Dependency Map
Visual, interactive map of integrations and dependencies between assets — upstream/downstream relationships, data flows, API connections. The most-used view in every EA tool. Currently assets exist in isolation with no relationship model.
- Data model: `asset_dependencies` table (source_asset_id, target_asset_id, type, protocol, description, direction)
- UI: force-directed or layered graph view; filter by domain/tier; click node to open asset
- Types: API, Database, File Transfer, Event, Message Queue, UI Embed

> **Adjacent, in progress (branch `worktree-changes-2026-07-08`, not yet merged to main):** the **Business Services module** (`services`/`service_assets` tables, `/services`) groups assets into named services with a per-asset Core/Supporting/Dependency role and a ReactFlow view of the grouping. It's a *composition* layer (which assets make up a service), not a *dependency* layer (which assets call/depend on which) — this item and #23 (Business Process Mapping) are both still open and address different relationship types than Business Services covers.

### 2. Risk Register
Per-asset risk tracking with severity, likelihood, impact, mitigation owner and status. Enables risk-weighted portfolio decisions.
- Data model: `asset_risks` (asset_id, title, category, likelihood, impact, risk_score, mitigation, owner, status, due_date)
- UI: risk matrix heatmap overlay on asset list; per-asset risk tab; risk summary report
- Categories: Security, Compliance, Availability, Vendor, Operational, Financial

### 3. Technology Radar
Track technologies (languages, frameworks, tools, platforms) through Assess → Trial → Adopt → Hold rings, inspired by ThoughtWorks Radar. Separate from assets — about tech choices, not running systems.
- Data model: `tech_radar_entries` (name, quadrant, ring, description, rationale, moved_from_ring, published_at)
- Quadrants: Languages & Frameworks, Tools, Platforms, Techniques
- UI: interactive radar SVG; history of ring movements; link radar entry to assets using that technology

### 4. Contract Management
Track vendor contracts linked to assets: value, start/end dates, renewal terms, notice period, owner. Drives retirement planning and avoids surprise renewals.
- Data model: `contracts` (vendor_id, asset_id nullable, title, value, currency, start_date, end_date, notice_period_days, auto_renews, owner, status, doc_url)
- UI: contracts list with renewal timeline; alerts for contracts expiring within 90/30 days; vendor contracts tab
- Notification hook: badge/alert on dashboard for upcoming renewals

### 5. Architecture Decision Records (ADRs)
Capture, version and link architecture decisions to assets and projects. ADRs are the institutional memory of why things are the way they are.
- Data model: `adrs` (title, status, context, decision, consequences, asset_ids JSON, project_ids JSON, created_by, superseded_by_id)
- Statuses: Proposed, Accepted, Deprecated, Superseded
- UI: ADR list with filtering by status/asset; markdown editor; asset/project linkage; superseded-by chain

---

## Priority 2 — High Value Differentiators

### 6. Portfolio Heat Map
2D bubble/heat map plotting assets on configurable axes (e.g. Business Value vs Technical Health, Cost vs Risk, Complexity vs Lifecycle). The core "portfolio view" decision-making tool.
- Axes sourced from existing fields: tier, complexity, strategy, lifecycle_status, cost
- Bubble size: number of integrations or contract value
- Colour: by domain or investment classification
- Filters: same tier/type/domain filters as Asset Strategy report

### 7. TCO & Cost Centre Tracking
Full total cost of ownership per asset: CapEx, OpEx, cost centre codes, budget vs actual. Currently only `contract_amount` exists as a single field.
- Data model: extend `assets` with `cost_centre`, `opex_annual`, `capex_total`, `budget_year`, `currency`; `asset_costs` table for multi-year actuals
- UI: cost breakdown on asset detail; cost by domain/tier report; budget vs actual chart

### 8. Roadmap by Domain
Domain-centric Gantt complement to the existing Roadmap by Platform. Lets domain owners see their full portfolio roadmap in one view.
- Reuse existing `asset_roadmap_phases` data and `investment_classifications`
- Group rows by asset (not domain), faceted by domain filter
- Same quarter window/filter controls as Roadmap by Platform

### 9. Sunset & Retirement Workflow
Structured retirement process: nominate a replacement asset, set migration milestones, track dependencies that need re-pointing before retirement. Currently retirement is just a lifecycle status field.
- Data model: `retirement_plans` (asset_id, replacement_asset_id nullable, target_retirement_date, migration_notes, status, milestones JSON)
- UI: Retirement tab on asset detail; retirement pipeline list showing all assets in Sunset status with plan progress

### 10. Lifecycle Timeline View
Horizontal timeline showing go-live and retirement dates for all assets in a single scrollable view — useful for capacity planning and identifying transition clashes.
- Data: `go_live_date`, `retirement_date`, `contract_end_date` already on assets
- UI: swimlane timeline grouped by domain/tier; click asset bar to open detail; filter controls

---

## Priority 3 — Operational Essentials

### 11. Bulk Import (CSV / Excel) — 🟡 in progress (open PR, not yet merged to main)
Import assets, vendors, and dependencies from spreadsheets. The first thing every new customer needs — EA tools always start with a spreadsheet.
- Upload CSV with column mapping wizard
- Validation report before committing: duplicate names, missing required fields, unknown domain/tier values
- Merge strategy: skip existing (by name), or update

**In branch `worktree-changes-2026-07-08` (unmerged):** `POST /api/assets/bulk` + Settings → Bulk Upload Assets page — fixed-column CSV upload for new assets, name→ID lookup for department/domain/vendor/tier/strategy/architect/capability (creating new departments on the fly), per-row create/fail with warnings for unresolved lookups, one DB transaction per row.
**Still missing even once merged:** column-mapping wizard (columns are fixed-name, not user-mapped), pre-commit validation report (validation currently happens per-row during the actual import, not as a separate preview/confirm step), and any skip-vs-update merge strategy — every row is a new asset; there's no dedupe-by-name against existing assets, so re-uploading the same CSV creates duplicates.

### 12. Global Search
Search across assets, vendors, diagrams, projects, ADRs and radar entries from a single input. Currently each section has its own local filter.
- Keyboard shortcut (Cmd/Ctrl+K) command palette
- Grouped results by type with icons
- Recent searches

### 13. Export & Reporting
Export any list view or report to CSV and PDF. Schedule email delivery of key reports.
- CSV export on: Asset Registry, Roadmap, Risk Register, Contract list
- PDF export on: Capability Matrix, Portfolio Heat Map, Roadmap Gantt
- Scheduled reports: weekly asset summary email to domain owners

### 14. Notifications & Alerts
In-app and email alerts for time-sensitive events. Currently there is no alerting of any kind.
- Contract expiry within 90 / 30 days
- Retirement date within 60 days with no retirement plan
- Assets in Sunset status with no retirement_date set
- ADR decisions approaching review date
- Dashboard notification bell (already partially scaffolded per the header plan)

### 15. Compliance Tracking
Track compliance requirements and certification status per asset (SOC 2, ISO 27001, GDPR, PCI-DSS, etc.).
- Data model: `asset_compliance` (asset_id, standard, status, certified_until, evidence_url, owner)
- UI: compliance tab on asset; compliance coverage report (which assets are certified for what)

---

## Priority 4 — Enterprise Platform Features

### 16. SSO / SAML Authentication
Enterprise single sign-on via SAML 2.0 or OIDC. Currently only local username/password auth exists.
- Support: Azure AD / Entra ID, Okta, Google Workspace
- Settings page for SAML metadata upload
- Role mapping from IdP groups to pixxel roles

### 17. Custom Attributes
User-defined fields on assets beyond the fixed schema. Every enterprise has bespoke data they need to track.
- Data model: `custom_field_definitions` (entity_type, key, label, type: text/number/date/select/boolean, required, options JSON); `custom_field_values` (entity_type, entity_id, field_id, value)
- UI: Custom Fields settings page; fields rendered on asset detail form and filterable in asset list

### 18. Tag System
Free-form tags on assets, diagrams, and projects — faster categorisation than formal domain/tier hierarchies.
- Data model: `tags` + `asset_tags` join
- UI: tag input with autocomplete on asset form; tag filter on asset list; tag cloud view

### 19. Architecture Principles Library
Capture and publish the architecture principles that govern decisions — each principle with rationale, implications and linked ADRs/assets.
- Data model: `principles` (title, statement, rationale, implications, status, tags)
- UI: principles library page; link principles to ADRs

### 20. Fitness Functions & Scorecards
Score assets against configurable dimensions (security posture, documentation completeness, SLA coverage, test coverage, etc.) producing a health score.
- Data model: `scorecard_definitions` (dimensions JSON with weight); `asset_scores` (asset_id, scorecard_id, scores JSON, total, scored_at)
- UI: scorecard summary on asset detail; portfolio-wide scorecard leaderboard

### 26. Internationalisation — Multi-Currency & Locale Settings
Every money field in Pixxel (`assets.contract_amount`, and the new `contracts.value` once shipped — see #4) is hard-coded to USD formatting with no currency concept anywhere in the app. A Settings page to configure the org's base currency (and optionally per-record currency) would let non-US customers see correctly formatted, correctly labelled amounts instead of everything rendered as `$`.
- Data model: `org_settings` (or extend `site.config.json`) with `baseCurrency` (ISO 4217 code); if per-record currency is in scope, add a `currency` column to every money-bearing table (`assets`, `contracts`, ...), each nullable/defaulting to the org base currency
- UI: Settings → Localization page — currency dropdown (ISO 4217 list), live preview of number formatting (`Intl.NumberFormat`); every existing `$X,XXX` display switches to locale-aware formatting driven by the configured currency
- Scope decision needed at design time: single org-wide currency (simpler, no FX conversion) vs. per-record currency with no conversion (amounts just display in their own currency, no roll-up totals across currencies) vs. full multi-currency with FX rates (out of scope for a first pass — no exchange-rate data source exists in the app)
- Explicitly deferred from #4 Contract Management: that item ships USD-only, matching today's `contract_amount` behavior, specifically so it doesn't have to solve this first

---

## Priority 5 — Advanced / Integrations

### 21. ServiceNow CMDB Sync
Bi-directional sync between pixxel assets and ServiceNow Configuration Items. Eliminates double-entry for organisations already running ServiceNow.
- Sync asset name, owner, lifecycle status, tier, domain
- Conflict resolution: last-write-wins or pixxel-authoritative
- Settings page for ServiceNow instance URL, credentials, field mapping

### 22. API & Webhooks
REST API with API key auth for external tools to query and push data. Webhooks for key events (asset created/updated, phase added, ADR accepted).
- `/api/v1/` versioned endpoints
- API key management in Settings
- Webhook endpoint registration with secret signing (HMAC-SHA256)

### 23. Business Process Mapping
Link assets to business processes — the "capability to process to asset" traceability chain. Needed for impact analysis ("if this asset goes down, which processes are affected?").
- Data model: `business_processes` (name, description, owner, domain_id); `process_assets` join
- UI: process list; asset detail "Processes" tab; process → asset dependency view

### 24. Multi-Tenancy
Multiple isolated organisations sharing one pixxel instance with complete data separation. Required for MSPs or multi-business-unit enterprises.
- `tenant_id` column on all entity tables
- Tenant-aware auth middleware
- Super-admin tenant management console

### 25. Demand & Change Request Management
Intake and triage of business demands (new capabilities, change requests) linked to assets and projects. Feeds the roadmap planning process.
- Data model: `demands` (title, description, requestor, business_value, effort_estimate, status, linked_asset_ids, linked_project_id)
- Statuses: Submitted → Under Review → Approved → In Flight → Delivered / Rejected
- UI: demand backlog board; link demand to roadmap phase when approved

---

## Backlog Summary

| # | Item | Priority | Effort |
|---|------|----------|--------|
| 1 | Application Dependency Map | P1 | L |
| 2 | Risk Register | P1 | M |
| 3 | Technology Radar | P1 | L |
| 4 | Contract Management | P1 | M |
| 5 | Architecture Decision Records | P1 | M |
| 6 | Portfolio Heat Map | P2 | M |
| 7 | TCO & Cost Centre Tracking | P2 | M |
| 8 | Roadmap by Domain | P2 | S |
| 9 | Sunset & Retirement Workflow | P2 | M |
| 10 | Lifecycle Timeline View | P2 | M |
| 11 | Bulk Import (CSV/Excel) 🟡 open PR | P3 | M |
| 12 | Global Search | P3 | M |
| 13 | Export & Reporting | P3 | M |
| 14 | Notifications & Alerts | P3 | S |
| 15 | Compliance Tracking | P3 | M |
| 16 | SSO / SAML Authentication | P4 | L |
| 17 | Custom Attributes | P4 | L |
| 18 | Tag System | P4 | S |
| 19 | Architecture Principles Library | P4 | S |
| 20 | Fitness Functions & Scorecards | P4 | L |
| 26 | Internationalisation — Multi-Currency & Locale Settings | P4 | M |
| 21 | ServiceNow CMDB Sync | P5 | L |
| 22 | API & Webhooks | P5 | L |
| 23 | Business Process Mapping | P5 | M |
| 24 | Multi-Tenancy | P5 | XL |
| 25 | Demand & Change Request Management | P5 | L |

Effort: S = days, M = 1–2 weeks, L = 2–4 weeks, XL = months
