# SamparkAI — feature inventory and role navigation (2026-10-29)

Where every SamparkAI feature lives, who reaches it, and how the demo school
(`/sampark/demo`, flag `SAMPARK_DEMO_ENABLED`) relates to the signed-in
console (`/sampark/[orgId]/…`, org admins, Firestore). The demo is isolated
by design: fictional school, browser-only records, no phone rings, so it
reuses the console's domain types, rules and components but not its
Firestore-backed routes.

## Demo navigation

| Section | Teacher (own classes only) | Admin / principal (whole school) |
|---|---|---|
| Workspace | Overview `/demo/teacher` · My classes `/demo/teacher/classes` | School monitor `/demo/admin` · Classes & teachers `/demo/admin/classes` · Families `/demo/admin/families` |
| Outreach | My calls `/demo/teacher/calls` · Follow-ups `/demo/teacher/follow-ups` · Class notices `/demo/teacher/outreach` | All calls `/demo/admin/calls` · Campaigns `/demo/admin/campaigns` |
| Planning | My calendar `/demo/teacher/calendar` | Calendar & callbacks `/demo/admin/calendar` |
| Monitoring | (follow-ups above) | Complaints & follow-ups `/demo/admin/follow-ups` |

## Inventory

| Existing feature | Existing implementation | Teacher | Admin | Status |
|---|---|---|---|---|
| Four outreach reasons | `OutreachReason` (`src/types/attendance.ts`), Attendance contact modal | ✓ call dialog | ✓ call dialog | Reused unchanged |
| AI parent call (calm rules, complaint capture) | `src/ai/flows/parent-call-agent.ts` | ✓ | ✓ | Reused via `/api/sampark-demo/*`; browser call, no phone |
| Post-call summary, sentiment, complaint | same flow, `complaintAboutTeacher` | ✓ own classes | ✓ all | Integrated |
| Call history and detail | demo call list + detail sheet | ✓ own classes | ✓ all, filter by teacher/reason | Integrated |
| Complaints, follow-ups, not reached | demo follow-ups board | ✓ own classes, "Mark as seen" | ✓ all, "Mark resolved" | Integrated |
| Callbacks (statuses, parent requests need a person, calling-hour rules) | `src/lib/sampark/callbacks/*` (types, state, time) | ✓ own classes | ✓ all | Demo uses the same statuses, lead/ahead limits and status pills; rules in `src/lib/sampark/demo/rules.ts` |
| School calendar (callbacks, campaign calls, school events, holidays) | `src/lib/sampark/calendar/events.ts`, `callback-dates`, `event-labels` | ✓ own classes + whole-school notices | ✓ all | Demo calendar built with the real builders (`campaignCallsEvent`, `schoolEvents`, `holidayEvents`) |
| Notice campaigns (PTM, events, closures) | `types/sampark` `Campaign`, `CampaignStepper/Funnel/Outcomes`, `OutcomeDonut` | read-only "Class notices" | create draft → approve → call (simulated) → done | Integrated with the console's components |
| Families / student lookup | demo roster | ✓ own classes | ✓ all classes, `?class=` | Integrated |
| Classes & teachers overview | — (new view over existing data) | — | ✓ | New page, no new backend |
| Sahayak Attendance handoff | middleware, flag-gated | `/attendance` → `/sampark/demo/teacher?from=sahayak` | — | Integrated (page-level; see gaps) |
| Signed-in console: Today, Campaigns, Calls, Families, Riya calls, Calendar, Google Calendar, Settings | `src/app/sampark/(workspace)/[orgId]/*` | — (org admins only) | ✓ with sign-in + Firestore | Unchanged; new theme and branding apply |
| Riya (ElevenLabs) conversation calls | `/sampark/[orgId]/riya` | — | ✓ console | Not in the demo (needs provider + Test phone) |
| Google Calendar sync | `/sampark/[orgId]/calendar/google` | — | ✓ console | Not in the demo (needs OAuth) |
| Teacher outreach tab, my-calls API | `demo-tonight-wt` (branch `demo/tonight-2026-10-23`) | — | — | Other branch, not merged here |
| Unified calls view, API keys, contact policy | PRs #164, #163, #165 (on `feature/school-parent-calling`) | — | — | Other branches, not merged here |

## Gaps

- The Attendance handoff is page-level: with the flag on, opening Attendance
  goes to the demo teacher workspace. Real students are not in the demo
  school, so a real student's "Contact parent" cannot pre-select a demo
  student (and real names are never put in a URL). Deep links
  `?student=&reason=` work for demo students.
- Campaign calling in the demo is simulated progress (Practice mode); the
  console's dispatcher, audio rendering and carrier are not exercised.
- Demo records live in each viewer's browser; two viewers do not share calls.
