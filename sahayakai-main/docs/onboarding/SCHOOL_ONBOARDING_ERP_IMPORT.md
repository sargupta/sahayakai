# School onboarding — connecting an existing ERP

Companion to `school-onboarding-erp-import.html` (the visual journey).
Written 2026-11-13 against `riya-wt/sahayakai-main` at `develop` `92837486` plus
the worktree's uncommitted changes. **Nothing in this document was changed in
code — this is an inspection and a plan.**

---

## 1. The headline

The hard half of this feature already exists, and it was not built for
onboarding — it was built for Sampark. There is a complete, security-reviewed
CRM import pipeline in the repo: a published wire contract, Zod validation with
per-row quarantine, SSRF-hardened outbound fetch, encrypted phone storage,
Secret-Manager key handling and an admin-gated API route.

The missing half is everything the school *sees*: there is **no school
onboarding route at all**. `src/app/onboarding/page.tsx` (1,179 lines) is an
individual **teacher's** profile setup — name, board, state, subjects, grades,
language, then an "aha moment" lesson plan. A school as a tenant is provisioned
by hand:

> `POST /api/organizations` — *"SECURITY: ADMIN-ONLY (F7-001) … Sales-touched
> orgs are provisioned here by SahayakAI admins."*

So the work is: build the school-facing journey on top of the import engine
that is already there, and extend that engine from two entities to seven.

---

## 2. What is already shipped

| Capability | Where | Notes |
|---|---|---|
| Tenancy | `src/types/sampark.ts` | A school **is** an `organizations/{orgId}`. Sampark records live under `sampark_schools/{orgId}/…`, prefixed so they can never collide with `classes/{id}/students`. Tenant isolation is the shape of the data, not a filter. |
| Import API | `POST /api/sampark/[orgId]/imports` | `{source:'rest'}` or `{source:'csv', studentsCsv, guardiansCsv}` (≤5 MB each). Auth `x-user-id` + `requireOrgAdmin`. 404 unless `SAMPARK_ENABLED==='true'`. |
| Latest run | `GET /api/sampark/[orgId]/imports/latest` | |
| Wire contract | `src/lib/sampark/crm/schema.ts` | CRM contract **v1**: `GET /v1/school`, `/v1/students`, `/v1/guardians` with `updatedSince`/`cursor`/`limit`, `/v1/export/*.csv`, `Authorization: Bearer <key>`. Tombstones via `deleted:true`. |
| CSV format | `CSV_COLUMNS` in the same file | RFC 4180, UTF-8, dotted nesting, `\|`-joined lists. Same Zod schema validates CSV and REST. |
| REST source | `src/lib/sampark/crm/rest-source.ts` | 200/page, max 1,000 pages, 15 s timeout. |
| CSV source | `src/lib/sampark/crm/csv-source.ts` | |
| Normalisation | `src/lib/sampark/crm/import.ts` (460 lines) | Phone → AES-GCM `phoneEnc` + peppered `phoneHash` + `phoneLast4` + `phoneClass`. Guardians-of-record only. Primary-guardian ordering. Tombstones. Holiday union. Consent bootstrap. |
| Quarantine | `ImportRejectedRow` | `{entity, crmId, row, reason}` — first Zod issue as the reason, up to 500 stored, count always exact. One bad row never blocks the school. |
| Result | `ImportRun` | `counts:{students,guardians,rejected,tombstoned}`, `status`, `error`, `startedBy`, timings. |
| Admin UI | `src/components/sampark/settings-crm.tsx` | URL + secret-name fields, CSV upload, last-run summary, rejected-rows table. |
| Mock CRM | `riya-wt/mock-school-crm` | A dummy CRM serving contract v1 — dev and demo without a real provider. |

### Security properties already in place

These are the ones the brief asks for, and they are real, not aspirational:

- **SSRF guard, two stages.** `checkCrmUrlSyntax` (https only; `http://localhost`
  and `127.0.0.1` outside production only; no userinfo) then `assertCrmUrlSafe`
  after DNS — *every* resolved address must be public. Private ranges, link-local,
  metadata `169.254/16`, CGNAT, unique-local, multicast all refused; loopback
  refused in production. `redirect:'error'` so an allowed host cannot bounce the
  request inward.
  *Known, documented limit:* fetch re-resolves after the check — a DNS-rebinding
  window that needs a pinned-IP agent. Already tracked in the file's header for
  "the phase that talks to real school CRMs" — i.e. **this** phase.
- **Credentials.** `CrmConnectionConfig` stores `apiKeySecretName`, never a key.
  `getSecret()` reads env in dev, Secret Manager in prod. The UI allow-lists the
  `SAMPARK_CRM_` prefix.
- **PII.** A guardian's full number exists in exactly one place, encrypted.
  Everything else — calls, intents, suppressions, API responses, logs — carries
  hash and last-4 only.
- **Consent is never trampled.** The preferences registry is bootstrapped from
  CRM consent only where no entry exists; existing entries refresh only where the
  current source is `'crm'`. An office, parent-form or keypad decision is never
  overwritten by an import.
