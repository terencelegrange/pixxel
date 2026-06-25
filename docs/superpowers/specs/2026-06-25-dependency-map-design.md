# Application Dependency Map — Design Spec

**Date:** 2026-06-25
**Status:** Approved

---

## Overview

Add an interactive dependency map to pixxel that lets architects record, visualise and navigate integration relationships between assets. Two surfaces: a portfolio-level map page and a per-asset Dependencies tab on the asset detail page.

---

## Section 1 — Data Model

### Table: `asset_dependencies`

```sql
CREATE TABLE IF NOT EXISTS asset_dependencies (
  id              CHAR(36)     NOT NULL,
  source_asset_id CHAR(36)     NOT NULL,
  target_asset_id CHAR(36)     NOT NULL,
  type            ENUM('API','Database','File Transfer','Event / Message','UI Embed','Other')
                               NOT NULL DEFAULT 'API',
  direction       ENUM('outbound','bidirectional')
                               NOT NULL DEFAULT 'outbound',
  notes           TEXT         NULL,
  created_by_id   CHAR(36)     NOT NULL,
  created_by_name VARCHAR(255) NOT NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dep_pair (source_asset_id, target_asset_id),
  KEY idx_dep_source (source_asset_id),
  KEY idx_dep_target (target_asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Semantics:**
- `source_asset_id` — the caller / consumer / sender
- `target_asset_id` — the provider / dependency / receiver
- `direction: outbound` — source calls target only
- `direction: bidirectional` — both assets call each other (e.g. two-way sync)
- One record per pair; `UNIQUE(source, target)` enforced at DB and API level
- Self-references rejected at API level (400)

### TypeScript types (`types/index.ts`)

```typescript
export type DependencyConnectionType =
  | 'API'
  | 'Database'
  | 'File Transfer'
  | 'Event / Message'
  | 'UI Embed'
  | 'Other';

export type DependencyDirection = 'outbound' | 'bidirectional';

