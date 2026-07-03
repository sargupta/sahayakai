# SahayakAI — DPDP Data-Processing Register

**Status:** DRAFT — retention defaults marked `FOUNDER-RATIFY` require sign-off before this is shown to any org/government buyer.
**Scope:** the production web app (`sahayakai-main`, Cloud Run service `sahayakai-hotfix-resilience`, GCP project `sahayakai-b4248`) and its Firebase/GCP data stores.
**Legal frame:** Digital Personal Data Protection Act, 2023 (India). SahayakAI (SARGVISION) is the **Data Fiduciary** for teacher accounts, and processes children's records **on behalf of the teacher/school** (no child ever holds an account).
**Grounding:** every claim below was verified against the codebase on 2026-07-03. Where the code has a gap, the gap is stated — this register documents reality, not aspiration.

---

## 1. What personal data we hold

| # | Data class | Data principal | Fields (as stored) | Where it lives | Why (lawful purpose) |
|---|---|---|---|---|---|
| 1 | Teacher profile | Teacher (account holder) | `displayName`, `email`, `photoURL`, `schoolName`, `district`, `pincode`, `bio`, plan/billing state (`users/{uid}`) | Firestore `users` | Provide the service the teacher signed up for (contract); account security |
| 2 | Children's roster + attendance | Child (entered by teacher) | Student `name`, `rollNumber`, `parentPhone`, `parentLanguage` (`classes/{classId}/students`); daily attendance records | Firestore `classes`, `students` subcollections | Attendance tracking and parent outreach that the teacher initiates as part of their duties |
| 3 | Children's assessed work ("marks") | Child | Uploaded answer-sheet page images (up to 3 pages/request) + AI-graded results (`/api/ai/assessment-scanner`) | Cloud Storage (uploads) + Firestore (results, teacher-scoped content) | AI-assisted grading requested by the teacher |
| 4 | Parents' phone numbers | Parent | `parentPhone` on student records; `parent_outreach` call/message logs | Firestore `students`, `parent_outreach` | Attendance-triggered parent calls/messages (Twilio/Exotel), in the child's educational interest |
| 5 | Voice recordings — teacher voice messages | Teacher | Audio files at `voice-messages/{uid}/…` (`src/lib/media-upload-manager.ts:81`) | Cloud Storage | Teacher-to-teacher voice DMs (core messaging feature) |
| 6 | Voice/call data — AI parent calls | Parent (+ child, referenced) | Call session turns + transcripts (`agent_sessions/{callSid}/turns`, `agent_voice_sessions/{callSid}` — the latter is a Phase-2 placeholder per `firestore.rules:358`) | Firestore; telephony leg via Twilio/Exotel | Automated attendance/progress calls to parents |
| 7 | Messages | Teacher | DMs (`conversations/{convId}/messages`), group chat (`groups/{gid}/chat`), community chat (`community_chat`) | Firestore | Teacher collaboration features |
| 8 | Telemetry / product analytics | Teacher | `teacher_analytics/{uid}`, `vidya_sessions`, `usage`/`usageCounters`, GA4 events (client-side) | Firestore + Google Analytics | Product improvement; impact scoring. Gated by versioned consent (`src/lib/analytics-consent.ts`, `analytics_consent/{uid}`, consent version `1.0`) |
| 9 | Billing | Teacher | Razorpay subscription id on `users/{uid}`, `webhook_events`, `credit_ledger`, `subscriptions` | Firestore + Razorpay's systems | Payment processing; statutory financial records |

Notes:
- **AI inference:** prompts (which may embed child names/marks the teacher typed or uploaded) transit Google Gemini and Sarvam. Per the terms copy (`src/app/(marketing)/terms/terms-client.tsx:121`) only minimal prompt data is processed and not retained on those systems beyond the request lifecycle.
- **No child users, no advertising:** there is no login path for children, no ad SDK, and no behavioural profiling of children anywhere in the codebase — relevant to DPDP §9 (see §7 below).

## 2. Storage location (verified, per-component)

Source of truth: `docs/MUMBAI_REGION_MIGRATION_RUNBOOK.md` (the data-residency migration plan; live `gcloud` inventory of 2026-06-09). The instruction to reference `docs/DATA_RESIDENCY_MIGRATION_PLAN.md` resolves to this file — no doc by that exact name exists in the repo.

| Component | Holds | Actual region | DPDP posture |
|---|---|---|---|
| Firestore `(default)` | ALL PII in §1 rows 1–4, 6–9 | **asia-south1 (Mumbai, India)** | In India ✅ |
| Cloud Storage `sahayakai-b4248.firebasestorage.app` | Voice messages, uploaded answer sheets, images | **us-central1 (USA)** | **Outside India — the open residency gap**; migration to Mumbai is §5 of the runbook |
| Realtime Database | Presence/typing indicators only (ephemeral, non-PII) | asia-southeast1 (Singapore) | Non-PII |
| Cloud Run (compute) | Stateless processing | asia-southeast1 (Singapore) | Processing locality only |

