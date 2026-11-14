# Documentation review checklist: school guides for parent calling

**INTERNAL ONLY. Do not distribute to schools.**

Covers:
- `Sahayak_AI_School_Administrator_Guide.md` (Admin)
- `Sahayak_AI_Teacher_Guide.md` (Teacher)

Checked against branch `feat/parent-call-live-bridge` (HEAD 78379b50) on 2026-10-09. Production currently runs a different, older telephony deployment, so **nothing marked "Verified in current implementation" is necessarily true in production today**. It is true of this branch's code.

## Status key

| Status | Meaning |
|---|---|
| **IMPL** | Verified in current implementation (read in code on this branch) |
| **SIM** | Verified only by automated tests or local simulation (real Gemini Live, simulated carrier, synthetic English speech) |
| **PHONE** | Awaiting real-phone test |
| **POLICY** | Requires approval (policy not decided); placeholder used in guides |

---

## 1. Factual claims

### Teacher workflow and UI

| # | Claim | Guide(s) | Source | Status |
|---|---|---|---|---|
| 1 | Entry points: "Needs outreach today" chips (Consecutive absences / At-risk academically / Behavioral concern / Celebrate) pre-select the reason; Students tab → "Parent Outreach" list → "Contact" button | A2, T2 | `src/app/attendance/[classId]/page.tsx` | IMPL |
| 2 | Modal title "Contact [Student]'s Parent", subtitle phone · language | T2 | `contact-parent-modal.tsx:495-500` | IMPL |
| 3 | Reasons and descriptions (4) exactly as listed | A2, T2 | modal `REASONS` | IMPL (English labels; shown via `t()`, so translated UIs differ) |
| 4 | Buttons: "Next: Add Note", "Back", "Generate Message"/"Generating...", "Regenerate", "Copy for WhatsApp", "Call Parent"/"Calling..." | T2, T11 | modal | IMPL |
| 5 | Context panels: "Absent days (AI will reference)", "Recent marks (AI will cite lowest)", "Behavioral context (AI will reference your note)", "Recent win (AI will celebrate)" | T2 | modal `ReasonContextPanel` | IMPL |
| 6 | Generated message is **read-only**; no edit box; review step has no Back button | T2, T12, A4.3 | modal review step | IMPL |
| 7 | The call speaks `spokenScript` (AI-made phone version ≤100 words), which the teacher never sees | A4.3, T2, T12 | `parent-message-generator.ts:142-160`; `router.py:408-417` | IMPL |
| 8 | Draft is in the parent's language (native script) | A4.3, T2 | generator prompt "LANGUAGE LOCK" | IMPL |
| 9 | Message generation took up to ~20 s, sometimes fails, "Failed to generate" toast | A8.3, T2 | modal `generateMessage`; observed latency | SIM (latency observed in simulation) |
| 10 | "Call Parent" only shown when calling is configured; otherwise only WhatsApp copy | A3.2, T2 | modal `canCall = twilioConfigured && …` | IMPL (see finding F-1) |
| 11 | "Auto-call is not available for [language]. Use WhatsApp copy instead." warning | T2 | modal | IMPL (unreachable in practice: all 11 languages are mapped) |
| 12 | WhatsApp copy copies to clipboard, shows "Message copied!", logs an outreach record | A7.1, T5, T6 | modal `handleCopyWhatsApp` | IMPL (logging silently skipped on failure; see F-4) |
| 13 | Calling view labels "Calling...", "Ringing...", "Conversation in progress", "AI agent is talking with…", "[N] exchanges", "Summary will appear when the call ends" | A7.1, T6 | modal `CallingView` | IMPL |
| 14 | Failure labels "No answer", "Line was busy", "Call could not connect"; buttons "Try again", "Send on WhatsApp", "Close" | A7.1, T6, T7 | modal `SummaryView` | IMPL |
| 15 | Completed view: "Call completed", duration in whole minutes rounded up, exchanges, "Parent was [sentiment]"; sections Parent Response / Concerns Raised / Parent Commitments / Your Action Items / Guidance Shared with Parent / Follow-up Recommended; "View conversation transcript (N messages)" | A7.1, T6 | modal `SummaryView` | IMPL |
| 16 | Sentiment values cooperative/concerned/grateful/upset/indifferent/confused | A7.1, T6 | `types/attendance.ts CallSummary` | IMPL |
| 17 | "Generating summary...", "Call ended before a conversation could happen", "Summary isn't available for this call" | T6 | modal | IMPL |
| 18 | Summary only produced when transcript has ≥2 entries | A7.1 | `router.py _generate_call_summary` | IMPL |
| 19 | Modal polling stops after ~5 min; calls can last ~10 min; reopen to see result | T6 | modal `maxPolls=60`; `_MAX_CALL_SECONDS=600` | IMPL |
| 20 | Reopening Contact within 24 h resumes/shows the latest outreach | A7.2, A9, T2, T6 | `outreach-latest/route.ts` (24 h lookback) | IMPL |
| 21 | "Exchanges" count = transcript entries (both sides), not parent turns | T6 | `turnCount = len(transcript)` | IMPL (guides say "messages exchanged") |

