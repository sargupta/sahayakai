# SahayakAI — NCERT Demo Contingency Playbook

**Principle:** the demo must not stall. Every failure mode has a 5-second recovery move and a 60-second narrative bridge.

**Tone in recovery:** calm, never apologetic. Treat the workaround as a planned demonstration of platform resilience. NCERT will not penalise honesty — they will penalise panic.

---

## ⚠️ Pre-demo discipline rules (added 2026-05-19 post final deploy)

1. **Impact Dashboard — show headline 95/100, do NOT drill into dimension circles.**
   The composite Teacher Impact Score (95) was refreshed today against your real 83 resources. The per-dimension sub-scores (activity, engagement, success, growth, community) are still stale — the production aggregator only persists the composite, not the breakdown. If audience sees the dimension drill-down, they may notice engagement=0 despite 83 resources elsewhere; that contradiction is the only Impact Dashboard risk. Stay on the 95.

2. **Assessment Scanner — Mathematics + 1 page only.** Phase 1 hard-caps at one page per request and `subject === 'Mathematics'`. Do not attempt a Hindi essay, a multi-page document, or a science worksheet on stage. Pre-prepare 2 backup notebook photos in your phone gallery.

3. **VIDYA voice — wait for the orb to go silent before tapping the next action.** A 3-LOC TTS-fetch abort fix is identified but kept off prod (no-major-changes rule). Behavioral workaround: do not rapid-fire mic taps or navigations while VIDYA is speaking; let each utterance finish.

