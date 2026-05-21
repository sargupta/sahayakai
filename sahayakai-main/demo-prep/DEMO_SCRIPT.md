# SahayakAI — NCERT Demo Script (10 min + 5 min Q&A)

**Audience:** National Council of Educational Research and Training (NCERT), Ministry of Education
**Presenter:** Abhishek Gupta (Founder)
**Live URL:** https://sahayakai-hotfix-resilience-zwydpvyuca-as.a.run.app
**Format:** 10 min live demo · 5 min Q&A
**Register:** Formal, NCERT-appropriate. No startup jargon. No marketing aggression. Treat NCERT as the apex curriculum body — they helped write NEP 2020. We are not pitching disruption. We are pitching an implementation layer for their own mandate.

---

## Pre-demo checklist (do all of this 30 min before)

1. **Hard refresh the live URL** in two browser tabs:
   - Tab A: `/lesson-plan`
   - Tab B: `/community` (with the Discover tab visible)
2. **Sign in** as the demo teacher account (Karnataka, Class 5, Science).
3. **Run the pre-warm prompts ONCE each** so the semantic cache is hot:
   - "Class 5 Science, Gravity — Karnataka, Kannada"
   - "Class 7 Science, Photosynthesis — West Bengal, Bengali"
   - "Class 6 Mathematics, Money & Multiplication — Tamil Nadu, Tamil"
3. **Tab C (kept hidden until needed):** `/impact-dashboard` — preload so the chart renders.
4. **Tab D (hidden contingency):** local file `demo-prep/backup-videos/` open in Finder so a video can be dragged into screen-share within 5 seconds if the API stalls.
5. **Mic check:** speak "test" into the OmniOrb. Confirm transcription appears.
6. **Phone hotspot ON** as a fallback in case the venue WiFi drops.
7. **Slide 0 in PowerPoint** ready on a second monitor (Problem Statement framing — for opening 45 seconds and any "screen frozen" moment).

---

## 10-minute walkthrough

### 0:00 – 0:45 — Open with the problem in NCERT's own language

**What he says (English, formal register):**
> "Thank you for the time. NEP 2020 mandates mother-tongue instruction up to Grade 5, experiential pedagogy over rote, and technology-enabled teaching. NCF-SE 2023 codifies the 5E model. The mandate is in place. What is missing is the implementation layer at the teacher's elbow. India has 10.1 million teachers and, as of today, zero AI tools built natively for how they think, what they teach, and the language they speak. SahayakAI is that implementation layer. In the next ten minutes I will show you the working product across three NCERT-aligned classes in three Indian languages, and then I would like to discuss how NCERT might shape a pilot."

**What he taps:** Nothing. Stays on Slide 0 (one slide, one sentence: *"India has 10.1 million teachers and zero AI tools built natively for them. NEP 2020 mandates the shift. SahayakAI is the implementation layer."*).

**Audience sees:** Title slide.

**Language used:** English.

---

### 0:45 – 2:30 — VIDYA voice orb (the moat moment — Hindi → Kannada)

**What he says (transitioning):**
> "Every screen in SahayakAI carries an ambient voice assistant we call VIDYA. A teacher does not navigate menus — she speaks. Let me speak to VIDYA in Hindi first."

**What he taps:** Switches to Tab A (`/lesson-plan` is already loaded). Taps the **OmniOrb** in the bottom-right corner.

**What he speaks (Hindi, into mic) — PRE-WARM PROMPT 1:**
> *"Class 5 ke liye Vigyan padhana hai — Gurutvakarshan — Kannada mein, Karnataka State Board ke according. Coconut tree examples use karna."*
> ("I need to teach Class 5 Science — Gravity — in Kannada, aligned to Karnataka State Board. Use coconut tree examples.")