### Rules and safeguards

| # | Claim | Guide(s) | Source | Status |
|---|---|---|---|---|
| 22 | Calling window 09:00–21:00 IST, every day; refused, not queued; message text quoted | A2, A6.3, T2, T7 | `src/lib/calling-hours.ts`; `call/route.ts` | IMPL |
| 23 | Window re-checked when the parent answers | (implicit) | `vobiz/answer/route.ts:71` | IMPL |
| 24 | Only the class-owning teacher can create outreach / call / view results | A3.1, A4.1, A5.3, T9 | `outreach/route.ts` (class `teacherUid`), `call-summary`, `outreach-latest`, `call/route.ts resolveOutreachTarget` | IMPL |
| 25 | Destination is the stored student phone, never client-supplied | A2, A4.2, A8.1 | `outreach/route.ts` F9-001; `call/route.ts` | IMPL |
| 26 | Plan: calling/outreach log need School Gold or School Premium (`hasAdvancedPlan`), checked per teacher | A3.2, A10, T2 | `outreach/route.ts`, `plan-utils.ts` | IMPL |
| 27 | Message drafting not available on Free | A3.2, A9 | `plan-config.ts` `'parent-message': 0` | IMPL (only when the subscription-gating flag is on) |
| 28 | 5-minute per-(teacher, student) dedup; only `failed` releases it; applies to WhatsApp copy too; error text "Recent outreach already exists for this student" | A2, A9, T7, T12 | `outreach/route.ts DEDUP_WINDOW_MS` | IMPL |
| 29 | Opt-out: phone-keyed suppression, applies to all teachers and siblings; refusal text quoted | A4.5, A8.1, T8 | `call-suppression.ts`; outreach + call routes | IMPL |
| 30 | Opt-out detected on a call and saved; future calls refused | A4.5, T8 | `router.py _persist_opt_out`, `flow.py _OPTOUT` | SIM (English); PHONE |
| 31 | Suppression lookup fails closed: "We could not check this parent's call preferences…" | T7 | `call-suppression.ts` | IMPL |
| 32 | No in-app way to view, add or remove a do-not-call entry | A3.1, A4.5, T8 | no UI/route found | IMPL |
| 33 | No school admin console for calling; `/admin` is platform-internal only | A3.1 | `src/app/admin/*` (cost, logs, system health) | IMPL |
| 34 | No outreach history screen (route exists, no UI consumer) | A3.1, A7.2 | `getOutreachHistoryAction` unused by components | IMPL |
| 35 | Statuses and mapping: busy=USER_BUSY; no_answer=NO_ANSWER/NO_USER_RESPONSE/TIMEOUT; failed=CALL_REJECTED/ORIGINATOR_CANCEL/invalid number; stale `initiated` >15 min → failed; engine failure → failed | A7.1, T6 | `vobiz/status/route.ts`; `reconcile-call-status.ts` | IMPL; carrier behaviour PHONE |
| 36 | Duplicate carrier events cannot change recorded duration | (implicit) | `writeCallStatus` | SIM |
| 37 | "Parent phone number is not callable" error | T7 | `call/route.ts` | IMPL |
| 38 | Student phone is a 10-digit Indian mobile; one number per student; language from student record (default Hindi in the form) | A3.1, A4.2, T12 | `student-manager.tsx` | IMPL |

### Voice agent behaviour