⚠️ The public terms page currently tells users data is stored in **Singapore (asia-southeast1)** — the runbook §8 already flags this consent copy as inaccurate in both directions (Firestore is in India; Storage is in the USA). The copy fix ships with the residency migration.

## 3. Retention policy per data class

Legend: **[LIVE]** = enforced by running code today. **[FOUNDER-RATIFY]** = proposed default, no enforcement mechanism yet — needs founder sign-off, then a cleanup job.

| Data class | Retention | Status | Enforcement |
|---|---|---|---|
| Community chat | **90 days** | **[LIVE]** | `POST /api/jobs/community-chat-cleanup` — daily Cloud Scheduler (02:00), deletes `community_chat` docs with `createdAt` older than 90 days, 500/batch (`src/app/api/jobs/community-chat-cleanup/route.ts`, `RETENTION_DAYS = 90`) |
| Soft-deleted content's storage files | Deleted on soft-delete event | **[LIVE]** | `POST /api/jobs/storage-cleanup` — Pub/Sub-driven GCS deletion with strict path allowlist (`temp/`, `exports/`, and uid-scoped `lessons/`, `images/`, `voice-messages/`, `content-images/`, `visual-aids/`, `avatars/`) (`src/app/api/jobs/storage-cleanup/route.ts`) |
| Account data after deletion request | 30-day export grace, then profile anonymised | **[LIVE]** (with gaps — §4) | `POST /api/jobs/export-reminder` — daily; reminders at day 1/7/21/28; after `gracePeriodEnd` sets `displayName: 'Former Teacher'`, scrubs `email`, `photoURL`, `schoolName`, `district`, `pincode`, `bio` (`src/app/api/jobs/export-reminder/route.ts`) |
| Children's attendance + roster | **3 school years** after the academic year ends | **[FOUNDER-RATIFY]** | None yet — no cleanup job exists. Rationale: covers board-exam re-checks and TC issuance windows |
| Parent-call recordings/transcripts | **90 days** | **[FOUNDER-RATIFY]** | None yet. Also verify what Twilio/Exotel retain on their side and configure their retention to match |
| Teacher messages (DMs, group chat) | **Until account deletion** | **[FOUNDER-RATIFY]** | Conversations are multi-party; deletion is tied to the erasure flow, not a clock |
| Telemetry / analytics | **14 months** | **[FOUNDER-RATIFY]** | **No retention job exists.** `scheduleDataDeletion()` in `src/lib/analytics-consent.ts:82` is an empty TODO, while the consent copy tells users data is kept for 1 year (`data_retention_acknowledged`). 14 months aligns with the GA4 default. Until the job ships, the consent promise is unenforced — this is a compliance gap, not a footnote |
| Billing / payment records | **8 years** | **[FOUNDER-RATIFY]** | Statutory financial-record retention (Companies Act/GST); exempt from erasure |
| Server logs (Cloud Logging) | GCP default (30 days) | **[LIVE by default]** | GCP `_Default` bucket retention; no custom sink configured in-repo |

> Correction to the tranche brief: the brief assumed an `analytics-retention` cron job exists. It does not — `src/app/api/jobs/` contains `ai-community-agent`, `ai-reactive-reply`, `billing-reconciliation`, `community-chat-cleanup`, `daily-briefing`, `edu-news`, `export-reminder`, `grow-persona-pool`, `storage-cleanup`. Analytics retention must be built.

## 4. Deletion story (right to erasure — DPDP §12(3))

Implemented at `POST /api/user/delete-account` (`src/app/api/user/delete-account/route.ts` — the file itself cites DPDP §12(3)):

1. **Fresh re-auth gate.** Requires `{ confirm: true }` plus a freshly minted Firebase ID token, verified server-side with `verifyIdToken(idToken, true)` (revocation-checked), uid-matched to the session, `auth_time` within **5 minutes**. Blocks stolen-session/XSS-driven deletions.
2. **Razorpay subscription cancelled** immediately (best-effort).
3. **30-day grace period** starts; user is told to export via `/api/export` (DPDP data-portability route; ZIP inline for small exports, job + polling for large).
4. **Deleted immediately, synchronously:** all `connections` (paged, no 200-cap), `users/{uid}/content/*` (paged), `teacher_analytics/{uid}`, `vidya_sessions` owned by the user (paged), `usage/{uid}`, org membership.
5. **Firebase Auth account deleted immediately** — login is impossible from this point.
6. **After the grace period** the daily `export-reminder` job anonymises the profile (see §3), idempotently.

