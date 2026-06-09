# Admin: Cost Dashboard — /admin/cost-dashboard

**File:** `src/app/admin/cost-dashboard/page.tsx`
**Auth:** Required (admin-only — no explicit role check in route, relies on Firestore rules for data access)

---

## Purpose

Real-time monitoring of AI API spending. Shows daily costs per service with threshold alerts to catch runaway costs before they exceed budget.

---

## Component Tree

```
CostDashboardPage
├── Page header (title + last updated timestamp)
├── Summary cards row
│   ├── Total today spend
│   ├── Gemini token costs
│   ├── TTS character costs
│   ├── Grounding API calls
│   ├── Image generation costs
│   └── Firestore write costs
├── Daily cost chart (last 7 days bar chart)
├── Threshold alerts section
│   └── Alert cards (service, current spend, threshold, % used)
└── Cost breakdown table (per service, per day)
```

---

## Data Flow

1. Mount + interval: `getDailyCostsAction()` → fetches from cost service
2. `src/lib/services/cost-service.ts` → reads from Firestore `usage_metrics` collection
3. Costs calculated as:
   - Gemini: $0.10 per 1M tokens
   - TTS: Google Cloud TTS pricing
   - Image generation: $0.04 per image
   - Grounding: per-call pricing
4. Threshold: configurable per service (hardcoded defaults in cost-service.ts)

---

## Cost Aggregation

`aggregator.ts` server action is called on every AI tool usage to atomically increment daily counters:
- `Firestore atomic increment` on `usage_metrics/{YYYY-MM-DD}/{service}`
- Runs async (fire-and-forget) so it doesn't slow down tool responses

---

## Alerts

- Yellow warning: >70% of threshold
- Red alert: >90% of threshold
- Each alert shows: service name, current spend, threshold, progress bar

---

## Design

- Summary cards: 3-col grid on desktop, 1-col on mobile
- Each card: service icon, dollar amount (2 decimal places), period label
- Chart: Recharts bar chart (from Shadcn chart component)
- Alert cards: bordered with left-side colored stripe
- Threshold exceeded: pulsing red dot + red background on card

---

## Access Control Note

This page has no explicit role/admin check. It's security-through-obscurity (URL not linked from public nav). For production hardening, add admin UID check to `getDailyCostsAction()`.
