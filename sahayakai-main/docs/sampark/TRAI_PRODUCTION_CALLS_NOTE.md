# TRAI note for counsel: today's production parent calls

**Engineering input for counsel. Not legal advice and not a legal conclusion.**
Prepared 3 Oct 2026 from the code on branch `worktree-agent-a854685469e63cbcd`
(based on `main`). Purpose: give counsel the facts about what the live
teacher-initiated parent calls actually do, so counsel can say whether they
are in line with TRAI's rules.

## 1. What is being asked, and how sure we are of the rules

We believe the following, but **every item here comes from news summaries and
secondary sources. We have not checked any of it against the gazette text.**
Counsel should work from the gazette, not from this list.

| Item (as we understand it) | Status |
|---|---|
| TCCCPR 2018, regulation 4: robo-call / autodialer calling must be intimated to the originating operator (in force since Feb 2025). | Unverified against the gazette |
| Third Amendment of 18 Sep 2026: robocalls must declare their automated nature. | Unverified; one source cites the announcement, another described it as still a draft |
| Service/transactional robocalls use the 160 number series; promotional use 140. | Unverified |
| A declaration duty applies within 60 days. We do not know of what, by whom, or from which date. | Unverified |
| Penalties up to Rs 10 lakh per violation. | Unverified |
| Five flagged numbers linked to one sender count against that sender. | Unverified; from our planning notes |
| TCCCPR treats a "service" call (inferred consent) as one a sender makes to its own customer. | Our reading of secondary sources |

Not known at all: whether Vobiz is a licensed operator or a reseller; which
number series Vobiz's origination number is on; whether voice content templates
need DLT registration; whether an AI-voice conversation counts as a
"robocall" under the amendment.

## 2. What the production calls are

- Trigger: a teacher opens a student, picks a reason, presses call. One call to
  one parent. Not a campaign, not scheduled by us.
  (`sahayakai-main/src/app/api/attendance/call/route.ts`)
- Provider: `VOICE_PROVIDER` selects Twilio (default), Exotel, or Vobiz. Per
  the repo's own plan, production parent calls are on Vobiz. The Twilio path is
  the older one. This note describes Vobiz.
- Number dialled: read from the stored parent record on the server; the
  teacher cannot type a destination at call time. Caution: the same plan
  records an open defect that the stored number is itself client-supplied when
  the record is created, so the destination is not fully controlled today.
- Caller ID: `VOBIZ_FROM_NUMBER`, a Vobiz-owned Indian number. It is not the
  school's number and not registered to the school (to our knowledge).
- Media: the answer webhook returns call-control XML that streams the call to a
  live Gemini voice conversation in the `sahayakai-agents` telephony service
  (`src/lib/vobiz/answer-xml.ts`, `sahayakai-agents/src/sahayakai_agents/telephony/`).
- Content: purpose is school-to-parent about the child (attendance, marks,
  conduct, as chosen by the teacher, plus a teacher-typed message). Not
  promotional by design; the agent is told to refuse fees, admissions and
  anything off-topic, and never to ask for money, bank details or OTPs.

## 3. What the call says and discloses today

Sequence on a Vobiz call:

1. A pre-recorded opener plays in the parent's language (files exist for 10
   languages; **none for Nepali**; falls back). English text:
   "Namaste. This is an important message from your child's school." It does
   not say the call is automated, recorded or AI, and does not name the school.
2. The live model then speaks. Its instructions:
   - introduce the school and teacher by name, say it calls "on behalf of" the
     teacher, and check it is speaking to the child's parent;
   - never name itself or call itself Sahayak/SahayakAI/a bot, never claim to
     be the teacher;
   - **disclosure is on request only:** if the parent asks whether they speak
     to a person, say simply that it is "an assistant calling for the teacher".
     The instruction says: "Do not volunteer it otherwise."
   (`telephony/prompt.py`)
3. The system prompt tells the model "You are NOT a robot", meaning not
   robotic in tone, while also forbidding it to claim to be human. Counsel
   may read these two lines differently.
4. There is **no AI/automated disclosure at the start of the Vobiz call**, and
   no recording disclosure. A recording/AI consent line (`consentPrologue`)
   exists in English only and is wired to the Twilio path
   (`src/types/attendance.ts`), not to Vobiz.
5. Parent can end the call only by speaking: the prompt says "THIS CALL HAS NO
   KEYPAD ESCAPE". The old Twilio "press 2 to end" text is not on this path.
6. Transcript of the conversation is stored on the `parent_outreach` record
   and an AI summary is generated for the teacher. No audio recording is
   stored by our code that we found; the carrier's own recording is unknown.
7. Closing: a warm closing line then the model ends the call by tool.

## 4. Calling hours

`src/lib/calling-hours.ts`: 09:00 to 21:00 IST, fixed to IST, enforced twice:
at the dial route (refuses with 409) and again at the Vobiz answer webhook
(answers with empty XML if it somehow rings outside the window).