**Known gaps (documented in the handler's own TODO, lines 244–250):**
- Community posts / `community_chat` messages authored by the user and **Cloud Storage files** (`voice-messages/{uid}/*`, uploads) are **not purged** — deliberately left pending a uid-scoped query that cannot over-delete other users' threads. Community chat ages out via the 90-day job regardless; storage purge is unowned. **FOUNDER-RATIFY:** accept "anonymised author on shared content" as the erasure posture for community content (standard practice), and schedule the storage purge into the grace-period job.
- **Mobile re-auth caveat:** on mobile browsers the popup re-auth is unreliable, so the client uses `reauthenticateWithRedirect` and completes deletion on redirect-return (`src/app/settings/page.tsx:350–420`). This path is **untested end-to-end** — it sits in the founder-only queue of `docs/EXECUTION_PLAN_2026-07.md` ("Test mobile account deletion (redirect re-auth flow)").

## 5. Children's-data handling

- Children are **data principals but never users**: no child accounts, no child logins. Teachers enter roster/attendance/marks data in their professional capacity; SahayakAI processes it to render the service the teacher/school requested.
- DPDP §9 obligations for children's data: **(a)** verifiable parental/guardian consent, **(b)** no detrimental processing, **(c)** no tracking, behavioural monitoring, or targeted advertising directed at children. SahayakAI satisfies (c) structurally — no ads, no child-directed profiling. For (a), the consent relationship runs school→parent (schools already collect parental consent for administrative processing); **our org/school contracts must state that the school warrants it holds this consent** — add a clause to the org onboarding terms (see `src/lib/services/export-contract-clauses.ts` for the existing contract-clause machinery). **FOUNDER-RATIFY.**
- Parent phone numbers are used solely for teacher-initiated attendance/progress outreach — never marketing.

## 6. Breach-response outline

1. **Detect & contain** — Sentry alerts + Cloud Run logs (`docs/MONITORING.md`, `docs/ALERTS.md`); revoke exposed credentials (rotation runbook in the founder queue), disable affected endpoints via feature flags/kill switch (`docs/FEATURE_FLAGS.md`).
2. **Assess** — which data classes (§1), how many principals, children's data involved? Record timeline in `docs/INCIDENTS.md` (existing incident log).
3. **Notify** — DPDP requires notifying **the Data Protection Board of India AND each affected Data Principal** on any personal-data breach (no materiality threshold in the Act). Draft notice within 72h of confirmation (Board form/rules pending; follow the DPDP Rules as notified). For children's data, notify via the school/teacher channel.
4. **Remediate & post-mortem** — root cause in `docs/INCIDENTS.md`; regression test; update this register.
5. **Owner:** founder (interim DPO function) until a grievance/DPO contact is designated (§7).

## 7. DPDP Act 2023 obligations mapping

| Obligation (section) | What the Act requires | SahayakAI today | Gap / action |
|---|---|---|---|
| Consent (§6) | Free, specific, informed, unambiguous consent; as easy to withdraw as to give | Terms consent at signup incl. cross-border clause; granular **versioned analytics consent** with revoke (`src/lib/analytics-consent.ts`, version `1.0`) | Consent copy region error (§2); no consent-manager UI for non-analytics purposes |
| Notice (§5) | Itemised notice of data + purpose, in English or any 8th-Schedule language | Terms/privacy pages in the app's 11 Indic languages | Verify notice enumerates §1 data classes explicitly |
| Access (§11) | Summary of data + processing activities | `/api/export` full data export | Adequate |
| Correction & erasure (§12) | Correct, complete, update, erase | Profile/roster editable in-app; erasure flow per §4 | Close the storage-purge + analytics-retention gaps |
| Grievance redressal (§13) | Readily available grievance mechanism, respond within prescribed time | Feedback channel (`feedbacks` collection) | Publish a named grievance officer + SLA on the site — **FOUNDER-EXECUTE** |
| Nominate (§14) | Data principal may nominate | Not implemented | Low priority for a teacher tool; document position |
| Data-fiduciary duties (§8) | Accuracy, security safeguards, breach notification, retention limits | Security hardening tranches; §3 retention; §6 breach outline | Ship the two missing retention jobs |
| Children's data (§9) | Parental consent; no tracking/ads aimed at children | §5 posture | School-warrants-consent clause — **FOUNDER-RATIFY** |
| Significant Data Fiduciary (§10) | If notified as SDF: DPO in India, independent audit, DPIA | Not designated. Volume of children's records could make education platforms SDF candidates once thresholds are notified | Monitor DPDP Rules; keep this register audit-ready |
| Cross-border transfer (§16) | Transfers allowed except to blacklisted countries (negative-list model) | Firestore in India; **Cloud Storage in the USA**; AI inference via Google/Sarvam | USA is not blacklisted, so this is lawful today — but the Mumbai migration (runbook) both fixes the terms-copy mismatch and future-proofs against rule changes |
| Data Protection Board (§27–28) | Cooperate with inquiries, breach reporting | §6 process | — |

## 8. Register maintenance

- Update this file whenever a new collection, storage prefix, or third-party processor is added (PR checklist item).
- Third-party processors as of 2026-07-03: Google Cloud/Firebase (infra), Google Gemini + Sarvam (AI inference), Twilio + Exotel (telephony), Razorpay (payments), Sentry (error telemetry), Google Analytics (product analytics), Cloudflare (CDN/insights).