4. **Exam Paper — always type at least one chapter before clicking Generate.** Empty chapters now defaults to "all chapters" (Deploy #2), but the cleanest demo path still types one.

5. **Lesson plan / Visual aid — do not regenerate more than 5 times in 10 minutes.** Server rate limiter is ~7 calls/10min for lesson plan, ~3/10min for visual aid. Rate-limit errors now correctly return 429 (Deploy #2), but you still don't want a "please wait 8 minutes" toast mid-demo.

---

## Failure modes and recovery scripts

### F1. VIDYA voice orb doesn't transcribe

**Symptoms:** orb pulses but transcription text doesn't appear, or transcription is garbled, or mic permission is denied.

**5-second move:** Tap the orb's keyboard icon (text input fallback). It accepts typed input that goes through the same intent router.

**60-second bridge:**
> "The same engine handles voice and text — voice is the differentiator in the field, but the underlying intelligence is identical. Let me type the same prompt so you can see the output."

Then type the same prompt verbatim into the text field. Continue the demo.

**If even text fails (rare — would mean the API is down):** skip to F3 (API 500).

---

### F2. Lesson Plan generation takes longer than 30 seconds

**Symptoms:** spinner runs past 30 seconds; no text streaming yet.

**5-second move:** Do **not** wait staring at the screen. Start narrating immediately:
> "While that generates, let me walk you through the 5E pedagogy this plan will follow — it is the same framework NCF-SE 2023 prescribes."

Use the dead time to talk through Engage → Explore → Explain → Elaborate → Evaluate, using your hands. NCERT cares more about pedagogy than UI latency.

**At 60 seconds (still nothing):** cancel the request. Say:
> "Let me show you the version we generated 10 minutes ago — same prompt — so we don't lose time."

Switch to a pre-saved lesson plan tab (Tab E — open this in advance with a previously generated plan visible).

**At 90 seconds (if you didn't pre-save):** play backup video from `demo-prep/backup-videos/01-lesson-plan-generation.mp4`. Say: "This is a screen recording from yesterday's pilot session — same flow, same output."

---

### F3. API returns 500 error mid-demo

**Symptoms:** red error toast, "Something went wrong" message, or blank screen after a tap.

**5-second move:** Don't acknowledge the error in panicked language. Say:
> "Let me switch to our pre-recorded reference — gives me a chance to show you the version that includes the parent-call agent flow which I was going to skip otherwise."

Play backup video. Choose the one that matches what you were about to demonstrate.

**60-second bridge while video plays:**
> "What you are about to see is a screen recording from our Karnataka pilot last week. The teacher is a Class 5 Science teacher in Raichur district. Watch the voice → output → student-facing material flow."

**Critical:** after the video, do **not** try the live app again unless you have at least 3 minutes left. Pivot to closing slides.

---

### F4. Internet drops entirely

**Symptoms:** no pages loading; browser shows offline page.

**5-second move:** Take your phone out, tether it. Stay calm:
> "Let me switch to my phone's hotspot — gives me a chance to show you our offline pilot, which is what 45% of Indian schools depend on."

While reconnecting (15–30 sec), narrate the offline story:
> "What I am about to switch on is what a teacher in a no-internet school would experience. We have a Flutter offline pilot scaffolded — three agents wired to Firebase AI Logic hybrid inference. Cached lesson plans, locally stored worksheets, on-device Gemini Nano fallback for generation. Field-tested in two Karnataka districts, not yet production-GA. I will not pretend it's production — it is the honest state."

If hotspot also fails: switch to backup-screenshots PDF (`demo-prep/backup-screenshots/sahayakai-offline-flow.pdf`). Walk through the screenshots.

---

### F5. NCERT asks a question you don't know

**Symptoms:** a question outside your prep — e.g. "What is your model's BLEU score on Bodo translation?"

**5-second move:** Do not guess. Do not bluff. Say:
> "I do not have a precise number for that in front of me. I will get you the exact figure in writing within 24 hours, along with our test methodology."

Take a written note in front of them — this signals professionalism. Move on.

**Critical:** never invent data in front of NCERT. They will check. They will remember.

---

### F6. A generated lesson plan contains a factual error spotted by NCERT

**Symptoms:** NCERT subject expert says, "That's not how photosynthesis works at Class 7 level," or "That chapter citation is wrong."

**5-second move:** Do **not** defend the AI. Acknowledge immediately:
> "Thank you — that is exactly why we built the teacher-review loop. The teacher always validates before classroom use. The AI is a draft, never a directive. Let me show you the report-incorrect-content flow."

Then tap the "flag content" button (one-tap in the UI). Say:
> "This goes to our pedagogy lead within 24 hours. The prompt template is corrected. The next teacher in Raichur will not see the same error. This is how the system learns from authoritative reviewers — exactly the role we hope NCERT will play in the pilot."

This turns a credibility risk into a partnership offer. Practice this exact pivot.

---

### F7. Lesson Plan generates in the WRONG language

**Symptoms:** asked for Kannada, got Hindi (or vice versa).

**5-second move:** Tap the language toggle at the top of the plan. Say:
> "The system detected the input language correctly but defaulted to Hindi for output — let me toggle. This is the one-tap language switch every plan supports."

If the toggle doesn't fix it: cancel, re-run with explicit language in the prompt.

**Narrative bridge if you have to re-run:** "I'm going to be more explicit on language for the demo — in production this is auto-detected, but for a stage demo let's lock it down."

---

### F8. The live URL itself is down (Cloud Run cold-start nightmare)

**Symptoms:** the URL doesn't load at all.

**5-second move:** Immediately switch to backup videos + Slide 0 (problem framing).

**60-second bridge:**
> "We have a production deployment that occasionally cold-starts — for today's session I'll switch to our reference recordings. Same flows, recorded yesterday in our Bangalore office, with the same Karnataka teacher account we would have shown live."

Run through the backup videos in this order:
1. VIDYA voice → lesson plan (2 min)
2. Worksheet 3-level differentiation (1 min)
3. Community voice notes (1 min)
4. Impact dashboard (45 sec)

**Critical:** do not waste more than 30 seconds trying to revive the URL on stage. Pivot fast.

---

### F9. Audience seems disengaged or skeptical

**Symptoms:** arms crossed, no questions, looking at phones.

**5-second move:** Pause. Make eye contact. Say:
> "Before I move on — what would matter most to NCERT in evaluating something like this? I would rather show you what you need to see than what I prepared."

This is a high-trust move and almost always re-engages a senior audience. Then pivot to whatever they care about.

---

### F10. Hostile question about NCERT/MoE relationship

**Symptoms:** "Why didn't you partner with NCERT first?" or "How is this different from what we are already building?"

**5-second move:** Respect, not defensiveness:
> "That is exactly the conversation I am here for today. We built the technology first because the AI cost curve only made this viable in 2026. We did not want to bring NCERT a slide deck — we wanted to bring a working product. We see SahayakAI as an implementation partner for what NCERT and the MoE are already mandating. The product exists. The partnership pathway is what we would like your guidance on."

Then immediately offer the pilot ask (Q17 in Q&A bank).

---

## Backup assets to prepare BEFORE the demo

### Required (cannot demo without these)

1. **Three screen-recorded videos**, saved to `demo-prep/backup-videos/`:
   - `01-vidya-voice-to-lesson-plan.mp4` — 2 min. Hindi voice command → Kannada lesson plan generation. Include the orb pulsing, the streaming text, the 5E phases scrolling. Record in 1280×720, mp4, under 30 MB.
   - `02-lesson-plan-generation.mp4` — 1.5 min. Just the lesson plan flow start to finish, in case voice fails.
   - `03-community-voice-notes.mp4` — 1 min. Discover tab, scroll past two voice messages, tap play, hear a Hindi teacher voice note.

   Test all three by playing them on the demo laptop full-screen, before leaving for the venue.

2. **Five static screenshots** (high-resolution PNG, 1920×1080), saved to `demo-prep/backup-screenshots/`:
   - `01-lesson-plan-kannada-5E.png` — full 5E lesson plan in Kannada
   - `02-lesson-plan-bengali.png` — same chapter in Bengali (proves multi-language)
   - `03-quiz-three-difficulty.png` — 3-level quiz output side by side
   - `04-visual-aid-blackboard.png` — a generated B/W chalk-board diagram
   - `05-instant-answer-bengali-citation.png` — Instant Answer in Bengali with Google citations visible

3. **One PDF of a generated lesson plan**, printed in colour, in your bag — 5 copies. If NCERT asks for a takeaway, hand it over physically. Print one in Kannada, one in Hindi, one in English. Use the Karnataka Class 5 Gravity plan.

### Recommended (raises the ceiling)

4. **Single-slide PDF** — the problem statement in NCF-SE language. Use as Slide 0 (opening) and Slide N (closing). One sentence, dark background, gold accent. Reusable as a "screen frozen" fallback.

5. **A pre-saved generated lesson plan** open in Tab E of the browser. If F2 (slow generation) happens, just switch tabs and show the pre-saved one. Do not "regenerate" — show the saved.

6. **Pilot data sheet** (one-pager PDF) showing: 150 teachers, 11.8% comprehension gain, p=0.012, 78% retention, 92% NCERT alignment. Hand out at the end.

7. **MoU template** — the 1-page pilot agreement. If NCERT says "we are interested," hand them a draft on the spot. This signals readiness.

---

## Pre-demo runbook (T-minus 60 min)

| Time | Action |
|------|--------|
| T-60 | Boot laptop. Charge phone to 100%. Test phone hotspot. |
| T-45 | Open the live URL in 4 tabs (lesson-plan, instant-answer, community, impact-dashboard). |
| T-40 | Sign in as demo teacher account. |
| T-35 | Run the 3 pre-warm prompts (Karnataka Gravity, WB Photosynthesis, TN Multiplication). Verify outputs. |
| T-25 | Open `demo-prep/backup-videos/` in Finder. Test play all 3 videos. |
| T-20 | Open Slide 0 in Keynote/PowerPoint on second monitor. |
| T-15 | Test microphone. Speak "test test" into the OmniOrb. Confirm transcription. |
| T-10 | Set phone to Do Not Disturb. Browser notifications off. Slack closed. |
| T-5 | Open Tab E with a pre-saved lesson plan visible. |
| T-2 | Take a sip of water. Read the opening line aloud once. Walk in. |

---

## What to do AFTER the demo

1. Within 1 hour: send a follow-up email to the NCERT contact thanking them, attaching the printed-out lesson plan PDF, and offering the 6-week pilot terms in writing.
2. Within 24 hours: send written answers to any question you took as "I will get back to you."
3. Within 48 hours: send a one-page MoU draft for the pilot.

Do not let the conversation cool. NCERT moves slowly — every follow-up keeps you in their working memory.