- **School data is never destroyed.** `manualHolidays` survive every import.
  Absence-implies-left is applied per file and only when that file can be trusted
  as a whole list (≥1 valid record, no quarantined row lacking an id).

---

## 3. What has to be built

Ordered by dependency. Sizes are rough engineering estimates.

### 3.1 School onboarding routes — **the gap that blocks everything** (L)

New: `src/app/onboarding/school/{source,provider,connect,callback,review,confirm,import,done}`.
Needs a server-side **onboarding run** document (org-scoped, resumable, with a
`step` and a stashed provider selection) so a browser crash or an external
redirect does not lose the school's place.

Also needs a decision the brief implies but does not state: **can a school
self-register?** Today it cannot — `POST /api/organizations` is admin-only by
design (F7-001: self-service would let a free user mint themselves 500 premium
seats). Either onboarding starts *after* sales provisions the org (smallest
change, recommended) or a separate unprivileged "claim your school" path is
built with its own anti-abuse story. **This needs an answer before step 3.3.**

### 3.2 Provider registry (M)

No concept of a provider exists. Needs, per provider: id, display name, vendor,
capability (`oauth` | `api_key` | `export_only`), export instructions, column
mapping to the v1 contract, and a logo. Drives the picker, the connect screen and
the mapping step. Static config to start; no reason for a database yet.

### 3.3 OAuth — **does not exist anywhere in the repo** (L)

Not a single OAuth client, `state` parameter, callback route or token store for
an external provider. All of this is new:

- client registration and secret storage per provider (Secret Manager);
- authorize URL construction with a signed, single-use `state` bound to
  `{orgId, uid, runId, nonce, exp}` — 15-minute TTL, stored server-side, deleted
  on use, so a replayed callback cannot start a second import;
- `GET /api/onboarding/school/callback` handling `success | denied | expired |
  state_mismatch | already_connected`;
- an **idempotency key** on the onboarding run so a repeated callback resumes
  rather than duplicating — the brief calls this out explicitly and it is the
  single highest-risk piece;
- token exchange, encrypted refresh-token storage, refresh-on-expiry.

**This cannot be built against any provider today.** See §4 — only Fedena has a
usable public mechanism and it is a token, not OAuth. Build the generic machinery
against the mock CRM; wire a real provider when one grants access.

### 3.4 Extend the import contract to seven entities (L)

v1 imports **students and guardians only**. The checklist in the brief needs:

| Category | Today | Work |
|---|---|---|
| School profile | `CrmSchoolSchema` exists and is imported | none |
| Academic years | not in contract | new schema + normaliser; decide whether history or current year only |
| Classes & sections | derived from `student.grade` + `student.section` | needs to be a first-class entity — `grade` is `int 1..12` and `section` is `/^[A-Z]$/`, so **Nursery, LKG, UKG and section "A1" cannot be represented at all**. Contract change. |
| Students | shipped | none |
| Teachers & staff | **not in contract at all** | new `CrmStaffSchema`, normaliser, repo writes, and a join to the existing `organizations` member model |
| Parents/guardians | shipped | none |
| Parent contacts | shipped (encrypted) | none |
| Attendance | mentioned in the contract header as "part of the CRM contract too, but slice 1 does not import them" | new schema + volume strategy — this is the only unbounded entity |

### 3.5 Dry run / preview (M)

The checklist screen cannot be built without this: there is currently **no way to
ask "what would happen"** — the only path is to import. Needs
`POST /api/sampark/[orgId]/imports/preview` running ingest + normalise + validate
and returning per-category counts (found / importable / incomplete / duplicate /
error / unsupported-fields) **without any repo writes**. `runImport` is already
cleanly layered over a `SamparkRepo` port, so a no-op repo is a plausible seam.

### 3.6 Duplicate detection (M)

Today identity is the provider's `id`, full stop. The brief wants duplicates
surfaced. Needs fuzzy matching on `admissionNo`, on `phoneHash` (which already
exists and is the right key — never compare plaintext), and on name+grade+section,
plus a merge decision carried into the import. Note the existing deliberate rule:
guardian links follow `isGuardianOfRecord`, **never a shared phone number** — two
children on one number is normal and is not a duplicate.

### 3.7 Mapping correction UI (M)

`ImportRejectedRow.reason` is a raw Zod issue string. Needs a reason taxonomy
(`missing_required` / `bad_format` / `unmappable_value` / `duplicate` /
`unsupported`), a suggested fix per code, and an override set persisted on the
onboarding run and applied by the importer on the confirmed run.

### 3.8 Make the import a resumable job (M)

`startImport` runs synchronously inside one HTTP request. A 5,000-student school
over REST is 1 + ⌈n/200⌉ requests per entity at 15 s each — comfortably past any
serverless request budget. Needs a job (the repo already has
`src/app/api/jobs/sampark-dispatch/route.ts` as a pattern), checkpointing per
entity, and resume-without-duplicating. Required by the partial-failure recovery
the brief asks for.

### 3.9 Audit log (S)

