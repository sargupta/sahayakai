# Documentation Refresh - Open Questions

**Generated:** 2026-06-10
**Source:** June 2026 documentation refresh (`feature/docs-refresh-jun2026`)

During the refresh, every factual claim was verified against `sahayakai-main/src/`.
Claims that could not be confirmed from code were marked inline with a
`TODO(verify: ...)` marker rather than guessed or invented. This file collects
all 139 markers so they can be resolved by a human.

There are two kinds of open question:

- **Tier 1 - needs you (business / usage / pricing facts).** Real numbers that
  do not live in the codebase: active users, retention, partner names, pricing,
  market sizing, measured time-savings. These were never fabricated. Fill them
  with real data or delete the claim.
- **Tier 2 - code-verifiable detail (an engineer can resolve).** Exact prop
  names, schema field shapes, enum members, icon mappings. Resolvable by
  re-reading a named source file. These were flagged where a refresh agent did
  not have the specific file in scope; they are accuracy nits, not invented
  facts.

---

## Tier 1 - needs you (real business / usage data)

These are the high-stakes investor and impact claims. Do not ship the
strategy/pitch docs or whitepaper externally until these are filled with
measured numbers or removed. Per project convention, never invent a number.

### `SahayakAI.md` (monorepo root - pitch)
- L137 - TAM derivation and per-teacher pricing assumptions across lanes
- L138 - SOM size and initial annual opportunity
- L188 - total customer base / outreach to date
- L192 - active users in the past one year
- L198 - measured before/after prep-time figures
- L199 - 3-month retention rate
- L200 - alignment score between AI-generated plans and official State Board Curriculum, plus measurement method
- L295 - hours unlocked per 1,000 teachers/year, with derivation
- L300 - minutes of prep replaced per workflow
- L303 - average minutes/day saved per teacher
- L304 - projected annual hours per 1,000 teachers
- L325 - hours saved per teacher annually
- L326 - total instructional hours unlocked across the system
- L328 - curriculum alignment score for culturally localized content

### `SahayakAI_Whitepaper_2026.md` (monorepo root)
- L17 - projected total learning hours by 2030, with derivation
- L128 - measured reduction in administrative labor
- L148 - measured token-savings percentage from semantic caching
- L182 - current NITI Aayog / Atal New India Challenge status and any finalist credential
- L193-L198 - minutes/day, hours/year, avg students per teacher, hours per teacher, total learning hours at 1M-teacher scale

### `docs/strategy/`
- `RURAL_INDIA_ROADMAP.md` L232-L234 - active teacher count, shared lesson plan count, teacher satisfaction %
- `RURAL_INDIA_ROADMAP.md` L244, `INDIAN_CONTEXT_FEATURES.md` L185, `CHALLENGING_QUESTIONS.md` L5/L274 - challenging-questions self-assessment score
- `STRATEGIC_REVIEW.md` L16 - cache hit rate (measured)
- `INDIAN_CONTEXT_FEATURES.md` L77 - % rural families dependent on farming (cite source)
- `INDIAN_CONTEXT_FEATURES.md` L128 - cultural-relevance scores by aspect
- `CRITICAL_ANALYSIS.md` L182 - average generation time per tool (measured)
- `CRITICAL_ANALYSIS.md` L399 - pilot/field test results
- `BUSINESS_MODEL.md` L42 - named CSR/corporate partners
- `SAHAYAKAI.md` L22 - active users, pilot results, retention
- `SAHAYAKAI.md` L32 - roadmap dates/milestones

### Pricing (needs live Google pricing confirmation)
- `docs/operations/COST_ANALYSIS.md` L101-L104, L154, L315, L359 - current
  per-token / per-image / per-minute Gemini pricing for `gemini-2.5-flash`,
  `gemini-2.5-pro`, `gemini-3-pro-image-preview`, `gemini-2.5-flash-image`.
  Confirm against ai.google.dev/pricing. The cost ratios in the doc are derived
  from code (which model each flow calls); only the dollar rates are unconfirmed.

### Runtime configuration (needs live infra inspection, not in repo)
- `docs/operations/FEATURE_FLAGS.md` L130 - which env vars are actually set on
  the live `sahayakai-hotfix-resilience` revision. Code defaults:
  `VOICE_PROVIDER=twilio`, onboarding gate OFF, App Check tolerant.
- `docs/operations/COST_ANALYSIS.md` L86 - sidecar (`sahayakai-agents`) Cloud Run
  cost; source not in this repo, all dispatch modes default off ($0 in current prod).

### Translations (need native copy, not English placeholders)
- `docs/product/USER_MANUAL_BENGALI.md` L81-L207 and `USER_MANUAL_UNIFIED.md`
  L119-L231 - sections marked "Bengali copy needed" carry English placeholders.