**Audience sees:**
- Orb pulses (listening state)
- Live transcription of his Hindi appears
- VIDYA routes to the Lesson Plan generator with pre-filled fields (Grade 5, Science, Kannada, Karnataka)
- A Kannada-language lesson plan begins streaming

**What he says (while generation streams, ~15–20 sec):**
> "Notice three things. One, the teacher gave the instruction in Hindi but the output is in Kannada — the student's medium of instruction. NEP 2020, Para 4.11. Two, the lesson follows the 5E model — Engage, Explore, Explain, Elaborate, Evaluate — which is the pedagogical scaffold NCF-SE 2023 prescribes. Three, the worked example uses falling coconuts, not falling apples — because the student in Raichur has never seen an apple tree. This is what we mean by *cognitive sovereignty*: the AI is not translating English thinking into Kannada. It is thinking in Kannada."

**Mid-stream switch (THE MOMENT):** He taps the orb again and says, in **Kannada**:
> *"Idakke ondu chikka activity sluchchisi — chalk-board mele madabahudaadanthadu."*
> ("Suggest one short activity that can be done on a chalkboard.")

**Audience sees:** A chalk-and-board activity appended in Kannada (no smart board needed). This proves the `resourceLevel: low` adaptation.

**Language demonstrated:** Hindi (input) → Kannada (output) → Kannada (follow-up).

---

### 2:30 – 5:00 — Lesson Plan deep-dive (5E + hyperlocal context)

**What he says:**
> "Let me walk through what the system produced. NCF-SE 2023 prescribes the 5E model. Every plan SahayakAI generates follows the same structure."

**What he taps:** Scrolls slowly through the generated Kannada lesson plan. Pauses at each 5E phase.

**Talking points at each phase (he reads from the screen, then narrates in English):**

- **Engage (ಆಕರ್ಷಿಸಿ):** "Drop a coconut from arm height. Ask: *why did it fall down and not up?* — 90-second hook, zero materials beyond the coconut on the school's tree."
- **Explore (ಅನ್ವೇಷಿಸಿ):** "Two-student pairs. Drop a small stone and a leaf from the same height. Observe. Discuss." (No projector required.)
- **Explain (ವಿವರಿಸಿ):** "Teacher introduces *gravity* — defined in Kannada — and the term ಗುರುತ್ವಾಕರ್ಷಣೆ — with the NCERT Class 5 EVS Chapter 11 reference."
- **Elaborate (ವಿಸ್ತರಿಸಿ):** "Why coconuts fall faster after rain. Why a boat does not 'fall' when floating. Connects gravity to floating, which is the next chapter."
- **Evaluate (ಮೌಲ್ಯಮಾಪನ):** "Three exit-ticket questions, two of them oral — because half the class cannot yet read at grade level. Differentiated for the FLN reality."

**What he says (closing this segment):**
> "This is what twelve minutes of generation produces. The teacher walked into this class with no preparation. She now has a plan that follows NCF-SE pedagogy, references the correct NCERT chapter, accommodates the FLN gap, and does not require a single rupee of materials. Cost to the system: ₹0.50 per generation. The same plan in Tamil, Bengali, Telugu, Hindi, Marathi, Gujarati, Punjabi, Malayalam, Odia, or English is one tap away."

**Language demonstrated:** Output read aloud in Kannada (transliterated for the audience), narrated in English.

---

### 5:00 – 6:30 — Assessment Scanner (the one card DIKSHA's chatbot cannot match)

**Why this slot:** DIKSHA already generates lesson plans, quizzes, and question banks via its Grades 1–12 chatbot. What it does NOT do is grade student work. This segment is the clearest single demonstration of value-add over DIKSHA. The Worksheet Wizard moment is preserved in the Q&A bench as a backup if NCERT explicitly asks about differentiated content.

**What he says:**
> "Content generation is half the teacher's loop. The other half is grading. ASER 2024 shows that 55% of Class V students cannot read at Class II level — and the average government teacher grades 60+ student notebooks per day, by hand, often after school hours. Watch what happens when she lets the AI see the page."