`ImportRun` is a result record, not an audit record. Needs who/when/from where,
provider and scopes authorised, the admin's explicit confirmation with the exact
counts shown at the time, and the override decisions — retained independently of
the run document.

### 3.10 Downstream availability (S–M)

Sampark reads `sampark_schools/{orgId}/…` and gets imported students and
guardians for free. Teachers/staff and classes must land in the **existing**
`organizations` member model and `classes/{id}/students`, not only in the
`sampark_` namespace, or the rest of the product will not see them. Worth
confirming before 3.4 is designed.

---

## 4. Provider reality

Verified 2026-11-13 from each vendor's own public pages. "No public API" means no
public developer documentation could be found — it does not prove none exists
behind a partner agreement.

| Provider | Public API | Verdict |
|---|---|---|
| **Fedena** (Foradian) | **Yes.** Public playground at `apis.fedena.com`; per-instance URL + generated token; sandbox at `fedena.com/demo`; technical docs and support articles. | The only provider that can be integrated **without** a partnership. Token auth, not OAuth. Note the support documentation is dated (2015) — mature, but confirm the current surface before committing. **Recommended first real integration.** |
| **Entab CampusCare** | **No.** The only public page mentioning APIs (`entab.in/guidelines.html`) is an app-store privacy guideline, not developer documentation. | Export-led. The shipped importer already anticipates this — `import.ts` names Entab explicitly as the reason absence-implies-left exists ("Entab exports carry no deletion markers"). |
| **Teno** | **No.** Real product — 7,000+ schools, 450 cities per the vendor's own LinkedIn. | Export-led. **Risk:** `tenoapp.com` now serves unrelated gambling/affiliate content. Either the domain lapsed or the product changed hands. **Do not link or integrate until the vendor confirms the live product.** |
| **CampusPro** | **No, for any of them.** | **The name is ambiguous — three unrelated products:** CampusPro Technologies Pvt Ltd / EnableSoft Solutions (Gurgaon, `campuspro.in`, `app.campuspro.in`); `gocampuspro.com`; and Viyona Fintech's CampusPro. The brief says to investigate rather than guess — the honest answer is that "CampusPro" does not identify a product. **Ask the school which one, or ask the person who named it.** |
| **Teachmint** | **Not for school data.** `docs.teachmint.com` documents *Teachstack* — in-house video-conferencing APIs. Nothing for rosters. | Export-led, or a partner agreement. |
| **Anything else** | n/a | Two CSVs in the published column format. **Works today.** |
| **Sahayak AI CRM contract v1** | Ours | Any ERP that implements it gets direct sync. Mock CRM available. **Shipped.** |

### What this means for sequencing

1. Build the whole journey against the **mock CRM** and the **CSV path** — both
   work today and need no one's permission.
2. Make **Fedena** the first real connector: public API, sandbox, no partnership.
3. Treat Entab, Teno, Teachmint and CampusPro as **guided export** in the UI, and
   say so on the card. The brief is explicit: do not claim an integration is
   operational without verifying it.
4. Open partner conversations for Entab (largest install base of the four) in
   parallel. **Resolve what "CampusPro" refers to, and what happened to Teno,
   before either appears in a shipped picker.**

---

## 5. Open questions

1. **Self-registration.** Does a school admin reach onboarding before or after
   sales provisions the org? Blocks §3.1 and §3.3. Recommendation: after —
   it keeps F7-001 intact and is far less work.
2. **Pre-primary.** `grade` is `int 1..12`. Nursery/LKG/UKG schools cannot be
   represented. Contract change, or an explicit out-of-scope?
3. **Sections.** `/^[A-Z]$/` rejects "A1", "Alpha", "Rose". Many Indian schools
   use these.
4. **Attendance volume.** Import history, or start from the import date?
5. **Teacher invitations.** Importing 39 staff records creates 39 people who
   cannot sign in. The invite flow is a prerequisite for the imported staff to
   mean anything.
6. **Who owns the provider relationship** — does Sahayak AI hold one OAuth client
   per provider, or does each school register its own?

---

## 6. Suggested order

| | Work | Depends on |
|---|---|---|
| 1 | School onboarding routes + resumable run document (§3.1) | Q1 answered |
| 2 | Dry-run/preview endpoint (§3.5) | — |
| 3 | Checklist, mapping and confirmation UI (§3.7) | 2 |
| 4 | Provider registry + CSV/export wizard (§3.2) | 1 |
| 5 | Extend contract: classes, academic years, staff (§3.4) | Q2, Q3, §3.10 |
| 6 | Resumable import job + partial-failure recovery (§3.8) | 1 |
| 7 | Duplicate detection + merge (§3.6) | 2 |
| 8 | Audit log (§3.9) | 1 |
| 9 | OAuth machinery against the mock CRM (§3.3) | 4 |
| 10 | Fedena connector (first real provider) | 9 |
| 11 | Partner integrations | provider access |

Steps 1–8 deliver the complete journey for **CSV and export-led providers —
which is every provider on the list except Fedena** — and need nothing from
anyone outside the team.
