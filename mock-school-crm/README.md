# mock-school-crm

A standalone dummy of a school's external CRM/ERP: the kind of system an Indian CBSE school runs, which SahayakAI imports from. It holds one synthetic school, **Hillview Demo School, Siliguri**, and serves it over the school-CRM wire contract v1 (REST pull, CSV export, signed webhook hints, write-back endpoints), plus a demo page for the school office.

It knows nothing about SahayakAI. The only thing the two share is the contract, `sahayakai-main/src/lib/sampark/crm/schema.ts`, which this package carries as a verbatim copy in `src/contract/crm-schema.ts`; a test fails if the copy drifts by a single byte. So the day a real school connects its real CRM, nothing in the app changes except configuration.

Everything here is synthetic. Phone numbers are `+915` followed by 9 digits, a range that is not an Indian mobile series and cannot ring a real phone, and every guardian carries `synthetic: true`.

## Run

Node 20.6 or later.

```bash
cd mock-school-crm
npm ci
npm start                 # http://127.0.0.1:4700 ; seeds data/state.json on first run
npm test                  # node:test via tsx
npm run typecheck
npm run seed              # regenerate data/state.json (discards demo-page edits and written-back calls)
npm run seed -- --anchor=2026-10-12   # re-anchor "today" for attendance streaks and recency
npm run export-fixtures   # write test fixtures into sahayakai-main/src/__tests__/fixtures/sampark/
```

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4700` | listen port |
| `HOST` | `127.0.0.1` | bind address; the demo page is unauthenticated, so keep it on localhost unless it runs in a container |
| `MOCK_CRM_API_KEY` | `mock-crm-dev-key` | bearer key for `/v1/**` |
| `MOCK_CRM_STATE_PATH` | `data/state.json` | persisted state (gitignored); created from the seed if missing |
| `SAHAYAKAI_WEBHOOK_URL` | unset | where demo-page changes are hinted |
| `SAHAYAKAI_WEBHOOK_SECRET` | unset | HMAC key for `X-CRM-Signature`; hints are sent only when both are set |

State lives in memory and is written back to the state file after every mutation, atomically (a temp file in the same directory, then a rename), so a crash never leaves a half-written file.

## API

Every `/v1/**` route needs `Authorization: Bearer <MOCK_CRM_API_KEY>`; anything else is `401`. `GET /` (the demo page) and `GET /healthz` are open. Errors are JSON: `{ "error": "..." }`.

```bash
KEY='Authorization: Bearer mock-crm-dev-key'
curl -H "$KEY" localhost:4700/v1/school
curl -H "$KEY" 'localhost:4700/v1/students?limit=50'
curl -H "$KEY" 'localhost:4700/v1/students?updatedSince=2026-09-27T00:00:00%2B05:30'
curl -H "$KEY" 'localhost:4700/v1/students?cursor=<nextCursor>'
curl -H "$KEY" localhost:4700/v1/guardians/gdn_0001
curl -H "$KEY" 'localhost:4700/v1/export/students.csv?includeMalformed=true' -o students.csv
curl -H "$KEY" -H 'content-type: application/json' localhost:4700/v1/communications \
  -d '{"externalId":"call-001","channel":"voice_call","guardianId":"gdn_0001","purpose":"ptm_invite","language":"ne","outcome":"answered","keysPressed":["1"],"occurredAt":"2026-10-05T05:00:00Z"}'
```

### Slice-1 contract (`src/contract/crm-schema.ts`)

| Route | Returns |
|---|---|
| `GET /v1/school` | `CrmSchool` |
| `GET /v1/students?updatedSince=&cursor=&limit=` | `{ data: CrmStudent[], nextCursor }` |
| `GET /v1/students/{id}` | `CrmStudent` |
| `GET /v1/guardians?updatedSince=&cursor=&limit=` | `{ data: CrmGuardian[], nextCursor }` |
| `GET /v1/guardians/{id}` | `CrmGuardian` |
| `GET /v1/export/students.csv`, `GET /v1/export/guardians.csv` | the same records in the contract CSV shape |

Paging rules, shared by every list route:

- Order is `updatedAt` ascending (compared as instants, so `Z` and `+05:30` both work), then `id`.
- `updatedSince` (alias `since`) is inclusive. Callers should subtract a few minutes to survive clock skew; overlapping pages are expected.
- `limit` is 1 to 200 (default 100); anything else is `400`.
- `cursor` is opaque. It carries the position and the `includeMalformed` flag, so forwarding just the cursor on later pages is enough. A record updated mid-crawl moves to the end and is seen again (at-least-once).
- Deletions arrive as tombstones: the full record with `deleted: true`.
- **Malformed records** are served only with `?includeMalformed=true`, on the list routes, the CSV exports and the by-id routes. They exist to prove the importer quarantines a bad record instead of half-importing it.

CSV exports use exactly `CSV_COLUMNS` from the contract, in order: a header row, UTF-8 (no BOM), comma-separated, CRLF line ends, RFC 4180 quoting (a field with a comma, quote or line break is quoted and its quotes doubled). Encodings:

| Column | Encoding |
|---|---|
| `guardians` | `guardianId:isPrimary:isGuardianOfRecord` joined by `\|`, e.g. `gdn_0003:true:true\|gdn_0004:false:false` |
| `consent.*` | `status;recordedAt;method;noticeVersion`, each part empty for null; an empty cell means the consent itself is null, `unknown;;;` means status unknown |
| `sensitiveFlags` | joined by `\|`; empty for none |
| `spokenFirstName.*` | empty = not reviewed in that language (the key is absent in JSON) |
| `deleted` | `true` for tombstones, empty otherwise |
| `apaarId`, `transportRoute`, `preferredLanguage` | empty = null |

### Slices 2-3 (v1 draft, `src/schemas.ts`)

These are served and validated with this package's own Zod schemas. The app will adopt, and may reshape, them in the slices that use them.

| Route | Returns |
|---|---|
| `GET /v1/hpc/entries?since=&studentId=&cursor=&limit=` | holistic progress card entries |
| `GET /v1/attendance?since=&date=&studentId=&cursor=&limit=` | daily marks for the last 30 school days |
| `GET /v1/assessments?since=&studentId=` | periodic tests and the half-yearly exam |
| `GET /v1/events`, `GET /v1/events/{id}` | PTMs, annual day, closures |
| `GET /v1/meetings` | meeting requests (reason codes only) |
| `GET /v1/incidents` | incidents (reason codes only; the schema is strict, so no note text can appear) |
| `POST /v1/communications` | write back a call outcome; idempotent by `externalId` (201 on create, 200 with the original record on a retry; the first write wins) |
| `GET /v1/communications` | the written-back log |
| `POST /v1/events/{id}/rsvps`, `GET /v1/events/{id}/rsvps` | RSVP upsert per (event, guardian); 409 if the event takes no RSVPs |
| `POST /v1/guardians/{id}/preferences` | `{ "doNotContact": boolean }`; bumps `updatedAt` so the next `updatedSince` pull sees it |

Write-back bodies are validated strictly: unknown fields (a transcript, say) are rejected with `400`, and an unknown guardian or student is `422`.

## Webhook hints

When `SAHAYAKAI_WEBHOOK_URL` and `SAHAYAKAI_WEBHOOK_SECRET` are both set, every demo-page mutation POSTs a hint. The body names the entity and nothing else, so the receiver pulls the record by id and never trusts a body:

```
POST <SAHAYAKAI_WEBHOOK_URL>
Content-Type: application/json
X-CRM-Event-Id: whe_6f0c...
X-CRM-Signature: t=1790744400,v1=<hex HMAC-SHA256(secret, "1790744400." + rawBody)>

{"id":"whe_6f0c...","type":"hpc.entry.created","occurredAt":"2026-10-01T04:30:00.000Z","entity":{"kind":"hpc_entry","id":"hpc_002984"}}
```

| Demo action | `type` | `entity.kind` |
|---|---|---|
| add a card observation | `hpc.entry.created` | `hpc_entry` |
| mark a student absent today | `attendance.marked` | `attendance` |
| publish an event / declare a closure | `event.published` | `event` |
| request a meeting | `meeting.requested` | `meeting` |
| log an incident | `incident.logged` | `incident` |
| change a guardian's do-not-contact | `guardian.updated` | `guardian` |

Receivers should reject a `t` more than five minutes from their clock and de-duplicate on `X-CRM-Event-Id`. `verifySignature()` in `src/webhooks.ts` is a reference implementation. Changes made through the API itself (write-backs) are not echoed as hints. Delivery is one attempt with a 5-second timeout; failures are logged and listed on the demo page.

## Demo page

`GET /` is the school office's own records screen, deliberately not SahayakAI's look (deep-teal app bar, IBM Plex named with system fallbacks). It is server-rendered HTML with no scripts and no external assets (no fonts, stylesheets or images are fetched), and readable on a phone: the module rail turns into a scrolling strip and wide tables scroll inside their card. Everything on it is read from the live state:

- **App bar:** the school crest, name, board and city, the "Synthetic data · numbers cannot ring" badge, and a search box. `GET /?q=<text>` lists up to eight students (by name, admission no. or id) and guardians (by name, id or phone) that match.
- **Module rail:** Dashboard, then counts for students, guardians, absences, upcoming events, card observations, written-back calls and the one integration. The links jump within the page.
- **Header:** today's date (IST), the academic year and, once the calling system has pulled, "SahayakAI pulled these records at HH:MM".
- **Six tiles:** active students, guardians (and how many are do-not-contact), consent to notices, absent today (and how many without a leave note), calls written back today, card observations.
- **Attendance today:** present / on roll per class and section, with absences and missing leave notes. Absent and on-leave marks count as away; everyone else on roll counts as present, so a day where the office has only marked absentees reads correctly. The seed's register ends on the anchor date, so until a mark exists for today the card shows the last marked day and says so.
- **Office actions:** one tab per demo action (declare a closure, mark a student absent today, publish an event, request a meeting, log an incident, set a guardian's do-not-contact, add a holistic-card observation). The tabs are CSS only: each tab links to its panel's id (`#act-closure`, `#act-absent`, ...) and `:target` shows it; with no fragment the default panel shows (`?tab=<action>`, else closure). After a submit the page reopens the same tab with the result banner. Without CSS every form is stacked under its heading.
- **Upcoming events** with the school's next holidays, consecutive days (or days a weekend apart) grouped, e.g. "Holidays 16 and 19 to 23 Oct".
- **Guardian languages:** the share of each preferred language, and how many are not recorded.
- **Records to check:** the malformed rows that fail the contract, guardians without notices consent recorded, custody restrictions on file, students who left, and do-not-contact guardians (with ids when there are only a few).
- **Calls written back by SahayakAI:** the latest eight from `POST /v1/communications`.
- **SahayakAI connection:** contract v1, the API key with all but its last four characters masked, the last pull (time and record counts), webhook hints sent today with the last delivery's status, and the endpoints.

The **last pull** is the latest authenticated `GET` of `/v1/students`, `/v1/guardians` or a CSV export. A paged crawl counts as one pull (a page without a cursor starts it; each cursor page adds its records), an `updatedSince` pull reads as "changed" records, and by-id reads, rejected requests and unauthenticated calls do not count. It is kept in memory only, never in the state file, so a restart shows "not pulled yet" until the next pull.

Every change made on the page persists to the state file.

## Data model

Seed `hillview-demo-v1`, anchored to **2026-09-30** (the "today" for attendance streaks and recency). The generator uses a seeded PRNG (cyrb128 + sfc32) and never touches `Math.random` or the wall clock, so the same seed and anchor always give byte-identical data; a test stubs both to throw while generating.

- **School:** CBSE, Siliguri, academic year 2026-27, `timezone: Asia/Kolkata`, rubric scale `bpa` = Beginner / Proficient / Advanced, an indicative holiday list, `udise: null`.
- **Students:** 399 active or left plus 2 tombstones, grades 1-10 × sections A and B, about 20 per class, roll numbers alphabetical. Names come from the region's Nepali-speaking (Gurung, Tamang, Rai, Limbu, Chhetri, Thapa, Lepcha, Sherpa, Pradhan, Subba), Bengali (Das, Ghosh, Sarkar, Chakraborty, Roy, Bose), Hindi-speaking (Agarwal, Prasad, Jha, Singh, Gupta) and English-preferring families. Each child's first name has a hand-written spelling per script in `spokenFirstName` (`src/names.ts`); names are never machine-transliterated (Aarav is আরভ in Bengali, not আরব, which reads "Arab"). About 5% of students are RTE-quota (classes 1-8 only), a few are waived, scholarship or staff wards; about 60% ride a bus route R1-R6; a few board.
- **Guardians:** 645. Preferred language is Nepali 40%, Bengali 25%, Hindi 20%, English 15%, with 3 planted nulls. `notices` consent is about 80% granted, 12% unknown (null, or status `unknown`) and 8% denied; the other consent groups are mostly null.
- **Holistic progress card:** 2,983 entries across term 1 (see below).
- **Attendance:** 11,959 marks over the last 30 school days (weekends, holidays and the 16 September closure excluded).
- **Assessments:** 4,782 rows for classes 3-10: Periodic Test 1, Periodic Test 2 and the Half-Yearly exam. A missed test is `marks: null, status: 'absent'`, never a zero.
- **Events:** a PTM for 7B, Annual Day, and the 16 September landslide closure. **Meetings:** 15 requests. **Incidents:** 40, as reason codes only.

### Holistic progress card structure (v1 draft)

Modelled on the NCERT/PARAKH holistic progress cards reissued in 2025, one per stage:

| Stage | Classes | Unit of assessment (`unit.kind`) |
|---|---|---|
| Foundational | 1-2 | six **domains**: Physical; Socio-emotional and Ethical; Cognitive; Language and Literacy; Aesthetic and Cultural; Positive Learning Habits |
| Preparatory | 3-5 | six **subjects**: R1, R2, Mathematics, The World Around Us, Art Education, Physical Education and Well-being |
| Middle | 6-8 | nine **subjects**: R1, R2, R3, Mathematics, Science, Social Science, Art, Physical Education, Vocational Education |
| Secondary | 9-10 | **projects and inquiries** (four per class) |

At every stage, entries rate one of three **abilities** (`awareness`, `sensitivity`, `creativity`) on the school's rubric scale (`rubric: { scaleId: 'bpa', level: 1-3, label }`). A rating is formative: it describes learning and is never evidence of misconduct. The card's official respondents are `teacher`, `self`, `peer` and `parent` (`respondent.official: true`); the school's own extension adds `bus_attendant`, `coach`, `librarian`, `nurse` and `counsellor` (`official: false`), so rules can treat them differently. Each entry has a `sentiment` (`positive`, `neutral`, `concern`). Teacher and non-confidential staff entries carry a short English `note`; self, peer and parent entries do not. Nurse and counsellor entries are `confidential: true` with a `reasonCode` and `note: null`: confidential matters cross the wire as reason codes, never note text.

Random entries dated in the last 14 days before the anchor are always neutral, so only the planted cases below satisfy the 14-day conduct and recognition rule shapes.

Sources:

- PARAKH, Holistic Progress Card: https://parakh.ncert.gov.in/hpc
- Foundational stage card: https://parakh.ncert.gov.in/themes/parakh/hpc-files/cards-pdf/Holistic-Progress-Card-(Foundational-Stage).pdf
- Preparatory stage card: https://parakh.ncert.gov.in/themes/parakh/hpc-files/cards-pdf/Holistic-Progress-Card-(Preparatory-Stage).pdf
- Middle stage card: https://parakh.ncert.gov.in/themes/parakh/hpc-files/cards-pdf/Holistic-Progress-Card-(Middle-Stage).pdf
- Secondary stage card: https://parakh.ncert.gov.in/themes/parakh/hpc-files/cards-pdf/Holistic-Progress-Card-(Secondary-Stage).pdf
- "How to fill the HPC" guides for each stage are linked from the PARAKH page.

## Planted cases

Every planted case sits in class 4A, 4B, 7A or 7B, so the fixture subset (grades 4 and 7) carries all of them. Ids are stable for this seed; `test/docs.test.ts` fails if this table stops naming an id the generator plants. The machine-readable list is `state.planted` in `data/state.json` and `planted.json` in the fixtures.

| Case | Ids | Detail |
|---|---|---|
| Siblings in different grades sharing both guardians | `stu_0128` Pema Gurung (4A), `stu_0261` Aarav Gurung (7B) | guardians `gdn_0001` Sarita Gurung (primary) and `gdn_0002` Suman Gurung |
| Blended family | step-child `stu_0254` Ritwik Das (7A), joint child `stu_0147` Ishita Ghosh (4B) | mother `gdn_0003`; step-parent `gdn_0004` Partha Ghosh is linked to `stu_0254` with `isGuardianOfRecord: false` |
| `sensitiveFlags: ["counsellor_referral"]` | `stu_0251` Kunal Agarwal (7A) | also has a confidential counsellor card entry `hpc_002983` |
| `sensitiveFlags: ["custody_restriction"]` | `stu_0125` Kripa Rai (4A) | the only other flagged student |
| Guardian with `doNotContact: true` | `gdn_0009` John Thomas | father of `stu_0269` Joel Thomas (7B); updated 5 days before the anchor |
| `preferredLanguage: null` | `gdn_0011`, `gdn_0012`, `gdn_0014` | the only three nulls; `gdn_0014` is also the sole guardian of his child and has null `notices` consent |
| Student with `status: 'left'` | `stu_0247` Bibek Chhetri (7A) | no attendance after he left |
| Tombstones (`deleted: true`), updated in the last 2 days | students `stu_0160` (4B, family withdrew) and `stu_0281` (7B, a duplicate record of `stu_0261`); guardian `gdn_0017` | a deleted guardian is referenced only by deleted students |
| Malformed, only with `?includeMalformed=true` | `stu_9901` (grade 14), `stu_9902` (no guardians), `gdn_9901` (phone `12345`) | `gdn_9901` is not referenced by any student |
| RTE-quota (planted; 24 in all) | `stu_0134` Sagar Limbu (4A), `stu_0273` Neha Prasad (7B) | |
| Spoken name not reviewed | `stu_0127` (4A, no `ne` though his family prefers Nepali), `stu_0266` (7B, English only) | plus a few random gaps elsewhere |
| CSV quoting | `gdn_0008` `Mary "Minnie" Thomas` | exported as `"Mary ""Minnie"" Thomas"` |
| Boarder | `stu_0260` Tenzing Sherpa (7A) | family in Sikkim; no bus route |
| Current 4-day absence streak (grade 4) | `stu_0153` Prakriti Thapa (4B) | absent 25, 28, 29 and 30 September with no leave note; no one else ends on a streak of 3 or more |
| Low attendance | `stu_0250` Harsh Yadav (7A) | present 70% of the last 30 school days, scattered |
| Sustained assessment drop | `stu_0245` Arnab Chakraborty (7A) | about 83% → 60% → 39% across PT1, PT2 and HY; open meeting request `mtg_0015` (`academic_progress`) |
| Missed test, not scored as zero | `stu_0276` Sabina Subba (7B) | every PT2 row is `marks: null, status: 'absent'` |
| Conduct concern that SHOULD trigger a request to talk | `stu_0274` Rahul Singh (7B) | a teacher concern and a bus-attendant concern within 14 days |
| Staff-only concerns that must NOT trigger | `stu_0122` Ayan Saha (4A) | two bus-attendant concerns within 14 days, no teacher |
| Positive recognition | `stu_0146` Grace Lepcha (4B) | teacher and coach positives within 14 days |
| PTM for 7B | `evt_ptm_7b_20261010` | 2026-10-10 10:00-13:00, `school_hall`, RSVPs on |
| Annual Day | `evt_annual_day_20261205` | whole school, 2026-12-05 |
| Emergency closure | `evt_closure_20260916` | landslide on NH-10, declared 06:10 IST |

## Layout

```
src/contract/crm-schema.ts   verbatim copy of the app's contract (do not edit)
src/schemas.ts               v1 draft schemas for slices 2-3 and write-back
src/generate.ts              deterministic seed generator and planted cases
src/names.ts                 name pools with per-script spellings
src/csv.ts                   RFC 4180 encode/parse, contract flattening
src/pagination.ts            keyset pagination
src/server.ts                routes, auth, write-back, demo actions
src/demo-page.ts             the demo page (office dashboard)
src/pulls.ts                 in-memory record of the calling system's last pull
src/webhooks.ts              signing, verification, delivery
src/store.ts                 atomic persistence
src/export-fixtures.ts       fixtures for the app's tests
```

CI: `.github/workflows/mock-school-crm.yml` runs `npm ci`, the typecheck and `npm test` on every pull request that touches this folder or the contract file.
