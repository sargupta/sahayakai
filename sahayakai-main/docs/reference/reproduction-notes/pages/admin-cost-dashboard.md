# Admin: Cost Dashboard - /admin/cost-dashboard

**File:** `src/app/admin/cost-dashboard/page.tsx`
**Auth:** No explicit in-route role check (component name `AdminCostDashboard`). Relies on the route not being linked from public nav and on Firestore rules for `getDailyCostsAction`. See Access Control Note.
**Snapshot:** 2026-06-10

---

## Purpose

"Mission Control & Costs" - a single-screen, today-only snapshot of AI/infra usage against hardcoded daily thresholds, plus a static system-status panel and a billing-safeguards note. It is a presentation/monitoring surface, not a multi-day analytics tool.

---

## Component Tree

```
AdminCostDashboard
├── Loading state (ShieldCheck spinner: "Syncing real-time costs...")
├── Hero header ("Mission Control & Costs" + REAL-TIME MONITORING pill)
├── Metrics grid (grid-cols-1 md:2 lg:3)
│   ├── MetricCard "Gemini Spend"   (value=estimated_spend_usd, threshold 50 USD)
│   ├── MetricCard "TTS Volume"     (tts_characters, threshold 5,000,000 chars)
│   ├── MetricCard "Grounding API"  (grounding_calls, threshold 1,000)
│   ├── MetricCard "Firestore Writes" (firestore_writes, threshold 10,000)
│   ├── MetricCard "Image Gen"      (image_generations, threshold 500)
│   └── System Status card (STATIC: hardcoded "Cloud Run OK", "API Latency: 420ms", "SAFE TO SCALE")
└── Billing Safeguards card (static explanatory text)
```

Note: there is NO daily 7-day bar chart and NO per-service breakdown table (the old doc described these; they do not exist).

---

## MetricCard

Each card computes `percentage = min(100, value/threshold*100)` and shows a status badge:
- `value >= threshold` → CRITICAL (pulsing destructive badge)
- `value >= threshold * 0.8` → WARNING (orange badge)
- otherwise → HEALTHY (green outline badge)

Renders a `Progress` bar with a `0% / N% Usage / 100%` scale.

---

## State

| State | Type | Purpose |
|---|---|---|
| `stats` | `any` | `metrics` object from today's cost doc |
| `loading` | `boolean` | Initial fetch |

---

## Data Flow

1. Mount: `getDailyCostsAction(1)` (`src/app/actions/profile.ts`) - fetches the most recent day; uses `data[0].metrics`.
2. Fallback when nothing tracked today: all metric fields default to `0`.
3. Metric fields read: `estimated_spend_usd`, `tts_characters`, `grounding_calls`, `firestore_writes`, `image_generations` (and `gemini_tokens` in the fallback shape).

There is no polling interval - it fetches once on mount.

TODO(verify: the "Gemini Spend" card description still reads "Gemini 2.0 Flash APIs" in source; ground truth default model is gemini-2.5-flash. This is a stale UI string in the page, not a doc error - flag for app-side fix, do not edit source here.)

---

## System Status / Billing cards

Both the "System Status" panel (Cloud Run region, latency, "SAFE TO SCALE") and the "Billing Safeguards" copy are hardcoded static content, not live data.

---

## Design

- Metrics: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, colored icon chips per service.
- Status card: dark `bg-slate-900`, pulsing green dots.
- Lucide icons: Zap, Mic, Search, Database, TrendingUp, Activity, ShieldCheck, AlertTriangle, Coins.

---

## Access Control Note

No explicit admin/UID check in the route. Security-through-obscurity (URL not in public nav). For production hardening, gate `getDailyCostsAction` and/or the route behind an admin check.