**What he taps:** Navigates to `/assessment-scanner` (sidebar → Assess group → Assessment Scanner).

**What he physically does (the visceral part):**
- Picks up a printed Class 5 Mathematics worksheet with one student's handwritten answers (prepared in advance, kept on the desk — sample has 4 questions on multi-digit addition with method working shown).
- Taps the camera icon. Phone camera opens. Takes one photo of the page.
- Selects: Grade = Class 5, Subject = Mathematics, Language = Kannada, NCERT Chapter = "Addition and Subtraction" (auto-suggested from grade+subject dropdown).
- Taps **Assess**.

**Audience sees (over ~20 seconds of two-pass AI):**
- **Pass 1 (extraction, ~10s):** The page renders side-by-side. Left: the photo. Right: a transcribed list of questions and answers — `1. 247 + 358 = 605 ✓`, `2. 1086 + 749 = 1835 ✓`, `3. 5604 + 2387 = 7891 ✗ (carry-over slip in hundreds)`, `4. [BLANK]`.
- **Pass 2 (grading, ~10s):** Per-question scores appear. Total: 6/8. A `needsTeacherReview` flag fires on Q4 because handwriting confidence is below 0.8. The teacher note in Kannada says: *"ಚೆನ್ನಾಗಿದೆ — ಆದರೆ ಪ್ರಶ್ನೆ 3 ರಲ್ಲಿ ನೂರರ ಸ್ಥಾನದಲ್ಲಿ ಕ್ಯಾರಿ-ಓವರ್ ಬಿಟ್ಟು ಬಿಟ್ಟಿದ್ದಾಳೆ. ಒಮ್ಮೆ ಸ್ಥಾನ ಬೆಲೆ ಮತ್ತೆ ನೋಡೋಣ."* ("Good — but in Question 3 she missed the carry-over in the hundreds place. Let's look at place value once more together.")

**What he says (45 sec, this is the punchline):**
> "Twenty seconds. The teacher has not opened a single notebook. The AI has not just marked right or wrong — it has identified the *pedagogical error*, named it correctly in the language of instruction, and given the teacher one specific, actionable conversation to have with this child. Note also: the AI itself flagged Question 4 as low-confidence — it has refused to grade what it cannot read. That is the difference between an AI that helps a teacher and an AI that replaces her judgment."

**Two NCERT-relevant follow-on lines:**
> "At scale: 60 students × 4 questions × 30 seconds of teacher time saved per question = 2 hours per teacher per day returned to actual teaching. That is the policy-level number."
>
> "And every assessment becomes a data point. We can roll these up — student → class → school → district — into exactly the kind of VSK-style learning-outcome heatmap the Ministry has been asking for. This is not just a feature, Sir/Ma'am. This is the missing input pipe for Vidya Samiksha Kendra."

**Languages demonstrated:** English narration, Kannada feedback in the AI output, English audience explanation.

**Demo-day discipline:**
- Photo MUST be taken before stage time of a clean, well-lit sample notebook page. Pre-photograph at least 2 backups in `/tmp` or device gallery in case live photo fails or app camera permission glitches.
- Sample sheet should have: 1 perfect answer, 1 perfect answer, 1 deliberately-introduced carry-over error, 1 deliberately blank or unreadable answer. This shape produces the most teachable demo output (variety + the confidence-flag moment).
- Stick to Mathematics + Class 5/6/7. Phase 1 explicitly caps at 1 page, Mathematics only — DO NOT attempt to grade a Hindi essay or a multi-page document.
- If the API takes more than 25 sec total, narrate the two-pass architecture while audience waits: *"Pass one extracts what the student wrote. Pass two grades it against the NCERT chapter context. Clean failure boundaries — we never conflate OCR errors with grading errors."*
- If the API errors mid-grade, fallback contingency F2 (lesson plan stall) applies — pivot to the saved screen recording of a prior successful scan.

