# Roadmap by Platform — Design Spec

**Date:** 2026-06-24  
**Status:** Approved

---

## Overview

Add a Gantt-chart-style roadmap view to Pixxel that plots every asset's investment phases over a user-selected quarter range. Assets are grouped by domain, phases are colour-coded by investment classification, and all editing is done inline via click-to-add / click-to-edit modals directly on the chart.

---

## Data Model

### `investment_classifications`

Configurable reference table for investment labels. Seeded on first boot (if empty) with four defaults.

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(36)` PK | UUID |
| `name` | `VARCHAR(100) NOT NULL` | e.g. "Invest" |
| `color` | `VARCHAR(20) NOT NULL` | Hex string e.g. `#22c55e` |
| `sort_order` | `INT UNSIGNED NULL` | Controls display order |
| `created_by_id` | `CHAR(36) NOT NULL` | |
| `created_by_name` | `VARCHAR(255) NOT NULL` | |
| `created_at` | `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` | |
| `updated_at` | `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` | |

**Seed data (inserted only if table is empty):**

| Name | Color |
|---|---|
| Invest | `#22c55e` (green) |
| Experiment | `#3b82f6` (blue) |
| Contain | `#eab308` (yellow) |
| Decommission | `#ef4444` (red) |

### `asset_roadmap_phases`