- `docs/product/USER_MANUAL.md` L218 - Kannada copy needed.

---

## Tier 2 - code-verifiable detail (engineer can resolve)

Each item names the source file that settles it. These are precision nits
flagged where the assigned refresh agent did not hold that specific file. No
fabricated content; the surrounding prose is correct, only the exact
prop/field/enum is unconfirmed.

### Data schemas (`src/types/index.ts`, flow schema files, `firestore.rules`)
- `docs/data/DATABASES_SCHEMA.md` L56/L377, `DATABASE_SCHEMA_REVIEW.md` L27 -
  which of `posts` vs `community_posts` is canonical (confirm rename-in-progress).
- `DATABASES_SCHEMA.md` L337-L373 - full field shapes for Post, library_resources,
  saves/invites, pendingSignInLinks, billing reconciliation collections,
  rate_limits, analytics, the three NCERT collections.
- `DATABASE_SCHEMA_REVIEW.md` L17 - micro-lesson production write path.
- `TEACHER_CONNECT_SCHEMA.md` L28/L47/L53 - posts field shape, comments
  collection existence, live database/instance name.
- `DATABASE_VERIFICATION_REPORT.md` L39 - whether download tracking still
  publishes a Pub/Sub event.
- `reproduction-notes/DATA-SCHEMAS.md` L39/L66/L160/L168/L175/L183 -
  `teachingGradeLevels` vs `gradeLevels`, `stats` shape, quiz per-question shape,
  rubric/worksheet/virtual-field-trip `data` shapes, ContentType union,
  Subject/NotificationType/ConnectionStatus enums.

### Flows (`src/ai/flows/*.ts`)
- `reproduction-notes/flows/other-flows.md` L24-L172 - rubric criteria/level
  structure, exam-paper I/O, video-storyteller local-rank-vs-LLM, worksheet
  LaTeX fallback, assessment-scanner model override.
- `flows/quiz-generator.md` L65 - per-question shape (`quiz-generator-schemas.ts`).
- `flows/agent-router.md` L122 - `/api/assistant` + `/api/vidya/*` session
  caching internals (`vidya-assistant.ts`, `src/app/api/assistant/route.ts`).
- `reproduction-notes/ARCHITECTURE.md` L101 - assistant session caching;
  L143 - provider nesting + fonts in `layout.tsx`.

### Components (`src/components/**`)
- message-bubble L91/L103 - RESOURCE_CONFIG table, DeliveryStatus icon map.
- conversation-thread L24/L50/L61 - prop names, SHAREABLE_TYPES table, textarea maxLength.
- conversation-list L82 - current picker filename + action names.
- omni-orb L71 - KNOWN_FLOWS / FLOW_LABEL entries, useJarvisStore fields.
- auth-button L25/L45 - post-sign-in redirect predicate; whether `auth-dialog.tsx` still exists.
- microphone-input L17/L54 - full prop list, auto-submit behaviour.
- app-sidebar L28 - route + icon per nav item.
- display-components L86 - KaTeX math rendering in worksheet-display.tsx.
- community-chat L129 - container height classes, live-indicator label.
- profile-view L33/L64 - getProfileData / getPublicProfileAction shapes, connStatus enum + buttons.
- image-uploader L57/L65 - error-surface mechanism, profile-photo usage.
- create-post-dialog L28/L46 - controlled-open prop names, target collection + revalidatePath.
- teacher-directory L96 - teacher fetch limit / pagination.

### Pages / design (`src/app/**`, `globals.css`)
- impact-dashboard L64 - per-dimension impact-score weights + normalization (`src/lib/analytics/impact-score.ts`).
- notifications L47/L53 - fetch limit/sort, action names, type-to-icon mapping.
- visual-aid-designer L61 - current per-image cost (post gemini-3-pro-image-preview switch).
- DESIGN-SYSTEM L18/L47/L153 - `--primary` HSL, font families, residual `@media print` rules.

### App-side fix (not a doc issue)
- `reproduction-notes/pages/admin-cost-dashboard.md` L63 - the in-app "Gemini
  Spend" card still reads "Gemini 2.0 Flash APIs". Ground-truth default is
  `gemini-2.5-flash`. This is a stale UI string in `src/app/`, flagged for an
  app-side fix; the doc correctly records it.

---

## UI scan linkage (recurring across manuals)
Several user manuals flag the same open question: the exact scan-to-class
linkage and where assessment-scan results display/store in the UI
(`USER_MANUAL.md` L199, `USER_MANUAL_UNIFIED.md` L222, `USER_MANUAL_BENGALI.md`
L200, `USER_TESTING_PROMPTS.md` L110). Resolve once against the
assessment-scanner page + its action, then propagate to all four.
