# Impact Dashboard - /impact-dashboard

**File:** `src/app/impact-dashboard/page.tsx`
**Auth:** Required (signed-out users get `<AuthGate>` prompt: "Sign in to see your impact")
**Snapshot:** 2026-06-10

---

## Purpose

Shows a teacher's personal impact metrics and analytics. Visualizes teaching activity health, engagement levels, content creation patterns, and growth over time.

---

## Component Tree

```
ImpactDashboardPage
├── (no user) AuthGate  → "Sign in to see your impact"
└── (user) header + TeacherAnalyticsDashboard userId={user.uid}
    ├── Overall health score (circular progress indicator, 0–100)
    ├── Risk level badge (LOW / MEDIUM / HIGH)
    ├── Breakdown scores (circular indicators, smaller)
    │   ├── Activity score
    │   ├── Engagement score
    │   ├── Success score
    │   └── Growth score
    ├── Recommendations section (actionable suggestions)
    └── Historical chart (activity over time)
```

---

## State (TeacherAnalyticsDashboard)

| State | Type | Purpose |
|---|---|---|
| `healthData` | `object \| null` | Fetched analytics |
| `loading` | `boolean` | Fetch in flight |

---

## Data Flow

1. Mount: `GET /api/analytics/teacher-health/{userId}` → returns impact model scores
2. Score calculation: `src/lib/analytics/impact-score.ts` - weighted formula
3. Risk level: derived from overall score (< 40 = HIGH, 40–70 = MEDIUM, > 70 = LOW)

---

## TeacherAnalyticsDashboard Component

File: `src/components/teacher-analytics-dashboard.tsx`

- Circular progress indicators: SVG-based, stroke-dashoffset animation
- Score colors: green (> 70), amber (40–70), red (< 40)
- Breakdown: 4 sub-scores each with own circular indicator
- Recommendations: bulleted list of actionable suggestions based on lowest scores

---

## Analytics Model (impact-score.ts)

Overall score is the sum of four 0..100-scaled dimensions (`src/lib/analytics/impact-score.ts`). Activity is capped at 0..30 and uses temporal decay on `sessions_last_7_days` / `sessions_days_8_to_14`. TODO(verify: exact per-dimension weights for Engagement/Success/Growth and the overall normalization).

---

## Design

- Clean dashboard layout
- Primary metric: large centered circle (diameter ~200px)
- Sub-metrics: smaller circles in 2×2 grid
- Score number displayed in center of each circle
- Risk badge: colored pill (green/yellow/red)