One row per investment phase per asset. Phases must not overlap for the same asset.

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(36)` PK | UUID |
| `asset_id` | `CHAR(36) NOT NULL` | FK → `assets.id` |
| `classification_id` | `CHAR(36) NOT NULL` | FK → `investment_classifications.id` |
| `start_quarter` | `VARCHAR(7) NOT NULL` | Format: `"YYYY-Qn"` e.g. `"2026-Q3"` |
| `end_quarter` | `VARCHAR(7) NOT NULL` | Format: `"YYYY-Qn"`, must be >= `start_quarter` |
| `notes` | `TEXT NULL` | |
| `created_by_id` | `CHAR(36) NOT NULL` | |
| `created_by_name` | `VARCHAR(255) NOT NULL` | |
| `created_at` | `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` | |
| `updated_at` | `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` | |

**Validation rules (enforced at API level):**
- `end_quarter >= start_quarter` (string sort works: "2026-Q3" < "2027-Q1")
- No two phases for the same `asset_id` may overlap — API rejects with 409 if they do

---

## API Routes

### Investment Classifications

| Method | Route | Action |
|---|---|---|
| GET | `/api/investment-classifications` | List all, ordered by `sort_order ASC, name ASC` |
| POST | `/api/investment-classifications` | Create new |
| PUT | `/api/investment-classifications/[id]` | Update name, color, sort_order |
| DELETE | `/api/investment-classifications/[id]` | Delete (reject if any phases reference it) |

### Roadmap Phases

| Method | Route | Action |
|---|---|---|
| GET | `/api/roadmap/phases?from=YYYY-Qn&to=YYYY-Qn` | All assets (with domain) + their phases overlapping the range |
| POST | `/api/roadmap/phases` | Create phase (validates no overlap) |
| PUT | `/api/roadmap/phases/[id]` | Update phase (re-validates no overlap) |
| DELETE | `/api/roadmap/phases/[id]` | Delete phase |

GET `/api/roadmap/phases` response shape:
```json
[
  {
    "domainId": "...",
    "domainName": "CRM & Sales",
    "assets": [
      {
        "id": "...",
        "name": "Salesforce",
        "phases": [
          {
            "id": "...",
            "classificationId": "...",
            "classificationName": "Invest",
            "classificationColor": "#22c55e",
            "startQuarter": "2026-Q3",
            "endQuarter": "2027-Q2",
            "notes": null
          }
        ]
      }
    ]
  }
]
```

Assets with no phases in the range are still included (with `phases: []`).

---

## Pages & Components

### `/roadmap/by-platform`

**File:** `app/(dashboard)/roadmap/by-platform/page.tsx`

**Header bar:**
```
Roadmap by Platform    [Domains ▼ (All)]    [From: 2026-Q3 ▼]  [To: 2028-Q2 ▼]
```

- **Domain filter** — multi-select dropdown (checkboxes). Options sourced from `/api/domains`. "All Domains" when nothing selected. Selecting one or more domains narrows asset rows. State lives in component state (not URL).
- **From / To quarter selects** — `<select>` dropdowns populated with quarter strings from 2024-Q1 to 2030-Q4. Default: current quarter to +7 quarters (~2 years ahead).

**Chart layout (CSS Grid):**

```
┌──────────────────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│                  │26-Q3 │26-Q4 │27-Q1 │27-Q2 │27-Q3 │27-Q4 │28-Q1 │
├──────────────────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┤
│ ▼ CRM & Sales                                                       │
│   Salesforce     ████████████ Invest      ████ Contain              │
│   HubSpot        (click to add phase)                               │
├─────────────────────────────────────────────────────────────────────┤
│ ▼ Infrastructure                                                    │
│   AWS RDS        ██████████████████████████████ Invest              │
│   Legacy Oracle  ████████████████████ Decommission                  │
└─────────────────────────────────────────────────────────────────────┘
```

- Left column: fixed 200px, sticky, contains asset name
- Quarter header row: N equal-width columns via CSS Grid
- Phase bars: coloured `<div>` with rounded corners positioned by `gridColumnStart` + `gridColumn` span
- Each asset row spans the full grid width; phases are absolutely positioned within the grid area

**Phase bar rendering logic:**
1. Build an ordered array of quarter strings in the selected range (e.g. `["2026-Q3", "2026-Q4", "2027-Q1", ...]`)
2. For each phase, find `colStart = indexOf(phase.startQuarter) + 1` and `colSpan = indexOf(phase.endQuarter) - indexOf(phase.startQuarter) + 1`
3. Apply `style={{ gridColumnStart: colStart, gridColumn: \`span ${colSpan}\` }}`
4. Phases clipped outside the selected range are trimmed to the visible window
5. If an asset has overlapping phases (shouldn't happen post-validation), render them on separate sub-rows

**Empty state per asset:** Dashed-border lane with muted "Click to add a phase" hint text. Clicking the lane opens the Add Phase modal.

**Domain groups:** Collapsible via chevron toggle. Collapsed state stored in local React state.

### Add / Edit Phase Modal

Single modal component, toggled by:
- Clicking empty lane → opens in "add" mode (asset pre-filled)
- Clicking an existing phase bar → opens in "edit" mode (all fields pre-filled + Delete button visible)

**Fields:**
- Classification (dropdown, shows colour swatch + name)
- Start Quarter (select, same 2024-Q1…2030-Q4 range)
- End Quarter (select, same range, must be ≥ Start)
- Notes (textarea, optional)

**Actions:** Save (POST or PUT) / Delete (DELETE, edit mode only) / Cancel

---

### `/settings/investment-classifications`

**File:** `app/(dashboard)/settings/investment-classifications/page.tsx`

Follows the same pattern as `settings/roles` and `settings/changelog`.

- Table columns: Colour swatch (16×16 rounded square), Name, Sort Order, Actions (Edit / Delete)
- "Add Classification" button opens modal
- Modal fields: Name (text), Colour (`<input type="color">`), Sort Order (number, optional)
- Delete is blocked if any `asset_roadmap_phases` rows reference the classification (API returns 409, UI shows error toast)

---

## Navigation

New group added to `config/navigation.ts` between "Reports" and "Manage":

```typescript
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
```

---

## Settings Hub

New tile added to the Configuration section in `app/(dashboard)/settings/page.tsx`:

```tsx
<SettingsTile
  href="/settings/investment-classifications"
  icon={MapPin}
  iconBg="bg-rose-500"
  title="Investment Classifications"
  description="Configure roadmap investment labels and their colours."
/>
```

---

## TypeScript Types

New types to add to `types/index.ts`:

```typescript
export interface InvestmentClassification {
  id: string;
  name: string;
  color: string;
  sortOrder: number | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetRoadmapPhase {
  id: string;
  assetId: string;
  classificationId: string;
  classificationName: string;
  classificationColor: string;
  startQuarter: string;
  endQuarter: string;
  notes: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoadmapAsset {
  id: string;
  name: string;
  phases: AssetRoadmapPhase[];
}

export interface RoadmapDomainGroup {
  domainId: string;
  domainName: string;
  assets: RoadmapAsset[];
}
```

---

## DB Bootstrap

Both tables added to `setupDatabase()` in `lib/db.ts` (at the end of the existing `runSetup()` function, after the `changelog` table):

```sql
CREATE TABLE IF NOT EXISTS investment_classifications (
  id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) NOT NULL,
  sort_order INT UNSIGNED NULL,
  created_by_id CHAR(36) NOT NULL,
  created_by_name VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed defaults only if table is empty
INSERT INTO investment_classifications (id, name, color, sort_order, created_by_id, created_by_name)
SELECT * FROM (
  SELECT UUID(), 'Invest',        '#22c55e', 1, 'system', 'System' UNION ALL
  SELECT UUID(), 'Experiment',    '#3b82f6', 2, 'system', 'System' UNION ALL
  SELECT UUID(), 'Contain',       '#eab308', 3, 'system', 'System' UNION ALL
  SELECT UUID(), 'Decommission',  '#ef4444', 4, 'system', 'System'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM investment_classifications LIMIT 1);

CREATE TABLE IF NOT EXISTS asset_roadmap_phases (
  id CHAR(36) NOT NULL,
  asset_id CHAR(36) NOT NULL,
  classification_id CHAR(36) NOT NULL,
  start_quarter VARCHAR(7) NOT NULL,
  end_quarter VARCHAR(7) NOT NULL,
  notes TEXT NULL,
  created_by_id CHAR(36) NOT NULL,
  created_by_name VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_phases_asset_id (asset_id),
  KEY idx_phases_classification_id (classification_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Out of Scope

- PDF / image export of the roadmap
- Sharing / permalink to a specific roadmap view
- Per-user saved filter preferences
- Drag-to-resize phase bars (inline modal editing only)
