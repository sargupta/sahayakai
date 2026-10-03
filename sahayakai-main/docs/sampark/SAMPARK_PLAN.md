# Sampark: school-to-parent AI calling inside SahayakAI

**Plan v2 — revised after an independent five-lens critical review. For founder decision. Nothing has been built.**
Date: 30 Sep 2026 · Baseline: `origin/main` @ `430275f13` (Merge #150, prod parent calls on Vobiz) · Branch reserved: `feature/school-parent-calling` (empty)
*Sampark* is an internal codename only. Parents always hear **the school's** name, never ours, and the name collides with Sampark Foundation, a well-known Indian school charity, so it is not a customer-facing brand.

**How to read this.** §0 maps your request to sections. §1–§10 are the plan. §11 is the delivery sequence, §15 the decisions only you can make, and §16 the review log: what five independent reviewers found, and what I changed, modified or deliberately did not adopt, with reasons. The v1 draft this replaces made several mistakes that §16 records openly.

---

## 0. What you asked for, and where it is answered

| Your ask | Section |
|---|---|
| Every circumstance in which a school should (and should not) call a parent | §2 |
| AI calling as a separate application within SahayakAI | §1, §9 |
| The whole pipeline, broken into components | §4 |
| The holistic development card coming from an external (dummy) CRM | §3 |
| MCP server or plain API calls | §3.4 |
| How the application looks | §8 |
| English, Bengali, Hindi and Nepali | §5 |
| Inbound calls | §2F, §11 phase 5 |
| Integration with the existing framework and latest `main` | §9, §10 |
| Not missing critical information | §6, §10, §12, §16 |
| Quality and process standards | §13 |
| Delivery plan, done-criteria, decisions for you | §11, §14, §15 |
| Critical review of the plan | §16 |

---

## 1. What Sampark is

Today a teacher opens a modal on one student, picks one of four reasons, and places one call. Sampark turns that into a **school-level voice layer**: the school's CRM stays the source of truth about children; rules read it and propose who should hear from the school and why; the right member of staff approves; the system calls each parent in their own language, captures what they answer, and writes the result back to the CRM.

The review changed how the product is positioned, and that change runs through everything below. A premium CBSE school already sends circulars, fee notices and holiday lists through its ERP app and class WhatsApp groups. Robocalling educated urban parents with routine notices would be the fastest way to get the school's caller ID reported as spam under TRAI's new rules, after which even the calls that matter stop being answered. So Sampark is **not** a replacement for the school's messaging. It is the channel for three things messages do badly:

1. **Time-critical notices** — a landslide closure at 06:30, a child not in class by 10:00.
2. **Reaching the parents messages don't reach** — the parent who didn't read the circular, the grandparent who can't read, the Nepali-speaking family who receives everything in English.
3. **Two-way answers in the parent's own language** — an RSVP, a request to talk, a parent's own observation for the holistic card, captured and written back.

Five principles hold the design together:

1. **Facts come from the CRM, words come from reviewed templates, and a model only converses.** No model ever invents a fact about a child, an amount or a date.
2. **The listener is checked before anything about a child is said.** A notice about a specific child begins "the school has a message for Riya's parent; if you are Riya's parent, press 1", and only then says anything specific. Class-wide notices (a PTM, a closure) name no child at all.
3. **Fail closed, and check again at the last moment.** Consent, do-not-call, hours and frequency are checked when a call is proposed, when it is dispatched, and when the parent picks up.
4. **The school is the sender and the data owner.** Calls go out in the school's name, from a number registered to the school, under rules the school has adopted in writing. SahayakAI processes on its behalf and uses the data for nothing else.
5. **Human judgement in proportion to harm.** A PTM reminder is approved once per campaign; a request to talk about a child's progress is approved by the class teacher; a safeguarding matter is never dialled by the machine.

---

## 2. When a school should call a parent — the scenario catalogue

Every purpose has a **mode**, which decides cost, risk and what the parent can say back:

- **Notice** — a pre-rendered, reviewed message in the parent's language with keypad replies (at most two action keys plus 9 to stop these calls). No model is on the line. It must fit inside one 60-second billing unit, so the message body is kept to about 28 seconds and the menu to about 10.
- **Conversation** — the existing live Gemini voice agent. Used only where two-way conversation is the point (a teacher-initiated call, a parent's input for the holistic card), because it costs 5–10 times more per minute and is not yet available in Nepali.
- **Human-only** — the engine creates a task for a named person, pages them, and never dials.

And a **channel rule**: *call-first* for time-critical and relationship purposes; *message-first, call if unacknowledged* for routine notices wherever the school has a messaging channel. SahayakAI has no WhatsApp or SMS sender today, so in the pilot the "message" is the school's own existing channel, and Sampark calls the families the school marks as not reached. A sender of our own is a later decision (§15).

### A. Student progress and the Holistic Progress Card

The review's most important correction is here. v1 had the machine detect a "behaviour concern" from staff notes and have an AI tell the parent about it. That is an algorithm labelling a child, delivered by a voice the parent cannot question ("who said this? was he provoked?"). It is exactly the "detrimental effect on the well-being of a child" that DPDP s.9(2) forbids without exemption, and it would teach staff to stop writing honest holistic-card notes once they learn notes trigger calls. So automatically detected concerns now produce a **request to talk**, and a person delivers the substance.

| # | Purpose | Trigger (from CRM) | Mode | Approves | Parent can answer |
|---|---|---|---|---|---|
| A1 | Attendance — request to talk | absence streak ≥ 3 school days, or *session* attendance heading below 75% (with a minimum number of days elapsed) | Notice: "Pema's class teacher would like to speak with you this week" | Class teacher | 1 = please call me to fix a time |
| A2 | Same-day unexplained absence | absent by 10:00 with no leave note, **after the class teacher confirms** no message came through the diary or class group | Notice, call-first | Class teacher (one tap per class per day) | 1 = I know, my child is with me · 2 = I did not know |
| A3 | Academic progress — request to talk | rolling average of ≥ 2 assessments below 35%, or a sustained drop across ≥ 2 assessments (never one test, never a missed test scored as zero) | Notice, request to talk | Class teacher | 1 = call me |
| A4 | Conduct — request to talk | ≥ 2 concern notes in 14 days, at least one from a teacher or coordinator; notes from non-teaching staff may *support* but never *trigger* | Notice, request to talk (never states the conduct) | Coordinator | 1 = call me |
| A5 | Positive recognition | ≥ 2 positive notes from ≥ 2 respondents in 14 days, or a rubric level-up | Notice now; conversation later | Class teacher (or auto, if the school opts in) | optional message back to the teacher |
| A6 | Term progress summary | end of term | Message-first (report card); call only if the school asks | Coordinator, per campaign | 1 = I'd like to talk to the teacher |
| A7 | **Parent's input for the holistic card** | end of term, per the card's own cadence | Conversation (phase 4), with the summary read back to the parent for confirmation before it is saved | Coordinator, per campaign | the parent's own observations, written into the card's parent section |

**A2 was redesigned for safety.** In v1, "1 = my child is safe / on leave" could be pressed by anyone who answered, closing what might be a missing-child case. Now key 2, or no answer at all, **pages the class teacher and the principal immediately**, and a keypress is never written back as a leave record (CBSE requires leave requests in writing).

**A7 is the product's real differentiator.** The NCERT card has an official parent respondent — "Your Child Matters!", the Parent–Teacher Partnership Card, "Parents' feedback" — and in a school where 40% of parents speak Nepali at home, a conversation in Nepali is the most inclusive way that section will ever be filled. It waits for conversation mode in Nepali (phase 4), and it is in the pitch from day one.

**Rules ship switched off.** Each rule and its thresholds must be adopted by the school in writing, which also keeps SahayakAI a processor rather than a co-decider of purposes (§6). Before any rule goes live, it is **backtested on one anonymised term of the school's own data**: "these 23 children would have been flagged last term; your teachers already knew about 9." That report tunes the thresholds and is the strongest demo the product has.

**No concern-type call (A1, A3, A4) is placed on a Friday or Saturday.** Research associates Friday report-card release with a sharp rise in verified physical abuse the following day; a call about a child's problems should arrive when the school can follow up the next morning.

### B. Meetings

| # | Purpose | Mode | Approves | Answer |
|---|---|---|---|---|
| B1 | PTM invitation (class-level, names no child) | Notice, message-first | Coordinator, per campaign | 1 = I will come · 2 = this time doesn't suit me (offered the next slot on the same call, or a call-back) |
| B2 | Principal / disciplinary meeting | **Human-first** — the coordinator phones; automation only confirms the agreed slot and sends a reminder | Principal | 1 = confirmed |
| B3 | Counsellor meeting | Human-only (counsellor's own call) | — | — |
| B4 | Reminder, day before a confirmed meeting | Notice | Auto | — |

### C. Fees and administration — owned by the accounts office

| # | Purpose | Mode | Answer |
|---|---|---|---|
| C1 | Fee due in 7 days | Notice, message-first, **listener check first** | 1 = already paid (accounts checks) · 2 = speak to accounts, including if paying on time is difficult |
| C2 | Fee overdue | Notice, listener check first | same |
| C3 | Hardship, or a third overdue notice | **Human** — accounts officer | — |
| C4 | Documents pending (APAAR consent, birth certificate, medical form) | Notice, reminder only (the forms need physical signatures) | acknowledgement |
| C5 | Re-enrolment | Notice, strictly informational (anything that sells turns the call promotional) | 1 / 2 / undecided |
| C6 | Scholarship or board-registration deadline | Notice | acknowledgement |

Fee calls follow rules that are easy to state and easy to get wrong: **no amount before the listener check**; **at most two automated calls per due**, only between 10:00 and 19:00 (the RBI's fair-practice rules for recovery calls are the right benchmark even though a school is not a lender); never a threat, a consequence, a payment on the call, or any request for a number; "pay only through the school's usual counter or app, and never share an OTP with anyone" instead of a promised link we cannot send; **RTE-quota and fee-waived families are excluded** from fee calls and from paid-activity notices.

### D. Events and notices

| # | Purpose | Mode | Notes |
|---|---|---|---|
| D1 | Event invitation with RSVP | Notice, message-first | class- or school-level, names no child |
| D2 | Exam schedule / result day / report-card day | Message-first | results are never read out |
| D3 | Planned holiday | Message-first | — |
| **D4** | **Emergency closure** (rain, landslide, bandh) | Notice, **call-first, its own path** | see below |
| D5 | Transport: route change, bus delay | Notice to one route | owned by the transport desk |
| D6 | Early dismissal or changed pickup time | Notice, call-first | new in v2 |
| D7 | Contagious illness in class (conjunctivitis, chickenpox) | Notice, class-level | new in v2; names no child |
| D8 | Health camp / vaccination / de-worming | Message-first | consent collected on paper |
| D9 | Boarders: outings, travel dates | Notice | only if the pilot school has boarders (common in Darjeeling) |

**D4 gets its own path, because the ordinary rules would fail the families it exists to protect.** Hill-school closures are decided at 05:30–07:00 and buses leave by 07:30, so D4 may run from 06:00 with the principal's approval; it bypasses the frequency cap and the no-Sundays rule; it retries every 15 minutes rather than every 2 hours; audio has *today* and *tomorrow* variants chosen at the moment of dialling, and the intent expires at the end of the closure day, so no parent ever hears "closed tomorrow" on the closure day itself; and the principal sees a live list of families not yet reached, for staff to phone by hand. Whether D4 may reach families who have not consented rests on a lawful basis that counsel should confirm (§6). Darjeeling district schools really did close on 8–10 October 2025 after landslides; this is the most valuable thing the product does.

### E. Human-only — the engine pages a named person and never dials

| # | Situation | Why a machine must not call |
|---|---|---|
| E1 | Child unwell or injured, hospital | Parents need answers only a person can give; consent-to-treatment decisions; liability |
| E2 | Wellbeing / mental health, bullying (either side) | DPDP s.9(2) with no school exemption; risk of disclosing other children |
| E3 | Suspected abuse / POCSO | Mandatory reporting to police (POCSO ss.19–21); a call can alert an abuser in the same household |
| E4 | Suspension, expulsion, disciplinary TC | Due process and a human decision-maker |
| E5 | Child not boarded, missing from bus, not collected | Time-critical live judgement |
| E6 | Campus security incident, bereavement | Wording authored by the principal |

**Sensitive flags suppress everything automated, not only what they trigger.** If a child carries a "domestic issues" or "severe illness" barrier on the holistic card, a counsellor referral, or a custody restriction, *no* automated call about that child goes out except class-wide D notices. Nurse and counsellor notes are excluded from every rule. And the CRM sends Sampark **reason codes, never note text**, for anything confidential.

### F. Inbound (phase 5)

Parents will call back the number that rang them from day one, so the pilot number carries a static message in four languages ("this number is used by the school for recorded messages; please call the school office on …") until inbound exists. The eventual inbound intents are fee balance, event and holiday information, bus timing, booking or moving a PTM slot, and leaving a message for the class teacher. A caller ID is not identity: nothing child-specific is disclosed until the caller passes a check, and a parent's report that "my child is absent today" becomes a note for the teacher, never an attendance record.

---

## 3. The holistic progress card and the dummy CRM

### 3.1 What the real card looks like

NCERT/PARAKH reissued all four stage cards in August 2025. The unit of assessment changes by stage — six **domains** in the Foundational stage, **subjects** in the Preparatory (6) and Middle (9) stages, **projects and inquiries** in the Secondary stage — while three **abilities** (Awareness, Sensitivity, Creativity) are rated at every stage on a three-level rubric whose labels differ between official documents (*Beginner / Proficient / Advanced* on the 2025 cards, *Stream / Mountain / Sky* on PARAKH's page, *Beginner / Progressive / Proficient* in CBSE's guide). So the schema stores a rubric *scale id* and three labels. The card's official respondents are **teacher, self, peer and parent**; this school's bus attendant, coach, librarian, nurse and counsellor observations are a school extension, modelled separately so rules can treat them differently.

A rubric rating is **formative**: it describes where a child is in learning, and it is never used as evidence of misconduct. v1's own inbox mock-up used "Sensitivity: Beginner" as behaviour evidence; that was wrong and is gone.

### 3.2 The dummy CRM

The dummy CRM is built as a separate service (`mock-school-crm/` at the repository root, beside `sahayakai-agents/`) that knows nothing about SahayakAI, so the day a real school connects its real CRM, nothing in SahayakAI changes except configuration. It is deliberately thinner than v1 proposed.

**Seed school:** "Hillview Demo School, Siliguri" — visibly a demo, and not our product's name. Grades 1–10, sections A and B, about 400 students; guardian languages **Nepali 40%, Bengali 25%, Hindi 20%, English 15%**; names from the region's communities, stored in each script from reviewed fields (names are never machine-transliterated — Aarav is আরভ in Bengali, not আরব, which reads "Arab"). A term of holistic-card entries across respondents, attendance, assessments, fee dues, events, meeting requests and incidents (as reason codes). Planted cases exercise every rule, including the ones that must *not* fire: an RTE-quota student with a due, a child with a sensitive flag, a guardian with no consent, a family with two children, a blended family where one guardian is not the other child's guardian of record, and a closure.

**Numbers are synthetic and undiallable:** drawn from a reserved range, flagged `synthetic`, and refused by the dialer in every mode, with a hard block on any organisation marked as a demo.

### 3.3 The integration contract

The contract is **REST to pull, signed webhooks as hints, write-back endpoints for results, and CSV as the universal fallback**, because that is how Indian school ERPs actually integrate: Fedena and Classe365 publish token-based pull APIs, most others offer only exports, webhooks are rare, and none offers MCP.

- **Read:** list endpoints with `updatedSince` cursors (overlapping by a few minutes to survive clock skew) and **by-id endpoints** for targeted pulls; deletions arrive as tombstones.
- **Hints:** `POST /api/webhooks/school-crm/{connectionId}`, signed `t=<unix>,v1=<HMAC-SHA256(t.body)>`, rejected outside a five-minute window, de-duplicated by event id. A webhook only triggers a pull of that record by id; its body is never trusted.
- **Write-back:** call log (idempotent by our call id), RSVPs, meeting confirmations, fee acknowledgements, parent input for the card, do-not-call — through an outbox with retry, so an outcome is never lost when the CRM is down.
- **CSV:** the same canonical shape as a file, validated row by row with reasons for every rejected row. For the pilot this is the likely real path: **a nightly export from the school's ERP is the realistic default**, because the ERP vendor may sell its own communication module and may refuse or charge for API access. The school's contract with its vendor, not the vendor's goodwill, should guarantee its data access.
- **Demo page:** the mock CRM has a page where, in front of a principal, you add a teacher's note or declare a closure and watch Sampark react.

### 3.4 MCP server or API calls?

**API calls are the integration. The MCP server waits.** A pipeline that places calls to parents must be deterministic and must not depend on a model deciding to call a tool, and a real school CRM will speak HTTP or CSV, never MCP. An MCP server over the same REST API becomes worth building when something consumes it — the inbound call agent and the VIDYA orchestrator from the ADK redesign, which need to *ask* the CRM things in conversation. That is phase 4, and even then it runs only on synthetic data unless the school's data-processing agreement names the model provider as a sub-processor, because staff "exploring a school's data" through an LLM is processing for our purposes, not the school's.

---

## 4. The pipeline, component by component

```
 School CRM ──nightly CSV / REST pull / webhook hint──▶ ① Ingest ─▶ ② Normalise ─▶ ③ Detect ─▶ ④ Gate ─▶ ⑤ Approve
                                                                                                       │
   ⑪ Report ◀─ ⑩ Write back ◀─ ⑨ Reconcile ◀─ ⑧ Call runtime ◀─ ⑦ Dispatch ◀─ ⑥ Compose & render ◀───┘
```

**① Ingest** runs as its own scheduled job every 15 minutes with a per-school time budget, so one slow CRM cannot delay anyone's calls. Webhook hints trigger a by-id pull. CRM connection settings are validated against server-side request forgery (https only, private address ranges blocked after DNS resolution), and CRM keys and webhook secrets live in Secret Manager, never in Firestore.

**② Normalise** writes a canonical snapshot under the school, in collections prefixed `sampark_` so they can never collide with the existing `classes/{id}/students`. Guardian phone numbers are encrypted at rest (AES-GCM, the pattern the demo-call feature already uses) and keyed elsewhere by a peppered hash, so the console only ever sees the last four digits. Signals are rolled up per student rather than stored per day.

**③ Detect** runs the school's adopted rules, which are pure functions, and creates one **intent per student, purpose and occurrence**. The intent id is the hash of its dedupe key and is written with a create-only operation, so a rule that fires twice, or fires again after a person rejected it, can never resurrect or duplicate it. Each intent carries the evidence for the approver, the facts the script will state, a priority, and an expiry.

**④ Gate** returns *allow*, *defer until*, *block with reason*, or *hand to a person*, fail-closed:

| Check | Rule |
|---|---|
| Purpose | human-only purposes and any child with a sensitive flag never produce a dialable intent (except class-wide D notices) |
| Consent | per guardian, **per purpose group** (notices · progress and conduct · recorded conversation · holistic-card input), held in Sampark's preferences registry with the notice version, language and date; imported from the CRM where it exists |
| Do-not-call | Sampark's suppression list and the CRM's own flag |
| Fees | RTE / fee-waived excluded; two automated calls per due; 10:00–19:00 |
| Frequency | about four routine calls per guardian per month, counting teacher-initiated calls too; urgent notices exempt from the cap only |
| Hours | the school's adopted window inside 10:00–20:00 IST, no Sundays or school holidays (Dashain, Tihar, Durga Puja…); concern calls never on Friday or Saturday; D4 from 06:00 with the principal's approval |
| Language | if the guardian's language cannot run the requested mode, degrade to notice; if the language is unknown, **ask the family** rather than defaulting — defaulting a Nepali-speaking hill family to Bengali is not a neutral act in this region |
| Number | valid Indian mobile, not synthetic, not the student's own number; Nepal (+977) and Bhutan (+975) numbers to be checked with the school and the carrier |
| School | Sampark enabled, rules adopted, mode permits dialing, minute budget not exhausted |

**⑤ Approve** routes each intent to the person who owns that relationship rather than to the principal for everything. v1 would have sent 70–120 individual approvals a month to one principal, who would either rubber-stamp them (so the gate becomes theatre) or ignore them (so the product looks dead), and it would have bypassed the class teacher, who owns the parent relationship in an Indian school. So: class teachers approve A1, A2, A3, A5 for their own section; the coordinator approves A4 and progress campaigns; accounts owns the C family; the transport desk owns D5–D6; the principal approves B2 and D4 and adopts the rules, and otherwise receives a weekly digest with the power to override. Every approval is written to an audit log with who, when, and what they saw. Before phase 1 ends, the rules are run over a full simulated term to publish the expected intents per week, per purpose, per approver.

**⑥ Compose and render.** Scripts come from reviewed templates per purpose and language. Letters and abbreviations are written as spoken words in the template ("कक्षा चार, सेक्सन ए", "এসএমএস"), because the voice test showed the TTS reading "कक्षा ४ ए" as "four amperes" and silently skipping "SMS". The **fixed** parts of each message are rendered once per language and cached; only the sentence carrying the slots is rendered per parent, and that sentence is **transcribed back and checked** (with number normalisation, since the recogniser writes "बाह्र हजार पाँच सय" back as "१२५००") before the call may be dispatched — a mismatch blocks that one call. Rendering is a background job with progress shown, not something the Approve click waits on (each personalised clip takes 13–22 seconds). Audio is transcoded to 8 kHz mono and loudness-normalised.

**⑦ Dispatch** runs every minute, only within calling hours, and guarantees that **a parent is never called twice for the same thing**. Scheduler deliveries can overlap or land in either region, and a process can die after the carrier accepts a call but before we record it, so: a single-flight lease stops overlapping ticks; each call is claimed in a Firestore transaction (`approved → dialing`, with a lease and an attempt number) *before* the carrier is contacted; a call found stuck in `dialing` is never re-dialled but marked `unknown` for a person to check; and the number of calls in flight is computed from records, not from a counter that a lost webhook could freeze. Guardian bundling happens here: approved notices of the same mode for the same **guardian of record** (never merely the same phone number) on the same day become one call. Retries: no answer or busy after 2 hours (D4 after 15 minutes), at most twice a day and three times in total; a parent who heard the whole message is never called again for it.

**⑧ Call runtime.** *Notice* calls run on the web app using Vobiz call-control XML: the answer webhook returns a keypad-gather wrapping the audio, a short silence first (Indian callers say "Hello?" before listening), the listener check where the purpose needs it, then the message and menu; the gather webhook records the digit and plays a confirmation. Each step has its own token domain (answer, gather, status) and every gather token is single-use and minted fresh, so a replayed URL cannot press 9 on someone's behalf. Audio is served through a token-checked route or a signed link minted at answer time, never a link stored at render time that expires before a retry; if a clip cannot be fetched, a static "please contact the school office" clip plays instead of silence. Most parents will press nothing, so outcomes are classified from the hangup duration against the audio length: *hung up early*, *heard part*, *heard all, no key*, *pressed a key*. *Conversation* calls are single-student and reuse the live bridge through a dial function extracted from today's teacher call route, with a sentinel owner (`sampark:{orgId}`) so school calls never appear in a teacher's own history queries.

**⑨ Reconcile.** Phase 1 uses a Sampark-local state reducer that only moves forward and never overwrites a terminal state. The shared reconciler that the standing law requires already exists, uncommitted, in another worktree (`wt-b1-calllifecycle`, 187 lines, written for Twilio in August). It should land on its own through the T5 call-lifecycle tranche, and migrating the live Vobiz status route onto it belongs in that PR — not in a feature PR that also adds a second dialer.

**⑩ Write back** through the outbox, idempotently, with retry and a visible failure state.

**⑪ Report**: the console, the principal's weekly digest, a monthly management report with export, proof of contact for "you never called me" disputes, a per-school ledger of billed seconds and cost, and a **disparity report** of progress and conduct intents by language, gender and fee category that pauses the rules automatically above a threshold, because staff notes can carry community bias.

---

## 5. English, Bengali, Hindi and Nepali

**Engines, per language.** The voice test changed this table:

| | English | Hindi | Bengali | Nepali |
|---|---|---|---|---|
| Notice audio | Gemini-TTS `en-IN` | Gemini-TTS `hi-IN` | **Gemini-TTS has no `bn-IN`** (only `bn-BD`, a Bangladesh locale); Chirp 3 HD `bn-IN` renders cleanly and 2–3× faster — a West Bengal native listener chooses | Gemini-TTS `ne-NP` — verified: rendered, transcribed back at 0.97–0.98 confidence, every number read in correct Nepali. **Preview** status, no SLA |
| Conversation | existing bridge | existing bridge | existing bridge | **not yet**: Vertex Live does not list Nepali, and the Gemini Developer API that does is excluded by its terms for services likely to reach under-18s |

So the engine is chosen per language, all four use the same voice name ("Kore" exists in Gemini-TTS, Chirp 3 HD and Live) so parents hear one school voice, the Nepali render is pinned to a model version with error alerting, and a human-recorded Nepali closure notice is kept as a fallback for the one message that must never fail.

**Words.** Templates live in `src/locales/call-scripts/{english,hindi,bengali,nepali}.json` (the repo forbids inline multi-language dictionaries), written natively in the register parents actually speak, not translated office language. The review found v1's drafts were Kathmandu-formal in Nepali (शिक्षण शुल्क, लेखा शाखा, a 30-word sentence before its verb), a word-for-word copy of English in Bengali and Hindi ("gentle reminder"), and assumed a male listener in Hindi ("आप कर चुके हैं") when mothers often answer. The drafts below are corrected; **the school's own Nepali-, Bengali- and Hindi-speaking teachers review and sign them**, which is faster than an external panel and right, because it is the school's voice.

**Nepali versus Hindi.** Both use Devanagari, so a script check cannot tell them apart, and v1's proposed marker lists would have misfired (छ is inside Hindi words like कुछ and अच्छा; हो is also a Hindi verb; है appears in colloquial Nepali). The gate is now per sentence, on whole words with slots masked: a sentence fails if it contains a Hindi-only word (है, हैं, नहीं, आपका, आपको, में, से, और, लिए, करें, दबाएँ, होगी, सकते, रुपये…) or any nukta, or if it contains no Nepali marker (छ as a whole word, छैन, हुन्छ, हुनुहुन्छ, हुनेछ, तपाईं, पनि, भने, लागि, रुपैयाँ, or the endings -लाई, -बाट, -सम्म, -हरू, -नुहोस्). A small offline language-ID model gives a second opinion, and the gate proves itself by failing on the Hindi templates.

**Nepali conversation (phase 4)** is tested on Vertex only: the cascade of Chirp 2 `ne-NP` recognition, a Gemini text model and streaming Gemini-TTS, judged by Darjeeling native speakers. Until it passes, Nepali families receive every purpose in notice mode, and for the one place that most needs a conversation — A7 — the school can route Nepali families to a named Nepali-speaking teacher instead.

### 5.1 What the parent actually hears — revised drafts

*Drafts for the school's native-speaker review. Numbers are written as words where they sit next to letters.*

*Update 30 Sep 2026: these are the review-round drafts. The current wording (warmer and more conversational, same facts and keys) lives in `src/locales/call-scripts/{english,hindi,bengali,nepali}.json`, and `scripts/sampark/verify-voice.ts` proves every clip against the live voices. The voice's style prompt shapes delivery only — an earlier prompt that asked it to "say the date clearly" made it invent a date in a Nepali confirmation, so every clip a parent can hear is now transcribed back and length-checked before it can be used.*

**PTM invitation** — class-level, names no child, ~22 seconds.

- **EN** — Namaste. This is a recorded message from Hillview Demo School for parents of Class 7, section B. The parent–teacher meeting is on Saturday, 10 October, at 10 in the morning, in the school hall. If you will come, press 1. If this time does not suit you, press 2. To stop these calls, press 9.
- **HI** — नमस्ते। यह हिलव्यू डेमो स्कूल की ओर से कक्षा सात, सेक्शन बी के अभिभावकों के लिए रिकॉर्ड किया हुआ संदेश है। पैरेंट-टीचर मीटिंग शनिवार, दस अक्टूबर को सुबह दस बजे स्कूल हॉल में होगी। अगर आप आएँगे, तो 1 दबाएँ। अगर यह समय ठीक न हो, तो 2 दबाएँ। ऐसी कॉल बंद करने के लिए 9 दबाएँ।
- **BN** — নমস্কার। এটা হিলভিউ ডেমো স্কুলের তরফ থেকে ক্লাস সেভেন, সেকশন বি-র অভিভাবকদের জন্য একটা রেকর্ড করা বার্তা। অভিভাবক-শিক্ষক সভা হবে শনিবার, দশই অক্টোবর, সকাল দশটায়, স্কুলের হলে। আপনি আসতে পারলে এক টিপুন। এই সময়ে আসা সম্ভব না হলে দুই টিপুন। এই ধরনের কল না চাইলে নয় টিপুন।
- **NE** — नमस्ते। यो हिलभ्यू डेमो स्कूलबाट कक्षा सात, सेक्सन बी का अभिभावकहरूका लागि रेकर्ड गरिएको सूचना हो। प्यारेन्ट-टिचर मिटिङ शनिबार, दस अक्टोबर, बिहान दस बजे स्कूलको हलमा हुन्छ। तपाईं आउनुहुन्छ भने एक थिच्नुहोस्। यो समयमा आउन मिल्दैन भने दुई थिच्नुहोस्। यस्ता कल नचाहिए नौ थिच्नुहोस्।

**Fee reminder** — child-specific, so it begins with the listener check and says nothing specific until key 1.

- **Step 1, EN** — Namaste. Hillview Demo School has a message for Riya's parent. If you are Riya's parent or guardian, press 1.
- **Step 2, EN** — The second instalment of Riya's school fee, twelve thousand five hundred rupees, is due by Thursday, 15 October. Please pay only through the school's usual counter or app, and never share an OTP with anyone. If you have already paid, press 1. To speak with the accounts office, including if paying on time is difficult, press 2. To stop these calls, press 9.
- **HI** — (1) नमस्ते। हिलव्यू डेमो स्कूल की ओर से रिया के अभिभावक के लिए एक संदेश है। अगर आप रिया के माता-पिता या अभिभावक हैं, तो 1 दबाएँ। (2) रिया की स्कूल फ़ीस की दूसरी किस्त, बारह हज़ार पाँच सौ रुपये, गुरुवार, पंद्रह अक्टूबर तक जमा करनी है। फ़ीस केवल स्कूल के काउंटर या ऐप से ही जमा करें, और किसी को भी ओटीपी न बताएँ। फ़ीस जमा हो चुकी हो, तो 1 दबाएँ। अकाउंट्स ऑफ़िस से बात करने के लिए, या समय पर जमा करना मुश्किल हो, तो 2 दबाएँ। ऐसी कॉल बंद करने के लिए 9 दबाएँ।
- **BN** — (1) নমস্কার। হিলভিউ ডেমো স্কুলের তরফ থেকে রিয়ার অভিভাবকের জন্য একটা বার্তা আছে। আপনি রিয়ার অভিভাবক হলে এক টিপুন। (2) রিয়ার দ্বিতীয় কিস্তির স্কুল ফি, বারো হাজার পাঁচশো টাকা, পনেরোই অক্টোবর, বৃহস্পতিবারের মধ্যে জমা দিতে হবে। ফি শুধু স্কুলের কাউন্টার বা অ্যাপের মাধ্যমেই দেবেন, আর কাউকে ওটিপি বলবেন না। ফি জমা দেওয়া হয়ে গেলে এক টিপুন। অ্যাকাউন্টস অফিসের সঙ্গে কথা বলতে, বা সময়মতো দেওয়া কঠিন হলে, দুই টিপুন। এই ধরনের কল না চাইলে নয় টিপুন।
- **NE** — (1) नमस्ते। हिलभ्यू डेमो स्कूलसँग रियाको अभिभावकका लागि एउटा सूचना छ। तपाईं रियाको अभिभावक हुनुहुन्छ भने एक थिच्नुहोस्। (2) रियाको दोस्रो किस्ताको स्कूल फी, बाह्र हजार पाँच सय रुपैयाँ, पन्ध्र अक्टोबर, बिहीबारसम्म तिर्नुपर्नेछ। फी स्कूलको काउन्टर वा एपबाट मात्र तिर्नुहोस्, र कसैलाई पनि ओटीपी नभन्नुहोस्। फी तिरिसक्नुभएको छ भने एक थिच्नुहोस्। अकाउन्ट्स अफिससँग कुरा गर्न, वा समयमा तिर्न गाह्रो छ भने, दुई थिच्नुहोस्। यस्ता कल नचाहिए नौ थिच्नुहोस्।

**Emergency closure** — class-wide, *today* and *tomorrow* variants chosen at dialling.

- **EN** — Namaste. This is an urgent recorded notice from Hillview Demo School. Because of heavy rain and landslide danger, the school is closed today, Thursday, 8 October. School buses will not run. If you have heard this, press 1.
- **HI** — नमस्ते। यह हिलव्यू डेमो स्कूल की ओर से एक ज़रूरी रिकॉर्ड किया हुआ संदेश है। भारी बारिश और भूस्खलन के ख़तरे की वजह से आज, गुरुवार, आठ अक्टूबर को स्कूल बंद रहेगा। स्कूल बसें भी नहीं चलेंगी। संदेश सुन लिया हो, तो 1 दबाएँ।
- **BN** — নমস্কার। এটা হিলভিউ ডেমো স্কুলের একটা জরুরি রেকর্ড করা বার্তা। ভারী বৃষ্টি আর ধসের আশঙ্কার জন্য আজ, বৃহস্পতিবার, আটই অক্টোবর স্কুল বন্ধ থাকবে। স্কুল বাসও চলবে না। বার্তাটা শুনে থাকলে এক টিপুন।
- **NE** — नमस्ते। यो हिलभ्यू डेमो स्कूलको जरुरी रेकर्ड गरिएको सूचना हो। धेरै पानी परेको र पहिरोको खतराले गर्दा, आज, बिहीबार, आठ अक्टोबरमा स्कूल बन्द रहनेछ। स्कूल बस पनि चल्दैन। सूचना सुन्नुभयो भने एक थिच्नुहोस्।

**Request to talk** (A1/A3/A4) — after the listener check, and deliberately saying nothing about why: "Pema's class teacher, Mrs Rai, would like to speak with you this week about how Pema is doing at school. Press 1 and the school will call you to fix a time. To stop these calls, press 9." A press creates a call-back task for the class teacher with a one-school-day deadline.

**Stopping calls.** Key 9 asks for confirmation ("press 9 again to stop these calls; emergency closure notices will still reach you"). If the parent does not confirm, the opt-out is applied anyway, because an unwanted call generates a complaint while a missed routine notice costs little. The office is notified to confirm with the family within two school days, which protects against a child pressing 9 to silence the school; opting out is also possible by telling the office, and later by SMS keyword or web link.

---

## 6. Compliance and safety

The review found the telecom analysis in v1 was not just incomplete but pointed the wrong way, so this section is rewritten.

**TRAI — who the sender is.** Under TCCCPR 2018, the "Sender" includes whoever owns the calling number and whoever causes the call to be made, and a *service* call (inferred consent) is one a sender makes **to its own customer**. The parent is the school's customer, not SahayakAI's. If calls go out from numbers SahayakAI owns, they lose their service status. So: **the school registers as the principal entity on DLT, with a caller ID KYC'd in the school's name; SahayakAI registers as a telemarketer; and the robo-call intimation to the originating operator (regulation 4, in force since February 2025) and the A2P pre-declaration under the September 2026 amendment are filed per school.** Per-school numbers also stop one school's complaints from barring another's calls — though the new rule counts five flagged numbers linked to one sender, so they only protect us if the numbers are the school's. One more consequence reaches beyond Sampark: **today's production teacher-initiated calls on Vobiz may already be out of line with regulation 4**, and that should be checked now (§15). Calls stay purely service in content: each purpose is classified once in the catalogue, and anything that sells (admissions offers, paid programmes, fundraising) is excluded, because one promotional sentence makes the whole call promotional. Not yet verified: the Gazette text of the September amendment, whether Vobiz is a licensed operator or a reseller, and whether voice content templates need DLT registration.

**DPDP — roles and consent.** The school is the Data Fiduciary and SahayakAI its Processor under a written contract — but only if SahayakAI does not decide purposes itself. That is why rules ship off and are adopted by the school in writing, and why the contract forbids our own use of the data (demos, analytics, training). The Fourth Schedule exempts a school from verifiable parental consent only for tracking and monitoring "for educational activities" or safety; fee, event and re-enrolment calls are not that, so **consent is recorded per guardian and per purpose group**, with the notice version, language and date, and it is never a condition of admission. The notice is itemised and available in Nepali, Bengali and Hindi, all Eighth Schedule languages. Recording on a conversation call is opt-in at the start of the call. Withdrawal is as easy as giving consent (keypad, office, and later SMS or web). The substantive DPDP rules bind from **13 May 2027** (consent managers from 13 November 2026); until then the IT Act's SPDI Rules govern health data such as nurse notes, which is another reason nurse and counsellor notes never enter the rules.

**Where the data goes.** The live bridge calls Gemini on the `global` endpoint and the web app runs in Singapore as well as Mumbai; DPDP's cross-border section is a negative list with no countries restricted yet, so this is lawful, but it must be disclosed. Sampark pins TTS, recognition, storage and the model to `asia-south1` where the service exists there, lists Google, Vobiz and any other vendor as sub-processors in the school's notice and contract, and keeps CERT-In's 180-day logs in India.

**Retention and accuracy.** Firestore's time-to-live deletes whole documents, not fields, so transcripts live in their own child documents with an expiry, and nothing is set on the shared `parent_outreach` collection that would delete teachers' records. DPDP's one-year minimum retention for logs (Rules 6 and 8, from May 2027) sits uneasily with a 90-day transcript window, so counsel should settle it; the working proposal is readable for 90 days, then sealed and access-logged until one year. Breaches: the processor tells the school within 6 hours (CERT-In's clock), so the school can notify the Board "without delay". A parent's words written into the holistic card are read back to them for confirmation first.

**Disclosure.** Notice calls say "recorded message". Conversation calls say "AI voice assistant" in the parent's language, the agent never claims to be human, and "press 0 or say 'teacher' for a person" is always available. TRAI treats a call designed to deceive as unsolicited commercial communication, so this is no longer only an ethics question, and it resolves three contradictory positions in the current code.

**Other duties.** CBSE requires written notice for attendance shortfall; a call supplements it and the notice is recorded as sent. Payment never happens on a call. Every call names a school contact for complaints (in the confirmation clip, to keep the message short). Inside the school, the accounts role never sees conduct evidence, and every edit to a call's facts is audited.

---

## 7. Cost, pricing and capacity

Measured and sourced figures (₹88 per US$, GST extra):

| | Notice, personalised, 45 s | Notice, broadcast, 45 s | Conversation, 3 min |
|---|---|---|---|
| Carrier (Vobiz ₹0.45–0.65/min, 60 s units, unanswered free) | ₹0.45–0.65 | ₹0.45–0.65 | ₹1.35–2.60 |
| TRAI A2P termination charge (≤ ₹0.05/min, may be passed through) | ≤ ₹0.05 | ≤ ₹0.05 | ≤ ₹0.20 |
| Voice: Gemini-TTS render / Live model | ≈ ₹1.0 | ≈ ₹0 (shared) | ₹9–16 (every turn re-bills the whole conversation) |
| Render check (transcribe-back of the slot sentence) | ≈ ₹0.19 | — | — |
| **Total** | **≈ ₹1.7–1.9 per call** | **≈ ₹0.5–0.7 per call** | **≈ ₹11–19, i.e. ₹3.7–6.3 per minute** |

Three conclusions follow. First, **a notice must fit inside one 60-second unit**: at 37–42 seconds of script plus a 12-second keypad wait, v1's drafts crossed into a second minute on every no-press call. Second, **conversation loses money at ₹4 per minute** once it touches the live model; it should be priced per call with a time cap (about four minutes) and used only where two-way value justifies it. Third, **the market prices recorded voice as a commodity** (MyClassboard advertises about 75 paise a minute), so notice calls should be bundled into the per-teacher seat price as an included allowance, and the premium should be charged for what no one else offers: native Nepali and Bengali, teacher-approved outreach driven by the holistic card, parent answers written back to the CRM, and call-backs that actually close. The always-on telephony service for conversation calls costs an estimated ₹8–12k a month on its own, which the pilot should not carry; keeping the pilot to notice calls avoids it. Real costs are measured from the carrier's billing records and the GCP billing export, not estimated.

Capacity: notice calls do not touch the live bridge and are limited by carrier channels (to confirm in writing with Vobiz, with calls-per-second limits); a 400-student school's closure broadcast (≈ 380 guardians after bundling) at 20 concurrent calls completes in about 20 minutes, which the principal sees as a live estimate. Conversation calls are bounded at about 32 concurrent by the bridge.

---

## 8. The application — how it looks

Sampark lives at `/sampark/{orgId}` in the web app, is built from the existing design system (`PageShell`, `SectionCard`, tokens only), works on a phone as well as a desktop (approvals happen on phones), and shows each person only their own work.

**Who uses it:** the principal (adopts rules, approves disciplinary and emergency calls, reads the digest), the coordinator (conduct and progress campaigns), class teachers (their own section's requests to talk and absences — reached from the teacher's existing attendance screen as "3 families in 7B need a call"), accounts (fee campaigns), the transport desk, and the office (call-backs). Roles are granted by the organisation admin inside Sampark, because the platform's organisations today know only "admin" and "teacher".

```
┌ Hillview Demo School ─────────────── PRACTICE — no real calls ── CRM synced 2 min ago ┐
│ Today   My approvals (4)   Campaigns   Call-backs (5)   Calls   Reports   Settings   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ NEEDS YOU   4 approvals · 5 call-backs due today · 1 page (absence, 7B)               │
│ TODAY       126 calls · 84% heard the key fact · 31 RSVP yes · 1 opt-out              │
│ THIS MONTH  1,840 billed minutes · ₹ from carrier records · languages ne 41% bn 24%… │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Today** — what needs me, and is it all working.

```
┌ My approvals ─ Class 7 B ──────────────────────────────────────────────────────────┐
│ Request to talk · Pema Tamang · parent speaks Nepali · notice                      │
│ Why (for you only): Class teacher, 24 Sep — pushed juniors in the lunch queue;     │
│                     Coordinator, 26 Sep — second incident, same pattern            │
│ Parent will hear: [EN] [HI] [BN] [NE] ▶  "…Pema's class teacher would like to     │
│                   speak with you this week about how Pema is doing…"              │
│ [ Approve ]   [ I'll call myself ]   [ Not now ]                                   │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**My approvals** shows each proposed call with the evidence in staff's own words (never shown to the parent), the language, and exactly what the parent will hear, with a switch across the four languages and a play button.

**Campaigns** is a short wizard — purpose, audience (grades, sections, bus route), facts, preview in four languages with audio, schedule, approve — plus a **one-screen ad-hoc announcement** (type the message, get reviewed four-language audio), which schools ask for on day one, and a live tally while it runs.

**Call-backs** is the list of parents who pressed "call me", each with an owner, a one-school-day deadline and a closing reason, because a promised call-back that nobody makes is worse than no call. (Masked click-to-call from the console is a later addition.)

**Calls** is the log: status, language, what the parent heard, keypresses, write-back state, and proof of contact.

**Reports** holds the monthly management report with export, the disparity report, and the backtest.

**Settings** holds the CRM connection, the adopted rules and thresholds, the calling window, the template library (reviewed templates only), the school calendar (holidays feed the gate), roles, the preferences registry (consent, language, window per guardian, with the onboarding consent-and-language drive), the suppression list, and the **mode**, named in a principal's words: *Practice — no calls*, *Test — my phone only*, *Live — parents*. Live mode shows a permanent coloured banner, and switching to it requires typing the school's name.

v1's "Students 360" screen is dropped: it duplicated the CRM. Each family's contact history lives on the call log instead.

---

## 9. How it fits the existing SahayakAI

**Tenancy and authority.** A school is an existing `organizations/{orgId}`. Sampark's data lives in `sampark_*` collections keyed by that id, Admin-SDK only (the existing default-deny in `firestore.rules` already covers them). Authority starts from one extracted, tested helper, `requireOrgAdmin(orgId, uid)` — the dashboard page and the analytics route disagree today about whether a member with role `admin` counts — and Sampark's own role grants hang off it. The self-editable `administrativeRole: 'principal'` is never used.

**Reused:** the Vobiz client and the token pattern (with three new, separate token domains), the calling-window function (with a Sampark policy that *narrows* it for routine purposes, school windows, Sundays and holidays; the D4 emergency start at 06:00 is the one place the platform's 09:00 floor is widened, and it is an explicit, separately tested exception for that single purpose, never a general setting), the cron-auth helper, the webhook verification and idempotency pattern, the demo-call feature's phone encryption, the organisation model, the design system and logger. The existing quiet-hours class gate is **widened** to cover any route that imports the Vobiz library, rather than duplicated.

**Changed, in separate small PRs, each with characterisation tests first:** extracting the dial primitive from `/api/attendance/call` (needed only when conversation calls arrive in phase 4); landing the reconciler through T5.

**New:** `src/lib/sampark/`, `src/server/sampark/`, `src/app/api/sampark/[orgId]/…`, `src/app/api/webhooks/{school-crm,sampark-voice}/…`, `src/app/api/jobs/sampark-{dispatch,sync,sweep}`, `src/app/sampark/…`, `src/locales/call-scripts/`, `src/lib/api/sampark.ts`, index entries in `firestore.indexes.json`, and the separate `mock-school-crm/` with its own CI job. New public endpoints sit under the already-public `/api/webhooks/` and `/api/jobs/` prefixes and verify tokens or HMAC in the handler, so `middleware.ts` does not change.

**Flags.** `SAMPARK_ENABLED=false` and `SAMPARK_LIVE_DIAL_ENABLED=false` are **declared in both regional deploy blocks of `cloudbuild.yaml`** (the #150 precedent), so turning either on is one reviewed PR and the region-parity test sees it. They are never `NEXT_PUBLIC_`, and never Firestore feature flags, which default *on* when missing.

**Environments.** Local development loads the production service account, and the preview environment writes to the production Firestore project, so "no writes reach production" cannot rest on remembering to set an environment variable. Sampark's repository refuses to start outside production unless it is pointed at the emulator or at a **separate named Firestore database** (`sampark-nonprod`) in the same project, and audio goes to a local store in development. Phase 2's test calls use that named database.

**Alignment with the ADK redesign.** Sampark uses no Genkit; its engine is deterministic TypeScript plus TTS, and its operations are exposed through REST (and later MCP), so the VIDYA orchestrator can one day say "call Class 7B's parents about tomorrow's closure" by invoking a tool.

**Latest `main`.** The branch starts at `430275f13`, which includes the Vobiz production flip (#150), the live bridge (#143), and the i18n and CI repairs (#151, #153, #149). The repo's branching rules give a `feature/*` branch seven days and deploy every merge to `main` to production, so Sampark ships as **thin vertical slices, each a small PR merged dark behind the false flags**, not one long-lived branch.

---

## 10. Preconditions and pre-existing defects

Two of these are live production problems, and the review was right that they are preconditions rather than decisions: adding a second dialer to a platform with an open dialing hole is the wrong order.

1. **Security — arbitrary-number dialing.** `POST /api/attendance/outreach-records` stores a client-supplied `parentPhone` (`src/server/attendance.ts:655`) with `deliveryMethod: 'twilio_call'`, and `/api/attendance/call` then dials whatever number is on the record. Any gold/premium teacher can make the platform ring any number. Fix first, in its own PR.
2. **Telephony drift.** The live `sahayakai-telephony` service is serving revision `00035`, deployed at 01:32 IST today from the **unmerged** `feat/vobiz-telephony-media` branch, displacing the bridge `main` declares. It accepts the socket before checking the token, never retires used tokens, authenticates hangups wrongly, and has no Nepali. It has not yet carried a real call. Restore the declared bridge or merge a corrected branch — your call, since it may be another session's work in progress.
3. **TRAI regulation 4** for today's production calls (§6).
4. Opt-outs are detected on teacher calls but never stored, while the parent is told "it has been noted" (Sampark builds the store; wiring teacher calls to it is a follow-up).
5. The live bridge reads a `message` field that is never written, so records without `spokenScript` reach the agent as "no specific message".
6. A refused or failed dial leaves the outreach at `initiated`, locking the teacher out for 5 minutes with a spinning modal.
7. The bridge's over-capacity path closes the socket without hanging up, leaving a parent on a silent line.
8. `parent_outreach` has no retention and is not deleted with the teacher's account.
9. The call-status reconciler exists only uncommitted in `wt-b1-calllifecycle`.

---

## 11. Delivery plan

**P0 — Preconditions (in parallel, before any Sampark code merges).**
Engineering: fix §10.1; resolve §10.2. Business, which only you can move: the school names its **CRM/ERP vendor** and shares the field list and **one anonymised term's export**; the school starts a **consent-and-language drive** (a line in the admission packet, a QR form at the PTM desk, the class WhatsApp group) with a target of 70% coverage before live calls; Vobiz confirms **in writing** its per-minute rate, billing unit, channel count, calls per second, and a **dedicated number registered to the school**; the school names its **native reviewers** (one Nepali-, one Bengali-, one Hindi-speaking teacher); the TRAI registration and regulation 4 filings are started.

**Phase 1 — Working end to end in Practice mode, as three dark slices** (each a small PR, ≤ 7 days, behind the false flags; no real call possible):

- **Slice 1 — CRM to class-wide notices.** The dummy CRM (REST, CSV export, holistic-card data, demo page) and SahayakAI's CSV and REST import with a rejected-rows report; the preferences registry and suppression list; broadcast campaigns for PTM (B1), event (D1) and closure (D4, with its own path); four-language templates with the purity and parity gates; the render pipeline with the transcribe-back check; at-most-once dispatch to a **simulated carrier** that produces realistic outcomes (answered, heard part, no answer, keypresses); the call log.
- **Slice 2 — Holistic card to requests to talk.** Roles and approval routing; the adopted-rules engine for the four existing scenarios (A1 attendance, A3 academic, A4 conduct as requests to talk; A5 recognition) plus A2 same-day absence with paging; the listener check; fee reminders (C1/C2) with the accounts role; sensitive-flag suppression; the backtest report.
- **Slice 3 — Closing the loop.** Write-back to the CRM through the outbox; call-back tasks with owners and deadlines; the monthly report, disparity report and ledger; Today screen.

**Phase 2 — Real notice calls to a staff phone.** First test: the keypad-and-audio verb set on Vobiz, since the company has only exercised it in a demo, not in production. Then every Phase 1 purpose heard in all four languages on a real handset, keypresses recorded and written back, in *Test* mode against the `sampark-nonprod` database; native-speaker sign-off; the Bengali engine chosen by a West Bengal listener; answer route latency under one second.

**Phase 3 — Pilot: one class, then one grade.** Gated on TRAI registration, 70% consent coverage, signed templates, and agreed commercial terms. Half the sections receive the school's messages only and half receive messages plus call escalation, so any lift can be shown rather than asserted. Success metrics: share of parents who heard the key fact, by language; RSVP and acknowledgement rates; call-backs closed on time; opt-outs under 2% and zero carrier complaints; PTM turnout against the previous PTM; fee payment speed against the previous quarter; office hours of manual calling replaced (baseline measured before the pilot); how quickly teachers approve.

**Phase 4 — Conversation.** A7 parent input for the holistic card with read-back; conversation-mode recognition calls; the Nepali conversation trial on Vertex with Darjeeling speakers; bridge purpose modules (principal framing, AI disclosure, a structured outcome tool, a four-minute cap); the MCP server over the CRM API for agents.

**Phase 5 — Inbound.**

### Definition of done for Phase 1

- An organisation admin, signed in locally against the emulator, connects the dummy CRM, imports it, and sees rejected rows with reasons.
- A PTM, an event and a closure campaign each preview in English, Hindi, Bengali and Nepali as text and audio, and every personalised slot sentence passes the transcribe-back check.
- The four existing scenarios, driven by holistic-card and attendance data from the dummy CRM, produce requests to talk routed to the right approver, with evidence; sensitive and RTE cases produce nothing dialable, and say why.
- Approving a campaign dispatches simulated calls inside the calling window only; a simulated crash between dialing and recording never produces a second call; outcomes appear in the console **and** in the dummy CRM.
- `npm run predeploy`, the full jest suite, every CI gate and the dummy CRM's own CI job pass; the environment guard proves no write can reach production.
- Every class gate in §13 exists and fails when its rule is broken.

---

## 12. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Parents treat school calls as spam; the caller ID is barred | Medium | Message-first for routine notices; school-registered number; school named in the first seconds; low frequency; opt-out that works; complaint monitoring |
| Consent data does not exist | **High** | Preferences registry owned by Sampark; the consent drive is a P0 task with a coverage target |
| The real CRM differs from the dummy | **High** | Vendor, fields and a real export in P0; CSV as default; the backtest runs on real data |
| A notice misreads a name, amount or date | Medium | Spoken-form templates; per-call transcribe-back check; native review |
| Nepali TTS is Preview | Medium | Pinned model, alerting, human-recorded fallback for closures, second vendor evaluated |
| Nepali conversation never meets the bar | High | Notice mode for Nepali; route A7 to a Nepali-speaking teacher meanwhile |
| Conversation cost exceeds price | High at ₹4/min | Notice as the volume product; conversation per call with a cap; real cost ledger |
| Production telephony drift and the open dialing hole | Present now | P0 |
| The work becomes another stalled branch | Real (48 worktrees exist) | Thin dark slices merged weekly; P0 business actions tracked, not assumed |

---

## 13. Quality and process

The work follows the repository's own rules: a contract block at the top of every new route (input, output, auth, flags, cost, language, done-means — the template the rules refer to does not exist, so the parent-call demo spec's outline is used); Zod at every boundary; data layer proven before UI; thin API routes over `src/server/sampark/`; the `@/lib/logger`, never `console.log`; tokens only in UI; every interface string through `t()` with keys in all ten locale files; Conventional Commits on `feature/*` branches of at most seven days; no `--no-verify`; the full PR template; **no AI attribution** in commits or PRs; `npm run predeploy` green; nothing merged without your review, and nothing turned on in production without a flag PR you approve.

**Class gates** — each a test that fails when its rule is broken:

1. Every route that can reach the carrier checks the calling window (the existing gate, widened).
2. Only the dispatcher module may import the carrier's place-call function.
3. A simulated crash between dialing and recording never produces a second dial.
4. No synthetic number, and no number belonging to a demo organisation, can reach the carrier in any mode.
5. Outside production, the repository refuses to start unless pointed at the emulator or the non-production database.
6. Every template exists in all four languages with identical slots, no unfilled placeholder, and no Latin abbreviation inside an Indic template.
7. The per-sentence Nepali gate passes every Nepali template and fails every Hindi one.
8. Every purpose is classified service or promotional in the catalogue, and no promotional purpose can be scheduled.
9. No child-specific fact is spoken before the listener check.
10. A child with a sensitive flag, or any human-only purpose, never produces a dialable intent.
11. Consent (per purpose group) and the suppression list are enforced at dispatch and at answer.
12. RTE and fee-waived students never receive fee or paid-activity intents; no due receives more than two automated calls.
13. The same dedupe key never produces two intents, and a rejected intent cannot be resurrected.
14. D4 audio says "today" on the closure day and the intent expires after it.
15. The Nepali render uses the `ne-NP` code and the pinned model.

---

## 14. Deliberately out of scope for Phase 1

Real calls of any kind; conversation mode for new purposes; changes to the Python live bridge; the MCP server; a Nepali teacher UI (Nepali is a *parent* language, carried by a separate `ParentLanguage` type, not a twelfth UI language); our own WhatsApp or SMS sender; inbound calls; production deployment of anything but code behind false flags; the pre-existing defects in §10 items 4–9.

---

## 15. Decisions needed from you

1. **Positioning:** Sampark as the escalation, emergency and two-way voice layer beside the school's existing messaging — not a robocaller for every notice.
2. **Requests to talk:** automatically detected attendance, academic and conduct concerns produce a request for the class teacher to talk, not an AI delivering the concern. (Teacher-initiated AI calls, which exist today, are unchanged.)
3. **The school as sender:** the school registers on DLT with its own caller ID; SahayakAI registers as telemarketer; and **check today's production calls against TRAI regulation 4 now**.
4. **Calling windows:** routine 10:00–20:00 IST, no Sundays or holidays, no concern calls on Friday or Saturday; emergency closures from 06:00 with the principal's approval.
5. **Consent:** per guardian and per purpose group, owned by Sampark, with a school-run consent drive in P0; whether emergency closures may reach non-consenting families is for counsel.
6. **Nepali:** notice mode now; conversation only after a Vertex-based trial with Darjeeling speakers; A7 for Nepali families routed to a Nepali-speaking teacher meanwhile.
7. **The two live production problems (§10.1, §10.2):** fix the dialing hole now; restore or correct the telephony service.
8. **Pricing:** notice minutes included in the seat price; conversation priced per call with a cap; Vobiz terms in writing first.
9. **P0 business actions:** CRM vendor and a real export; the consent drive; the dedicated number; named reviewers.
10. **Go-ahead for Phase 1 slice 1**, built on the reserved branch and shown to you working before anything merges.

### Decisions taken 3 Oct 2026

1. **Fee calls (C1, C2):** `scholarship` and `staff_ward` are excluded, in addition to `rte` and `waived`. All four concession categories get no fee call, because the school may not want a machine reminding these families. Excluded children stay visible in the backtest and the console with a plain reason, so the school can ask for a change.
2. **Re-proposal cooldown:** the school chooses 7 or 14 days when it adopts a rule (default 14; 7 is the floor, a school may be stricter, never looser). Proposal expiry stays 7 days.
3. **Extra suppression triggers kept:** an open bullying report, an open wellbeing meeting and any counsellor involvement suppress automated calls about that child, beyond the plan's flag list.
4. **A5 (recognition) auto-approval:** default off. A school may opt in when it adopts the rule.
5. **A2 (absent today):** the policy stays as built (class-teacher confirmation first, then paging).
6. **Number lexicon:** stays 0 to 60; amounts it cannot say are handed to the accounts officer.
7. **Native review:** done by the founder's team.
8. **TRAI note and consent drive:** parked until a DPS agreement. The documents are in git history (commit cf24523).
9. **DPS data:** comes from the school's existing holistic-development tool, by API or MCP server; the dedicated calling number comes from DPS. The questions to ask are in section 7 of `DPS_SILIGURI_ASK_PACK.md`.

---

## 16. Critical review log

Five independent reviewers read v1, each with one lens, and were told to verify claims against the code and the law rather than trust the plan: **architecture & integration**, **compliance & child safety**, **product & UX**, **voice, language & cost** (with 19 live TTS and speech-recognition tests), and a **red team** arguing against the whole plan. Between them they raised 13 blockers and about 40 major findings. Below is what each important finding was and what happened to it.

### Accepted — the plan changed

| # | Reviewer | Severity | Finding | Where v2 changed |
|---|---|---|---|---|
| 1 | Architecture | Blocker | Dedupe stopped duplicate *intents* but not duplicate *calls*: overlapping or cross-region ticks, or a crash after dialing, could ring a parent twice | §4⑦ claim-before-dial transaction, lease, never re-dial `dialing`; gate 3 |
| 2 | Architecture | Blocker | "No write reaches production" was unenforced: local dev loads the prod service account, preview shares prod Firestore | §9 environment guard and `sampark-nonprod` database; gate 5 |
| 3 | Compliance | Blocker | The TRAI sender model was wrong: calls from SahayakAI-owned numbers lose service status; regulation 4 already applies, possibly to today's calls | §6 rewritten; §15.3 |
| 4 | Compliance | Blocker | A2's "1 = child is safe" could be pressed by anyone, closing a possible missing-child case | §2 A2 redesigned with paging |
| 5 | Compliance | Blocker | Notice calls spoke child facts to whoever answered, and anyone could opt the family out | Listener check (§1, §5.1); class-level broadcasts name no child; opt-out confirmation and office check; gate 9 |
| 6 | Compliance | Blocker | The emergency closure path would have failed its families: 09:00 start, 2-hour retries, consent-gated | §2 D4 path |
| 7 | Compliance | Blocker | Sensitive flags only blocked triggers, not other calls; nurse notes could drive conduct calls; note text over-collected; bundling by phone could disclose to a non-guardian | §2E suppression, reason codes, bundling by guardian of record; gate 10 |
| 8 | Voice | Blocker | Gemini-TTS has no `bn-IN`; the plan's "Bengali ✓" was a Bangladesh-locale voice | §5 per-language engines |
| 9 | Voice | Blocker | Personalised renders misread ("four amperes", skipped "SMS"); a template passing once proves nothing about the next render | §4⑥ spoken-form slots, fixed/variable split, per-call transcribe-back check |
| 10 | Voice | Blocker | "Tomorrow" baked into pre-rendered audio would be wrong on retry | D4 today/tomorrow variants and same-day expiry; gate 14 |
| 11 | Product | Blocker | Call-first for routine notices is the wrong channel for a premium school and invites spam complaints | §1 positioning, channel rule in §2 |
| 12 | Product | Blocker | The principal approving every call is unworkable (70–120 a month) and bypasses class teachers | §4⑤ role routing; §8 roles |
| 13 | Product + red team | Blocker | Phase 1 was overbuilt, demoed as a dashboard, and met the real CRM last | §11 P0 real export and backtest; thin slices; MCP deferred |
| 14 | Compliance | Major | An AI delivering behaviour and academic concerns is a DPDP s.9(2) risk and a harm to children | Requests to talk (§2A); no concern calls Friday/Saturday; disparity report |
| 15 | Compliance | Major | A CRM consent field is not verifiable or purpose-specific | Per-purpose preferences registry with notice version (§4④, §6) |
| 16 | Compliance | Major | SahayakAI could become a joint fiduciary by setting purposes and thresholds | Rules off by default, adopted in writing; contract forbids own use (§6) |
| 17 | Compliance | Major | Data leaves India via the `global` Live endpoint and Singapore; the Gemini Developer API is barred for under-18 reach | Region pinning, sub-processor disclosure, Vertex-only Nepali trial (§5, §6) |
| 18 | Compliance | Major | Retention, breach timing and card accuracy were mis-stated | §6 retention, 6-hour notice, read-back for A7 |
| 19 | Compliance | Major | Fee calls stated amounts to anyone, promised a link we cannot send, and could repeat ~10 times per due | §2C rules |
| 20 | Compliance | Major | "Automated" hid a live AI; TRAI now treats deceptive calls as UCC | §6 disclosure |
| 21 | Architecture | Major | "Conversation reuses the dial path unchanged" was false (ownership check, Host-header URLs, teacher framing, single student) | §4⑧, §9: extraction PR, sentinel owner, phase 4 |
| 22 | Architecture | Major | The reconciler already exists uncommitted; changing the live status route inside a feature PR is risky | §4⑨ local reducer; land the reconciler via T5 |
| 23 | Architecture | Major | Firestore TTL deletes documents, not fields | §6 transcript child documents |
| 24 | Architecture | Major | Collection names collide; composite indexes undeclared and unchecked | `sampark_` prefix, index entries (§4②, §9) |
| 25 | Architecture | Major | Sibling bundling conflicted with per-student dedupe | Intents per student; bundling at dispatch (§4③⑦) |
| 26 | Architecture | Major | One token domain for answer, gather and status; replayable gather; audio links expiring; no render batching | §4⑧ three domains, single-use gather tokens, answer-time links, background rendering |
| 27 | Architecture | Major | Undeclared env flags can be flipped silently in one region | Flags declared `false` in both cloudbuild blocks (§9) |
| 28 | Architecture | Major | Authorisation rule was inconsistent in the codebase; office staff could not be admins | `requireOrgAdmin` helper; Sampark roles (§9, §8) |
| 29 | Architecture | Major | Webhook-then-pull needs by-id endpoints; SSRF and secret storage unspecified; phones unencrypted | §3.3, §4①② |
| 30 | Architecture | Major | One tick did everything; the branch policy forbids a long-lived feature branch | Separate jobs (§4); dark slices (§9, §11) |
| 31 | Voice | Major | Messages crossed the 60-second billing unit | ≤ 28 s body, ≤ 10 s menu, 8–10 s keypad wait (§2, §7) |
| 32 | Voice | Major | Nepali drafts were Kathmandu-formal; Bengali "আরব" = "Arab"; Hindi assumed a male listener | Corrected drafts (§5.1); school's own teachers review |
| 33 | Voice | Major | Too many keys; most parents press nothing | Two action keys plus 9; outcomes classified by duration (§4⑧) |
| 34 | Voice | Major | The Nepali/Hindi marker gate would misfire | Per-sentence whole-word gate with negative control (§5; gate 7) |
| 35 | Voice | Major | "Proven in production" overstated: Suraksha's keypad path ran only as a demo | Corrected; it is Phase 2's first test (§11) |
| 36 | Voice | Major | Conversation cost is ₹3.7–6.3/min, not ₹3 | §7 table and pricing conclusion |
| 37 | Product | Major | Holistic-card notes as triggers will corrupt the card | Non-teaching notes support but never trigger; rubric ratings never conduct evidence (§2A, §3.1) |
| 38 | Product | Major | Nobody owned call-backs | Call-back tasks with owner and deadline (§8) |
| 39 | Product | Major | Consent and language data will not be in the CRM | Sampark owns preferences; consent drive in P0 |
| 40 | Product | Major | Pricing sells against a 75-paise commodity | §7: notice bundled into seats, premium for the differentiators |
| 41 | Product | Major | No pilot metrics | §11 phase 3 metrics and comparison design |
| 42 | Red team | Major | Two live production defects were listed as "decisions" | §10 preconditions, P0 |

### Modified — accepted in part, with reasons

- **Opt-out only after second-channel confirmation** (compliance). DPDP also requires withdrawal to be as easy as consent, and TRAI complaints are the larger practical risk, so an opt-out takes effect immediately even without the second key, and the office confirms with the family within two school days to catch a child pressing 9 (§5.1).
- **Drop the dummy CRM and the holistic-card triggers entirely; build CSV-in, broadcast-out only** (red team). You explicitly asked for a dummy CRM with the holistic card and for the four scenarios to be triggered from it, and the backtest needs rules to backtest. So both stay, but thinner: no MCP server, no Students view, CSV as a first-class path, rules shipped off and adopted by the school, and a real export in P0 so the dummy is never the only test.
- **Call-first only for a narrow list** (product). Accepted as the channel rule, but because SahayakAI has no messaging sender, the pilot's "message first" is the school's own channel, with Sampark calling the families marked unreached. Our own sender is a later decision, not assumed.

### Not adopted, with reasons

- **Have the principal record every broadcast in her own voice** (product, red team). Kept as an option for the fixed greeting only; splicing a human voice with TTS inside a sentence sounds broken, and four-language recording for every notice does not scale.
- **Answering-machine detection** (architecture). The voice reviewer showed it adds 2–5 seconds of silence and Indian mobiles rarely have voicemail; duration-based outcome classification replaces it.
- **Accept speech ("haan", "hoina") instead of keys in Phase 1** (voice). Vobiz's speech input does not support Hindi, Bengali or Nepali; recording a short answer and transcribing it is a Phase 2 experiment, not a Phase 1 dependency.

### Could not be verified — carried as open items

The Gazette text and commencement of TRAI's September 2026 amendment; whether Vobiz is a licensed operator; whether voice templates need DLT registration; whether private schools can obtain 1600-series numbers; whether West Bengal applies RTE 12(1)(c) in private schools; Vertex Live availability in `asia-south1`; Vobiz's billing unit on our account; Azure `ne-NP` voices as a second vendor.

---

## 17. First client: Delhi Public School Siliguri (added 1 Oct 2026)

The first school is **DPS Siliguri**, which runs **Entab CampusCare 10X** as its records system and **Knowlarity SuperReceptionist** as its phone line. Both facts change the plan in concrete ways; everything below comes from public sources checked on 1 Oct 2026, and the unverified points are listed at the end.

**The records system.** DPS Siliguri's site links its "ERP Login" to CampusCare 10X (school code `DPSSLG`), and its fee portal is still the older CampusCare portal; its sister school DPS Fulbari is on Entab too, so one connector would serve the group. Entab publishes **no API, webhooks or SFTP**. What it does document is report export (Excel, CSV, PDF) and Excel import (registrations, fee dues, marks, transport), and it has built custom APIs for partners such as banks and payment gateways. The private APIs behind the 10X app are undocumented and need a login, so they are off limits without Entab's agreement. In 10X a parent signs in with their registered mobile and an OTP, which makes that number the best-verified one to call; no preferred-language field was found, so Sampark's own preferences registry (and the onboarding language drive) carries language.

So the connector for this school is **a scheduled CampusCare export uploaded to Sampark**, not the REST pull the dummy CRM serves today. The CSV importer already validates and quarantines row by row; what it needs is a **saved column mapping** from Entab's export headings to the canonical fields (admission number, class-section, registered mobile, father's and mother's mobiles, transport, fee category), set up once per school. Answers go back the same way, as a file in an Entab import format or a report the office keys in, until Entab offers a scoped, read-only partner API, which is the request to make of them.

**The phone line.** The number DPS parents already know is the school's own, and TRAI wants the school as the registered sender, so the Knowlarity line matters for three things:

- **Call-backs.** "Press 2 to talk to the school" should not transfer the parent live into a menu. It records the request and creates a task; a staff member returns the call through Knowlarity's click-to-call, so the parent sees the familiar school number. This is the cheapest and most valuable integration, and it needs nothing from Knowlarity beyond its documented API.
- **Outbound notices.** Knowlarity can place calls from the school's number (on its enterprise plan), but every audio file must be **manually approved by Knowlarity support** before use, and its own text-to-speech covers only English and Hindi. That rules it out for per-parent audio and same-day emergencies, so **Vobiz stays the dialer** for Sampark's notices, and a `KnowlarityCarrier` adapter is reserved for calls that must show the school number with pre-approved audio (for example, closure clips approved in advance in all four languages).
- **Inbound (phase 5).** Parents keep calling the existing number; an option in the school's IVR ("press 9 to reply to today's call") forwards to Sampark, and Knowlarity's per-call webhook can route a parent with an open request to their class teacher.

**Questions for the school.** Which number is the SuperReceptionist number, and which one do parents recognise; which Knowlarity plan; who holds the Entab and Knowlarity admin logins; whether guardian mobiles are complete for every child; whether the school is DLT-registered as a sender and will file the robo-call declaration; office hours for call-backs; and whether DPS Fulbari is in scope.

**Questions for Entab.** Whether a scoped partner API is possible, and at what cost; whether exports can be scheduled or emailed; the import templates that can carry answers back; how the holistic progress card's parent section is stored and whether it can be imported; and whether Entab will sign data-processing terms with SahayakAI as a sub-processor.

**Questions for Knowlarity.** Whether the school's number can be the caller ID for automated service calls and who the originating telco is; how long audio approval takes and whether it can be expedited for emergencies; whether keypad presses can arrive as a live webhook; whether their audio-streaming WebSocket is generally available; and 2026 rates.

**Not verified.** Any Entab–Knowlarity integration (none found); which of DPS Siliguri's published numbers, if any, is on Knowlarity; current Knowlarity rates (the public figures date from 2022); and whether TRAI's AI-voice amendment has been finalised (one source cites a September 2026 announcement, another describes it as still a draft).
