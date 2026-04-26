# DPDP Compliance Plan — Parent-Call Sidecar

## Scope

India's Digital Personal Data Protection Act 2023 (enforced from
**November 2026**) governs all personal-data processing for Indian
residents. The parent-call sidecar handles PII at the highest tier:

- Parent phone numbers (s.2(t) — personal data)
- Child names (s.9 — minors, heightened protection)
- Spoken transcripts (audio + text)
- Performance scores (academic data)

This plan documents what's been built, what's outstanding, and the
escalation path before Phase 1 ships to production traffic in India.

## Current state (Phase 1)

### ✅ In place

- **Storage limitation (s.8(8))**: TTL on
  - `agent_sessions/{callSid}.expireAt` = 24h
  - `agent_shadow_diffs/{date}/shadow_calls/{id}.expireAt` = 14d
- **Right-to-erasure (s.12)**: `scripts/erase-parent-data.py` deletes
  all session + shadow-diff + voice-session entries for a callSid in
  one command. Operator runs it on receipt of a DPDP s.12 request.
- **Data minimization (s.8(7))**: bounded fields on every schema,
  no transcripts logged to Cloud Logging beyond a 200-char excerpt
  on parse-failure 502s.
- **Notice (s.5)** *infrastructure*: `consentPrologue` field in
  `CallPrompts` interface; `consentNoticeEnabled` feature flag.
  Translations + flag flip pending (see Outstanding below).

### ⚠ Outstanding

| Item | Severity | Owner | Window |
|---|---|---|---|
| 11-language translations of `consentPrologue` | P0 | translator + legal review | before any production ramp |
| Cross-border transfer (`asia-southeast1` Singapore) | P0 | infra | move to `asia-south1` Mumbai before production |
| Data Processing Agreement (DPA) with Google for Gemini API | P0 | legal | before production |
| Children's data heightened protection (s.9 verifiable parental consent) | P0 | product | school-level consent collected at outreach creation, NOT call time |
| Breach notification (s.8(6) — 72h) | P1 | infra | Cloud Monitoring alert wired to PagerDuty + DPDP officer |
| Significant Data Fiduciary registration (s.10) | P1 | legal | once school count exceeds threshold |
| Data Protection Officer appointment (s.10(c)) | P2 | exec | once SDF designation triggers |

## Region migration: `asia-southeast1` → `asia-south1`

DPDP s.16 restricts cross-border transfer of personal data unless:
- Parent gives explicit consent for transfer outside India, OR
- Government issues a notification listing the destination country
  as "trusted"

Singapore is NOT (as of 2026-04) on India's notified-trusted list.
The current `asia-southeast1` deployment puts every transcript byte
outside India's territorial jurisdiction.

### Migration scope

| Service | Current region | Target region |
|---|---|---|
| Cloud Run sidecar (`sahayakai-agents`) | `asia-southeast1` | `asia-south1` (Mumbai) |
| Cloud Run Next.js (`sahayakai-hotfix-resilience`) | `asia-southeast1` | `asia-south1` |
| Firestore default database | `asia-southeast1` (or `nam5`) | `asia-south1` |
| Vertex AI Vector Search (Phase 4) | TBD | `asia-south1` |
| Gemini API endpoint | global | regional Vertex endpoint in `asia-south1` |
| Document AI (Phase 4 ingest) | global | `asia-south1` |
| Cloud Logging | `asia-southeast1` | `asia-south1` |
| Cloud Monitoring | `asia-southeast1` | `asia-south1` |

### Migration steps (separate plan branch)

1. **Audit current data residency**: list every collection / bucket /
   metric. Confirm what's in `asia-southeast1` vs implicit-multi-region.
2. **Create `asia-south1` Firestore database** (separate from default
   if default is multi-region; otherwise migrate via Cloud Firestore
   import/export).
3. **Re-deploy sidecar in `asia-south1`** via the existing
   `cloudbuild.yaml` with region override. Update
   `SAHAYAKAI_AGENTS_AUDIENCE` post-deploy.
4. **Re-deploy Next.js in `asia-south1`** via cloud-run.yml + apphosting.yaml.
5. **Switch Gemini calls** to a regional Vertex endpoint (`asia-south1-aiplatform.googleapis.com`).
6. **Verify** every read/write hits `asia-south1` via Cloud Audit Logs.
7. **Decommission** `asia-southeast1` resources.

Estimated downtime: 0 (parallel deploy, flag-flip cutover). Estimated
cost: one-time ~$200 in cross-region egress during the migration
window; ongoing cost is identical (same SKUs, just different region).

### Pre-migration gates

- [ ] Legal sign-off on the cross-border transfer DPA with Google
- [ ] Legal sign-off on Mumbai region as the canonical residency
- [ ] All 11 `consentPrologue` translations reviewed by counsel
- [ ] Erasure runbook reviewed by counsel — current
  `scripts/erase-parent-data.py` may need workflow expansion
  (response timing, audit trail, verifiable identity check)
- [ ] Children's-data flow audited: at school onboarding, parents
  sign verifiable consent for processing minors' data; sidecar
  inherits this consent context

## Children's data (DPDP s.9)

Students in our fixtures + production are minors (Class 5 in fixtures,
Classes 1-12 in real schools). DPDP s.9 requires:

- **Verifiable parental consent** at the point of data collection.
- **No tracking, behavioural monitoring, or targeted ads** on data
  derived from minors.
- **Heightened security** standards.

Current state: parent-call traffic is initiated BY THE SCHOOL, with
the parent's prior implicit consent (the parent shared their phone
with the school). DPDP arguably treats this as "performance of contract"
under s.7(c) — but a defensible interpretation requires:

1. School onboarding flow records explicit parental consent for
   AI-call processing of minors' performance data.
2. The consent record is queryable from the call-time TwiML route.
3. Any call to a parent without an active consent record is REFUSED
   at the dispatch layer.

**This is not built yet**. Tracked as a P0 follow-up before any
production ramp.

## Breach notification (s.8(6))

72-hour notification to the Data Protection Board on any personal-data
breach. Required infrastructure:

- Cloud Logging filter for events that constitute a breach:
  - Unauthenticated access to `agent_sessions/**` (caught by Firestore
    rules, but the rule denial itself should be tracked as an event)
  - Sidecar 5xx with sensitive payload in error body (caught by
    behavioural guard 502)
  - Unauthorized SA action on `agent_shadow_diffs/**`
- Cloud Monitoring alert policy that routes to:
  - PagerDuty (operator response)
  - DPDP officer email (legal response)
- Documented response runbook with the 72h timeline.

Tracked as P1; not blocking Phase 1 shadow ramp but blocking production.

## Tracked tickets

The following items in this plan map to follow-up tickets:

- `DPDP-T1` — 11-language consent translations
- `DPDP-T2` — Region migration to `asia-south1`
- `DPDP-T3` — Google DPA execution
- `DPDP-T4` — Children's-data verifiable consent flow
- `DPDP-T5` — Breach-detection alert policies
- `DPDP-T6` — SDF registration (post-scale)

## Decision log

- 2026-04-26: scaffold the consent prologue + erasure helper +
  region migration plan ahead of Phase 1 production ramp
  (not before shadow ramp, since shadow uses the same data flow).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