---

### 6:30 – 7:45 — Instant Answer + Community peer voice notes

**What he says:**
> "Two more capabilities, briefly. First — when a student asks a question the teacher does not have a clean answer for, Instant Answer is grounded in Google Search and returns a factual answer with citations, in the teacher's language."

**What he taps:** Tab B (`/instant-answer`). Types or speaks into the orb (English, switching style):
> *"Why does the moon look bigger near the horizon? — answer in Bengali, for Class 7 students, with one Bengali analogy."*

**Audience sees:** A short, Bengali-language explanation with source links (Google grounding). Includes one *Sundarbans*-rooted analogy (e.g., the way a fishing boat looks bigger near the riverbank than mid-river).

**What he says (transitions to Community):**
> "Second — even the best AI cannot replace what a teacher in Bellary discovers in her own classroom. Community is where she shares it."

**What he taps:** Tab B switches to `/community`. Lands on the **Discover** tab. Scrolls past two Hindi-language voice notes from real pilot teachers (or seed data).

**What he says:**
> "These are voice messages, not text. A teacher records once in her language and another teacher in another district plays it back. This is peer-to-peer professional development — what Harvard Kennedy School called the 'pedagogical isolation gap' in their 2026 Maharashtra study. We close it with one tap."

**Language demonstrated:** Bengali (output) → Hindi (community voice notes).

---

### 7:45 – 9:00 — Marks, attendance, parent outreach (the admin half)

**What he says:**
> "Pain Point Two from our problem statement is administrative overload. UNESCO 2023 — 60% of Indian teachers cite admin work as their number one stress factor. Let me show three flows briefly."

**What he taps (rapid, 20 sec each):**

1. **Attendance:** Opens `/attendance` (with a pre-seeded class). Taps **mark all present**, then unticks two absentees. "60 seconds, no paper."
2. **Marks:** Opens `/attendance` (marks tab if present) or impact-dashboard for grade trends. Shows a sample class entry view. "Same speed."
3. **Parent outreach:** Opens the **parent call agent** trigger UI. *Does NOT place a live call.* Says:
   > "If I tap *call parent*, an AI agent calls the parent's phone in the parent's preferred language, reads out the child's weekly progress, and asks if they have any questions. The transcript is logged. We do not show the live call today because the demo is not the right setting to test someone's phone — but the agent is wired and we are happy to run a pilot call into a NCERT-nominated parent number if useful."

**What he says (closes admin section):**
> "Across these three flows the teacher just recovered roughly 90 minutes of her week. Multiply that by 10 million teachers and that is the 2.5 billion teacher-hours that NITI Aayog estimates we lose to admin work each year."

**Then opens Tab C — `/impact-dashboard`:**

**What he says:**
> "And NITI Aayog's outcomes-based procurement framework asks: where is the evidence? This is the Teacher Impact Score. It is real, computed per teacher per week. In our Karnataka pilot, 150 teachers, 24% increase in observed student engagement, 11.8% comprehension gain, p = 0.012. The dashboard is built so a state department can monitor outcomes at district and block level in the same view."

**Language demonstrated:** English UI (admin flows are English-language for administrative compliance — explain this honestly: government records are kept in English/Hindi).

---

### 9:00 – 10:00 — Close: 11 languages, NCF alignment, NCERT pilot ask