export interface AssetDependency {
  id: string;
  sourceAssetId: string;
  sourceAssetName: string;
  sourceAssetIcon: string | null;
  sourceAssetDomain: string | null;
  targetAssetId: string;
  targetAssetName: string;
  targetAssetIcon: string | null;
  targetAssetDomain: string | null;
  type: DependencyConnectionType;
  direction: DependencyDirection;
  notes: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## Section 2 — API Routes

### `GET /api/dependencies`
Returns all dependencies with joined asset names, icons and domain names.
Response: `{ dependencies: AssetDependency[] }`

SQL join pattern:
```sql
SELECT
  d.id, d.type, d.direction, d.notes, d.created_by_id, d.created_by_name, d.created_at, d.updated_at,
  d.source_asset_id,  sa.name AS source_asset_name,  sa.icon AS source_asset_icon,  sdom.name AS source_asset_domain,
  d.target_asset_id,  ta.name AS target_asset_name,  ta.icon AS target_asset_icon,  tdom.name AS target_asset_domain
FROM asset_dependencies d
JOIN assets sa ON sa.id = d.source_asset_id
LEFT JOIN domains sdom ON sdom.id = sa.domain_id
JOIN assets ta ON ta.id = d.target_asset_id
LEFT JOIN domains tdom ON tdom.id = ta.domain_id
ORDER BY sa.name ASC, ta.name ASC
```

### `POST /api/dependencies`
Create a new dependency.
Body: `{ sourceAssetId, targetAssetId, type, direction, notes?, userId, userName }`
Validation:
- `sourceAssetId` required (400)
- `targetAssetId` required (400)
- `sourceAssetId === targetAssetId` → 400 "An asset cannot depend on itself."
- `type` must be a valid enum value (400)
- `direction` must be `outbound` or `bidirectional` (400)
- `userId` / `userName` required (401)
- Duplicate pair (same source+target) → 409 "A dependency between these assets already exists."
- Reverse pair exists (source and target swapped) → 409 "A dependency in the reverse direction already exists. Edit it and set direction to bidirectional instead."
Response: `{ id }` 201

### `PUT /api/dependencies/[id]`
Update type, direction, notes.
Body: `{ type, direction, notes?, userId, userName }`
- 404 if not found
- Same type/direction validation as POST
- Writes audit (UPDATE)
Response: `{ success: true }` 200

### `DELETE /api/dependencies/[id]`
Body: `{ userId, userName }`
- 404 if not found
- Writes audit (DELETE)
Response: `{ success: true }` 200

### `GET /api/assets/[id]/dependencies`
Returns upstream and downstream dependencies for a single asset.
Response:
```typescript
{
  upstream: AssetDependency[];   // target_asset_id = id (they call us)
  downstream: AssetDependency[]; // source_asset_id = id (we call them)
}
```
Bidirectional connections appear in both lists.

---

## Section 3 — Portfolio Map Page

**Route:** `/dependencies`
**Navigation:** New item in the Assets nav group — label "Dependency Map", icon `Network`, positioned after "Diagrams".

### Layout

Full-viewport-height page. Toolbar pinned to top; React Flow graph fills remaining height.

**Toolbar (left to right):**
- Search input — filters nodes by asset name (hides non-matching nodes and their edges)
- Type filter dropdown — All / API / Database / File Transfer / Event / Message / UI Embed / Other
- Domain filter dropdown — All / [domain names]
- Tab switcher — Force-directed | Layered | Domain-clustered (right-aligned in toolbar)
- "Add Dependency" button (primary, far right)

### Custom React Flow Node

Reused across all three tab layouts and the mini map:

```
┌─────────────────────┐
│ [Icon]  Asset Name  │
│         SHORT  ● ●  │  ← short code badge + lifecycle dot
└─────────────────────┘
```

- Border colour by domain (consistent colour mapping seeded from domain name hash)
- Selected state: ring highlight
- Click: navigate to `/assets/[id]`

### Custom React Flow Edge

- Label showing the connection type (small pill: "API", "Database", etc.)
- Arrowhead: single arrow for `outbound`, double arrow for `bidirectional`
- Click: opens the side panel

### Tab 1 — Force-Directed

Layout calculated via a custom spring simulation running in `useEffect`:
- 80 iterations of repulsion (all-pairs, inverse-square) + attraction (connected pairs, spring)
- Runs once on data load; result frozen into node positions
- Nodes are draggable (React Flow built-in) after simulation completes
- Re-runs when filter changes shrink/grow the visible node set

### Tab 2 — Layered (Left → Right)

Layout calculated by `@dagrejs/dagre`:
- `rankdir: 'LR'`, `ranksep: 120`, `nodesep: 60`
- Calculated once per data change, positions set on React Flow nodes
- Nodes not draggable in this mode (layout would break)

### Tab 3 — Domain-Clustered

- One React Flow group node per domain (parent nodes, background coloured lightly by domain)
- Child asset nodes positioned in a grid within each group
- Groups arranged left-to-right alphabetically
- Cross-domain edges connect through group boundaries

### Side Panel (edge click)

Fixed panel, 320px wide, slides in from the right:

```
[Source Asset Name]  →  [Target Asset Name]
[API badge]  [outbound / bidirectional]

Notes:
<text or "No notes">

[Edit]  [Delete]
```

Edit mode: inline form replacing the display (type select, direction select, notes textarea, Save / Cancel).
Delete: confirmation prompt within the panel before calling DELETE API.
Close: X button top-right or click outside panel.

### Add Dependency Modal

Fields:
- Source asset — searchable dropdown of all assets
- Target asset — searchable dropdown (excludes selected source)
- Type — select (API default)
- Direction — select (outbound default)
- Notes — textarea (optional)

Validation errors shown inline. On success: graph refreshes, modal closes.

---

## Section 4 — Asset Detail Dependencies Tab

Added as a new tab on `/assets/[id]`, labelled "Dependencies" with icon `Network`.

### Mini Map (top, ~240px tall)

Read-only React Flow instance, `fitView`, no controls except zoom:
- Centre node: current asset (highlighted ring, slightly larger)
- Left column: upstream assets (those that call this one, `target = current`)
- Right column: downstream assets (those this one calls, `source = current`)
- Edges: same custom edge component (type label, direction arrow)
- Bidirectional connections have edges on both sides
- Click any neighbour node: navigates to `/assets/[neighbour-id]`
- Empty state: centred message "No dependencies yet"

### Editable List (below mini map)

Two labelled sections:

**Downstream — "We depend on"**
Each row: connected asset name (link), type badge, direction indicator, notes (truncated, title attr for full), edit pencil, delete trash.

**Upstream — "Depends on us"**
Same layout. Bidirectional connections appear in both sections.

**"Add Dependency" button** at top of tab. Opens the Add Dependency modal with source asset pre-filled and locked to the current asset.

**Edit:** pencil icon opens a modal with type, direction, notes pre-filled (source/target locked).

**Delete:** trash icon shows an inline confirmation (name of the connected asset) before calling DELETE.

---

## Section 5 — Testing

Unit tests in `__tests__/unit/api/dependencies/`:

### `route.test.ts` (~8 tests)
- GET: returns mapped rows correctly
- POST: 400 on missing sourceAssetId
- POST: 400 on missing targetAssetId
- POST: 400 on self-reference (`source === target`)
- POST: 400 on invalid type value
- POST: 401 on missing userId
- POST: 409 on duplicate pair (mock DB unique constraint error, `errno: 1062`)
- POST: 201 on success

### `id.test.ts` (~4 tests)
- PUT: 404 when dependency not found
- PUT: 200 on success
- DELETE: 404 when dependency not found
- DELETE: 200 on success

### `asset-dependencies.test.ts` (~4 tests)
- GET: returns correct upstream array (target_asset_id = id)
- GET: returns correct downstream array (source_asset_id = id)
- GET: bidirectional dependency appears in both upstream and downstream
- GET: returns empty arrays when no dependencies exist

Total: ~16 tests. No UI tests — React Flow graph correctness verified visually.

---

## Section 6 — New Dependency

One npm package: `@dagrejs/dagre` (~60kb minified), used only for the layered tab layout calculation. No other new dependencies.

---

## Implementation Checklist

- [ ] DB: `asset_dependencies` table in `lib/db.ts`
- [ ] Types: 4 new exports in `types/index.ts`
- [ ] API: `app/api/dependencies/route.ts` (GET, POST)
- [ ] API: `app/api/dependencies/[id]/route.ts` (PUT, DELETE)
- [ ] API: `app/api/assets/[id]/dependencies/route.ts` (GET)
- [ ] Tests: 16 unit tests across 3 test files
- [ ] Install: `@dagrejs/dagre` (ships its own types, no `@types/dagre` needed)
- [ ] Component: `components/dependencies/DependencyNode.tsx` (custom RF node)
- [ ] Component: `components/dependencies/DependencyEdge.tsx` (custom RF edge)
- [ ] Component: `components/dependencies/AddDependencyModal.tsx`
- [ ] Component: `components/dependencies/DependencyPanel.tsx` (side panel)
- [ ] Page: `app/(dashboard)/dependencies/page.tsx` (portfolio map, 3 tabs)
- [ ] Page update: add Dependencies tab to `app/(dashboard)/assets/[id]/page.tsx`
- [ ] Nav: add "Dependency Map" to `config/navigation.ts`