| # | Claim | Guide(s) | Source | Status |
|---|---|---|---|---|
| 39 | Recorded greeting "Namaste. This is an important message from your child's school." in parent's language | A2, T4, T5 | `call_prompts.json greeting`, `openers/*.ulaw` | IMPL; PHONE |
| 40 | Odia greeting is the Hindi recording | A6.1, T5 | `generate_openers.py LANG_KEYS` | IMPL |
| 41 | Assistant names school + teacher, checks it's the parent, then gives message | A2, T4, T5 | `prompt.py`, `flow.py KICKOFF_AFTER_OPENER` | SIM (English) |
| 42 | No persona name; never claims to be the teacher | A2, T5, T12 | `prompt.py WHO YOU ARE` | SIM |
| 43 | Says it's an assistant only if asked; up-front disclosure switch exists, default OFF | A3.2, A5.4, A10, T5 | `router.py disclose_ai()` | IMPL (switch); POLICY (decision) |
| 44 | Message delivered "essentially as written" | A2, T5 | `prompt.py STEP TWO` | SIM |
| 45 | Barge-in: parent can interrupt | A2, T5 | router | SIM |
| 46 | Never asks for money/OTP/bank details; no invented facts; stays on topic | A2, A8.1, T5 | `prompt.py HARD RULES` | SIM (instruction only; not guaranteed) |
| 47 | Busy parent → offer teacher call-back, end call | T5 | `prompt.py` | SIM (instruction) |
| 48 | Voicemail → short message then end | T5 | `prompt.py` | Not tested; PHONE |
| 49 | Goodbye spoken before hang-up | A2, T5 | `router.py _begin_close` | SIM; PHONE |
| 50 | Max ~10 min (600 s), ~6 parent turns, 45 s idle | A2, T5 | `router.py` constants | IMPL (defaults; env-overridable) |
| 51 | Two-way vs message-only delivery switch exists; default = all languages two-way | A3.2, A6.2 | `router.py is_two_way()` | IMPL (switch); POLICY (decision) |
| 52 | 11 languages supported for drafting and calling | A6.1 | `TWILIO_LANGUAGE_MAP`, `prompt.py _LANGUAGE_CODES` | IMPL; only English SIM; other languages PHONE |
| 53 | Assistant keeps the parent's language despite code-mixing | A6.1 | `prompt.py LANGUAGE` | SIM (English only) |
| 54 | AI sometimes re-introduces itself after interruption | A8.3, T5 | simulation observation | SIM |
| 55 | Engine failure recorded as failed call | A7.1 (Call could not connect) | `reconcileCallStatus engineFailure` | SIM |

### Data and privacy

| # | Claim | Guide(s) | Source | Status |
|---|---|---|---|---|
| 56 | Stored: outreach record, status, duration, transcript, summary, opt-out | A5.2, T9 | outreach route; `router.py _persist_transcript`, summary, opt-out | IMPL |
| 57 | Audio not stored by the bridge | A5.2, T9, T12 | no recording in router; Vobiz dial has no record param | IMPL (carrier-side practice POLICY) |
| 58 | Teacher name and school name come from teacher profile | A5.1 | `outreach/route.ts` | IMPL |
| 59 | Up to 3 recent assessments; marks only quoted on call if the parent asks | A5.1 | modal perf fetch; `prompt.py` | IMPL / SIM |
| 60 | Parent speech processed by a third-party AI speech service; location TBC | A5.3 | Gemini Live (`global` location) | IMPL; POLICY (residency; audit §10 Q3) |
| 61 | Retention, access beyond teacher, consent wording, DPDP notice, parent data requests | A5.4, T9 | none | POLICY |

---

## 2. Implementation findings that differ from the brief's expectations