**What he says (close, no more clicks):**
> "Let me close with what SahayakAI is and what it is not.
>
> *What it is:* a teacher-facing implementation layer for NEP 2020 and NCF-SE 2023. Eleven Indian languages live, twenty-two on the roadmap with Sarvam AI. NCERT, CBSE, ICSE, and twenty-eight state boards mapped. Built to function on a ₹6,000 smartphone with 2 GB RAM. Pilot-validated with 150 teachers in Karnataka — 88% reduction in lesson prep time, 92% NCERT chapter alignment, 78% three-month retention.
>
> *What it is not:* it is not a content platform. It is not a replacement for DIKSHA or NISHTHA — it is complementary. DIKSHA hosts content; SahayakAI generates and contextualises content. NISHTHA trains teachers in modules; SahayakAI supports them every day in the classroom.
>
> *What we are asking NCERT for:* a pilot. Forty teachers across two NCERT-affiliated demonstration schools, six weeks, jointly designed. NCERT defines the success metrics. NCERT validates the curriculum alignment. We provide the platform, the language coverage, the training, and the outcomes data. At the end we share the dataset — anonymised, DPDP-compliant — with the Department of Educational Research. If the pilot meets the bar, we discuss a state-board rollout pathway with NCERT's blessing.
>
> Thank you. I'd welcome your questions."

**What he taps:** Returns to Slide 0 / closing slide (a single slide showing: *Pilot ask — 40 teachers, 2 demo schools, 6 weeks, NCERT-defined metrics*).

**Language demonstrated:** English (formal close).

---

## Pre-warm prompts (THE EXACT STRINGS — use these, the cache is hot)

| # | Tool | Language | Exact prompt |
|---|------|----------|--------------|
| 1 | VIDYA voice → lesson-plan | Hindi → Kannada | *"Class 5 ke liye Vigyan padhana hai — Gurutvakarshan — Kannada mein, Karnataka State Board ke according. Coconut tree examples use karna."* |
| 2 | Lesson-plan (back-up) | Bengali | "Class 7 Science, Photosynthesis — West Bengal Board, in Bengali. Use paddy field examples." |
| 3 | Worksheet 3-level | Kannada | *"Idakke moodu mattagalalli worksheet madidiri — kelivara, madhya, mele matt."* |
| 4 | Instant Answer | English → Bengali | "Why does the moon look bigger near the horizon? — answer in Bengali, for Class 7 students, with one Bengali analogy." |
| 5 | Lesson-plan (TN backup) | Tamil | "Class 6 Mathematics, Money and Multiplication — Tamil Nadu State Board, in Tamil. Use kirana-shop examples." |

If a generation stalls, switch to the next pre-warmed prompt immediately. Do not generate something the cache has not seen.

---

## Three riskiest moments (and what to do)

1. **VIDYA voice transcription fails on stage** (mic permission denied / accent miss). → Tap the orb's **text input** fallback (it accepts typed input). Say: "Let me show you the text path for this — same engine, same result." Do not break flow.

2. **Lesson Plan takes >30 seconds.** → Don't wait. Pivot: "While that generates, let me walk you through what 5E means and why this matters for NCF-SE compliance." Use the time to talk pedagogy. If still stalled at 60 seconds, kill the request and play the backup video (Tab D).

3. **NCERT asks a curriculum-accuracy challenge mid-demo** ("does this match the NCERT Class 5 EVS chapter?"). → "Yes — let me show you the citation." Scroll to the bottom of the lesson plan where the NCERT chapter reference is printed. If it's wrong, say: "Thank you, this is exactly what the teacher-review loop is for — the teacher always validates before classroom use. Let me capture that and we will correct the alignment data within 24 hours."

---

## Tone and language rules (NON-NEGOTIABLE)

- **No marketing jargon.** No "disrupt", "weaponize", "10x", "unicorn", "Bharat-native" buzzwords.
- **NCERT is the apex curriculum body.** They wrote NCF-SE 2023. We are not teaching them pedagogy — we are implementing it.
- **No criticism of DIKSHA or NISHTHA.** Both are MoE assets. We are complementary, not competitive.
- **Teachers are respected.** Never imply Indian teachers are the problem. They are unsupported, not unskilled.
- **Acknowledge gaps honestly.** Offline is a pilot, not GA. Sarvam AI integration is on roadmap, not shipped. 22 languages is a roadmap number, 11 is live.