Gaps: no Sunday or public-holiday rule; the window is the same for every
purpose (the wider Sampark plan proposes a narrower 10:00 to 20:00 for routine
calls). Counsel to say what window and day rules apply to service robocalls.
We have not checked whether the platform's window matches any TRAI window for
this call class.

## 5. Opt-out handling

- The live agent detects "do not call / stop calling / remove my number" in the
  parent's speech (`telephony/flow.py`, `is_optout`) and by the model's
  `end_call(reason="opt_out")`. It then says warmly that it "has been noted"
  and ends the call.
- **That opt-out is only logged. It is not stored anywhere that blocks a future
  call.** We found no do-not-call or suppression store in the web app that the
  dial route consults. The same parent can be called again by the same or a
  different teacher while having been told it was noted. (Known defect 4 in the
  Sampark plan.)
- No keypad opt-out on the Vobiz path. No SMS or web opt-out.
- No check of the national preference register (DND/NCPR) that we found.
- A per-student 5-minute dedup window exists; there is no per-guardian daily
  or monthly frequency cap on teacher calls.

## 6. Registration and sender status

To our knowledge, and to be confirmed with the business: SahayakAI, not the
school, is the account holder at the carrier; the school is not registered on
DLT as principal entity for these calls; no robo-call intimation to an operator
has been filed for the Vobiz number; no declaration has been filed under the
September 2026 amendment; the number is not on a 160-series (or any
service-call series). We have not seen any of the registrations in the repo.

## 7. Gaps, stated as engineering facts

| # | Fact | Why it may matter (for counsel to judge) |
|---|---|---|
| G1 | No automated/AI declaration at call start | Amendment says robocalls must declare automated nature (unverified) |
| G2 | Disclosure only if the parent asks | same |
| G3 | Opt-out only logged, never enforced | suppression and consent-withdrawal duties |
| G4 | No keypad opt-out | ease of opting out |
| G5 | Number not known to be on a service-call series; not school-registered | 160 vs 140 rule; "sender" definition |
| G6 | No evidence of regulation 4 intimation or amendment declaration | filing duties, 60-day clock |
| G7 | No Sunday/holiday rule, same window for all purposes | hours rules |
| G8 | Consent for the call is not recorded anywhere | inferred vs explicit consent |
| G9 | Call transcripts stored with no retention rule | data protection, not TRAI |
| G10 | Nepali has no recorded opener and no conversation support | language of disclosure |
| G11 | Stored destination number is partly client-supplied at record creation (open defect) | spam and misuse risk |

## 8. Questions for counsel

1. Does a teacher-initiated, one-to-one, live-AI-voice call to a parent about
   their own child fall under "robocall" or "autodialer" in regulation 4 and the
   Third Amendment? If it depends, on what facts?
2. If yes: who is the "sender" and who is the telemarketer: the school,
   SahayakAI, Vobiz, or a mix? What must each file, with whom, and by when? Does
   the 60-day duty run from 18 Sep 2026, from publication, or from something
   else, and are we already inside it?
3. Is this a "service" or "transactional" call (160 series) given that the
   parent is the school's customer and not ours? What follows if the origination
   number is a Vobiz number rather than the school's?
4. What exact words must the automated-nature declaration use, in which
   languages, and at what point in the call? Is a spoken "assistant calling for
   the teacher" on request enough, or must it be volunteered at the start? Is
   the opener recording ("important message from your child's school") a problem
   by itself?
5. Does the instruction to the model "do not volunteer it" create separate
   exposure, given that TRAI treats a call designed to deceive as unsolicited
   commercial communication (as we understand)?
6. Do the 09:00 to 21:00 IST hours satisfy the rules for this call class? Any
   Sunday, holiday or purpose-based limits?
7. What opt-out must exist (keypad, speech, SMS, register check), what must
   happen on opt-out and how fast, and is "noted" when nothing is stored a
   misrepresentation risk?
8. Is a school's inferred consent enough for these calls, or is explicit
   per-purpose consent needed? Does it change for emergency closures to
   families who have not consented?
9. Penalties: is Rs 10 lakh per violation the real figure; what counts as one
   violation (per call, per number); who bears it (school or us)?
10. Does Vobiz's status (licensed operator or reseller) change who must file?
    What should we ask Vobiz to confirm in writing?
11. Should we pause live parent calls on Vobiz until the above is settled, and
    what is the minimum change (declaration line, suppression store, filings)
    that would let them continue? We are not proposing which; this is a
    question.
12. What does counsel need from engineering (call logs, sample audio, volumes,
    dates the Vobiz path went live) to answer?

## 9. Files read for this note

`sahayakai-main/src/app/api/attendance/call/route.ts`,
`src/app/api/attendance/vobiz/answer/route.ts`, `src/lib/vobiz/*`,
`src/lib/calling-hours.ts`, `src/types/attendance.ts`;
`sahayakai-agents/src/sahayakai_agents/telephony/{prompt.py,flow.py,router.py,call_prompts.json,openers/}`;
`SAMPARK_PLAN.md` sections 6, 10, 15 (on branch `feature/school-parent-calling`).
