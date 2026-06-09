# Admin: Log Dashboard - /admin/log-dashboard

**File:** `src/app/admin/log-dashboard/page.tsx`
**Auth:** No explicit in-route role check (component `AdminLogDashboard`, admin-only intent). Relies on `getLogsAction` access control + route not being in public nav.
**Snapshot:** 2026-06-10

---

## Purpose

"System Logs" - view recent application logs from Google Cloud Logging without GCP Console access. Filter by severity and expand any entry to see structured attributes.

---

## Component Tree

```
AdminLogDashboard
├── Header ("System Logs" + Refresh button)
├── Filters card
│   └── Severity buttons: ALL | INFO | WARNING | ERROR   (no CRITICAL button)
├── Error banner (if getLogsAction returns/throws an error)
└── Logs card ("Live Stream - Last 50 Entries")
    └── Log row × N
        ├── Expand chevron
        ├── Timestamp (date-fns "MMM dd, HH:mm:ss")
        ├── Severity badge (color-coded)
        ├── Message (truncated) + optional service tag
        ├── Request id (lg+ only, first 8 chars)
        └── Expanded panel: JSON of { service, operation, userId, errorId, ...metadata }
                            + error-id reference block when log.errorId present
```

---

## State

| State | Type | Purpose |
|---|---|---|
| `logs` | `LogEntryDTO[]` | Fetched entries |
| `loading` | `boolean` | Fetch in flight |
| `severityFilter` | `string` | 'ALL' \| 'INFO' \| 'WARNING' \| 'ERROR' |
| `expandedId` | `string \| null` | Single expanded row (`${timestamp}-${index}`) |
| `error` | `string \| null` | Fetch error message |

Note: a single `expandedId` (one row open at a time), not a `Set` of ids.

---

## Data Flow

1. `fetchLogs` (useCallback, re-created when `severityFilter` changes): `getLogsAction(50, severityFilter)` (`src/app/actions/logs.ts`).
2. Result shape `{ logs?: LogEntryDTO[], error?: string }`; on `result.error` the error banner renders.
3. Severity filter is passed to the action (server-side filter), and changing it re-triggers `fetchLogs` via the effect dependency.
4. Refresh button re-runs `fetchLogs`.

`LogEntryDTO` (from `src/lib/services/log-service.ts`) fields used: `timestamp`, `severity`, `message`, `service`, `requestId`, `operation`, `userId`, `errorId`, `metadata`.

---

## Severity Badge Mapping

- `ERROR` / `CRITICAL` → destructive badge (AlertCircle icon)
- `WARNING` → amber badge (AlertTriangle icon)
- default (INFO / other) → secondary badge (Info icon)

---

## Design

- Expanded panel: dark `bg-black/90` block, emerald monospace JSON, optional red error-id reference box.
- Filter buttons: pill style, active = filled foreground/background.
- Lucide icons: Terminal, AlertCircle, Info, AlertTriangle, RefreshCw, ChevronDown/Right, Filter, Activity.
