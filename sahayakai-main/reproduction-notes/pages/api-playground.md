# API Playground — /api-playground

**File:** `src/app/api-playground/page.tsx`
**Auth:** Not required

---

## Purpose

Interactive testing interface for all major API endpoints. Unlike API Docs (which uses SwaggerUI), this is a custom built UI with pre-configured test buttons for quick testing without needing to set up request headers manually.

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

## 14 Pre-configured Endpoint Specs

1. POST /api/ai/instant-answer
2. POST /api/ai/lesson-plan
3. POST /api/ai/quiz
4. POST /api/ai/rubric
5. POST /api/ai/worksheet
6. POST /api/ai/visual-aid
7. POST /api/ai/teacher-training
8. POST /api/ai/video-storyteller
9. POST /api/ai/virtual-field-trip
10. POST /api/ai/voice-to-text
11. POST /api/assistant
12. GET /api/analytics/teacher-health/[userId]
13. GET /api/auth/profile-check
14. GET /api/health

---

## State

| State | Type | Purpose |
|---|---|---|
| `selectedSpec` | `string` | Active endpoint |
| `requestBody` | `string` | Editable JSON |
| `response` | `object \| null` | Last response |
| `loading` | `boolean` | Request in flight |
| `status` | `number \| null` | HTTP status code |

---

## Design

- Two-panel layout: spec list (left) + editor/response (right)
- JSON editor: monospace font, syntax-highlighted textarea
- Response panel: color-coded status (green=2xx, red=4xx/5xx)
- Quick test button: fires real HTTP request to local server
