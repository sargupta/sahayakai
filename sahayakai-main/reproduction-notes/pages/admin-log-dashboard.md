# Admin: Log Dashboard — /admin/log-dashboard

**File:** `src/app/admin/log-dashboard/page.tsx`
**Auth:** Required (admin-only intent)

---

## Purpose

View recent application logs from Google Cloud Logging. Filter by severity level. Debug production issues without needing GCP Console access.

---

## Component Tree

```
LogDashboardPage
├── Page header (title + refresh button)
├── Severity filter buttons (All | INFO | WARNING | ERROR | CRITICAL)
├── Loading state
└── Log entries list
    └── LogEntry × N
        ├── Severity badge (color-coded)
        ├── Timestamp
        ├── Message text
        ├── Expand button → shows metadata JSON
        └── Expanded metadata (collapsible)
```

---

## State

| State | Type | Purpose |
|---|---|---|
| `logs` | `LogEntry[]` | Fetched log entries |
| `severityFilter` | `string` | 'ALL' \| 'INFO' \| 'WARNING' \| 'ERROR' \| 'CRITICAL' |
| `loading` | `boolean` | Fetch in flight |
| `expandedIds` | `Set<string>` | Expanded log entry IDs |

---

## Data Flow

1. Mount: calls `log-service.ts` → fetches from GCP Cloud Logging API via Admin SDK
2. Filter: client-side severity filter applied to loaded logs
3. Refresh button: re-fetches latest logs
4. Log structure: `{ severity, timestamp, message, metadata: object }`

---

## Log Service (log-service.ts)

- Uses `@google-cloud/logging` client library
- Fetches last 100 log entries from project
- Filters by resource type (Cloud Run service)
- Returns structured log objects with parsed metadata

---

## Design

- Severity color coding: INFO=blue, WARNING=amber, ERROR=red, CRITICAL=red with pulse
- Log entries: monospace font for message, compact timestamp
- Expanded metadata: syntax-highlighted JSON (or raw pre-formatted block)
- Filter buttons: pill style, active = filled, inactive = outline
