# API Playground - /api-playground

**File:** `src/app/api-playground/page.tsx`
**Auth:** Not required at the page level (note: `/api-playground` is NOT on the middleware public allowlist, so it is treated like any page)
**Snapshot:** 2026-06-10

---

## Purpose

Custom (non-Swagger) interface for browsing per-feature YAML API specs and firing a few live test calls. Unlike `/api-docs` (SwaggerUI), this is a hand-built UI.

---

## Component Tree

```
ApiPlaygroundPage
├── Page header ("API Playground")
├── API spec selector (14 endpoints)
│   └── Dropdown or tabs for each endpoint spec
└── Per-endpoint panel
    ├── Endpoint description
    ├── Pre-filled request body (JSON editor)
    ├── "Quick Test" button → fires request
    ├── Response display (JSON, syntax highlighted)
    └── Response status badge
```

---

## 14 Spec Entries (`specs` map, each points to a YAML file)

`analytics` (Teacher Analytics), `auth-user` (Auth & User), `assistant` (Voice Assistant), `lesson-plan`, `quiz`, `worksheet`, `visual-aid`, `instant-answer`, `rubric`, `teacher-training`, `virtual-field-trip`, `intent` (Intent Router), `content` (Content Management), `system` (System Health).

These are selectable spec descriptors. Default `selectedSpec` is `analytics`.

---

## Live Test Buttons

The page wires three real fetch helpers (not a generic JSON request editor):
- `testTeacherHealth()` → `GET /api/analytics/teacher-health/{userId}`
- `testProfileCheck()` → `GET /api/auth/profile-check?uid={userId}`
- `testSystemHealth()` → `GET /api/health`

---

## State

| State | Type | Purpose |
|---|---|---|
| `selectedSpec` | `string` | Active spec key (default `analytics`) |
| `userId` | `string` | Input for the test calls |
| `email` | `string` | Optional input |
| `response` | `{ status, data } \| null` | Last response |
| `loading` | `boolean` | Request in flight |
| `error` | `string` | Error message |

---

## Design

- Lucide icons (Wrench, Rocket, etc.); response panel shows `{ status, data }`.
- Inputs validate that a User ID is present before firing the analytics/profile tests.