| ID | Finding | Impact on guides |
|---|---|---|
| F-1 | "Call Parent" visibility depends on the **Twilio** environment variables being set (`/api/attendance/twilio-config`), even when the provider is Vobiz. Production reportedly has `TWILIO_PHONE_NUMBER` set, so it shows today, but removing Twilio config would hide the button. | Guides say "if you don't see Call Parent, calling is not switched on". Confirm. |
| F-2 | Message is **not editable**. Only Regenerate or re-run with a new note. | Guides state this. Brief expected "message generation/edit". |
| F-3 | Teacher never sees the **spoken** version actually used on the call. | Guides warn and tell teachers to check the transcript. Product decision needed. |
| F-4 | WhatsApp copy swallows outreach-save errors: on a Pro/Free plan or inside the 5-min dedup window, "Message copied!" / "Outreach logged for…" is shown even though nothing was logged. | Guides do not promise logging for WhatsApp. Text in UI is misleading. |
| F-5 | Plan errors are not friendly: Call shows toast "Call failed" with raw text **PREMIUM_REQUIRED**; Free-plan generation shows generic "Failed to generate". | Guides quote the raw text. |
| F-6 | **Try again** after No answer / Line was busy within 5 minutes is refused with "Recent outreach already exists for this student" (only `failed` releases dedup). | Guides tell teachers to wait 5 minutes. |
| F-7 | Out-of-hours refusal in `/api/attendance/call` happens **after** the outreach record was created and does **not** mark it failed. The record stays `initiated` → teacher is dedup-locked for 5 min, and reopening the modal within 15 min shows "Calling..." until it reconciles to failed ("Call could not connect"). | Not described in guides. Recommend a fix (mark not-dialled on OUTSIDE_CALLING_HOURS) before release. |
| F-8 | No call-history screen; only the latest outreach per student within 24 h is reachable. | Guides state this. |
| F-9 | No UI shows that a parent has opted out until a call is attempted (the `optedOut` field is not displayed). | Guides state the refusal message only. |
| F-10 | The calling view has no specific status for opt-out or voicemail; they appear as "Call completed". | Not mentioned; consider adding. |
| F-11 | The "never engaged" close cue tells a silent parent "the teacher's message has been delivered", but with the two-step opener the message is only given after the parent responds. Possible false statement to parent. | Guides avoid claiming this. Needs product/prompt review and a phone test. |
| F-12 | Legacy Twilio `inviteResponse` text says "press 2 to end the call"; the live bridge has no keypad escape. Not used on the Vobiz path. | Guides don't mention keypad. |
| F-13 | "Auto-call is not available…" warning is effectively unreachable (Odia maps to a Hindi code). | Mentioned in Teacher guide for completeness; may remove. |
| F-14 | Reason labels/descriptions are i18n keys; non-English UI will show translated labels. | Guides quote English labels. |

---

## 3. Must review before distribution

1. **Real-phone test** (audit §8 checklist) passed; then update every *(awaiting real-phone verification)* marker and the status boxes.
2. **Production deployment:** guides describe this branch. Confirm the reviewed bridge is what production runs before any school uses the guides.
3. **AI disclosure policy:** keep "only if asked" or switch to up-front disclosure. Update A3.2, A5.4, A10, T5, T12.
4. **Two-way vs message-only languages:** decide; update A6.1/A6.2. Non-English languages are untested.
5. **Consent and parent notice wording** (DPDP Act 2023), including whether calls state they are transcribed.
6. **Data retention** for transcripts, summaries, outreach records and opt-outs; parent access/deletion process.
7. **Access policy:** who besides the class teacher (school leaders, Sahayak staff, vendors) may see records.
8. **Data residency / third-party processing** statement for live speech processing (audit §10 Q3).
9. **Do-not-call operations:** reinstatement process; how to record off-call requests (no UI exists).
10. **Who may initiate calls** beyond the class teacher; per-day attempt limit placeholder in T7.
11. **Support contacts:** fill every `[...]` placeholder (school support, safeguarding lead, Sahayak support email/phone/hours, data-protection contact).
12. **Plan names and pricing** ("School Gold", "School Premium") confirmed with commercial team.
13. **Findings F-4, F-5, F-7, F-11** either fixed or explicitly accepted; guide wording adjusted.
14. **Carrier recording practices** and whether parents can call the number back.
15. **Sample conversation (T4)** re-checked against real call behaviour after the phone test.
16. **Translations:** if guides are translated, UI labels must match the translated UI.
17. Confirm **Odia greeting in Hindi** is acceptable to show schools, or render an Odia opener first.

---

## 4. Checks performed on the guides

- Re-read against code listed above.
- Searched both school guides for: `src/`, `.ts`, `.py`, `VOBIZ_`, `SAHAYAKAI_`, `TWILIO`, `Firestore`, `Cloud Run`, `sahayakai-telephony`, `Gemini`, `Vobiz`, `env`, `parent_outreach`, `call_suppressions`. Also `Pipecat`, `Exotel`. Result: **no matches** in either school guide (2026-10-09). The only code-like string in the guides is the UI error text `PREMIUM_REQUIRED`, which is quoted because teachers actually see it (finding F-5).
- Markdown: headings numbered 1–11 (Admin) and 1–12 (Teacher); tables have header separators; checklists use `- [ ]`.
- Export to .docx/.pdf: **skipped**. The repo has `jspdf` (runtime library) but no Markdown-to-docx/PDF pipeline or pandoc usage; creating one would need new tooling.
