# Building Block Governance for India's Education AI

### A Capability-by-Capability Recommendation, Grounded in SahayakAI

**Prepared for:** Policy and standards readers (Ministry of Education, NCERT, SCERTs, MeitY / IndiaAI, state education departments)
**Date:** 6 June 2026
**Status of this document:** Working chapter for the SahayakAI book. Every capability below is verified against the live codebase. Maturity is stated honestly; nothing aspirational is presented as shipped.

---

## How to read this chapter

A short question to begin. If India is going to place artificial intelligence into the hands of one crore teachers, what exactly should the country require of the tools that reach the classroom?

This chapter answers that question in an unusual way. Rather than argue principles in the abstract, it walks through the actual capabilities of one working system, SahayakAI, and treats each capability as a worked example of a governance choice. Some choices are exemplary and worth mandating for every vendor. Some are honest works in progress. A few are gaps that the country's emerging rules should require all vendors, including this one, to close. Presenting all three categories openly is itself the point: trustworthy education AI is built in daylight.

Each capability is presented as a standard card with seven fields:

1. **Capability.** What it is, in one line.
2. **What it does.** The mechanics, as they exist in the code today.
3. **Why it matters for Indian education.** The systemic condition it addresses.
4. **Governance principle.** The instrument it speaks to: NEP 2020, NCF 2023, the DPDP Act 2023, the IndiaAI Mission, NDEAR, or the UNESCO Guidance on Generative AI in Education and Research (2023).
5. **Risk it raises.** The honest failure mode a regulator would ask about first.
6. **How the design answers it.** The safeguard already built, or the absence of one.
7. **Maturity.** Shipped, Beta, or Scaffolded.

A legend for maturity:

- **Shipped.** In production, used by real teachers today.
- **Beta.** Functional and live, but still hardening or behind a controlled rollout.
- **Scaffolded.** Built far enough to demonstrate, not yet production-grade. Stated plainly so that nobody mistakes a demonstration for a guarantee.

The capabilities are organised into six governance themes. Each theme closes with the recommendation it suggests for national policy. A final section consolidates the recommendations and names, without flinching, the gaps that the country's rules should require every vendor to close.

---

## Theme A. Pedagogical Sovereignty

Two questions frame this theme. When an AI writes a lesson for an Indian classroom, whose curriculum is it serving? And when it suggests a teaching aid, does it assume a projector and a laboratory, or a piece of chalk and a shared blackboard?

India already answers the first question through the NCERT and state board curricula and through NCF 2023. The recommendation here is that any AI which generates instructional content be required to ground that content in those national frameworks rather than in a generic, foreign-trained default. SahayakAI's content engines are the worked example.

### A1. Lesson Plan Generator

**What it does.** Generates a structured lesson plan using the 5E model (Engage, Explore, Explain, Elaborate, Evaluate) from a free-text topic or a photograph of a textbook page. It accepts grade, language, resource level (low, medium, high), and difficulty. A deterministic step, `auditMaterials()`, cross-checks every activity against the materials list so that a low-resource plan never silently assumes equipment the school does not have. A soft validator, `validateChapterForFlow()`, flags and where confident auto-corrects a mismatched class, subject, and chapter triple to the canonical NCERT chapter, surfacing a warning rather than blocking. A regional context block defaults to pan-India examples and overrides with state-specific crops, rivers, and festivals when the teacher's profile carries a state. Source: `src/ai/flows/lesson-plan-generator.ts`.

**Why it matters.** Roughly 1.18 lakh schools in India are single-teacher establishments, where the teacher has effectively zero dedicated preparation time. A plan that arrives already mapped to the right chapter and already costed for a chalk-and-blackboard room removes the highest-friction part of the day.

**Governance principle.** NEP 2020 (competency-based learning, teacher capacity), NCF 2023 (curricular alignment), NDEAR (curriculum as shared infrastructure).

**Risk it raises.** A generative model can invent an activity that needs materials the school lacks, or quietly drift to a chapter that is not on the syllabus.

**How the design answers it.** The materials audit is deterministic, not a second guess by the model. Curriculum alignment is checked against an NCERT map and surfaced as a visible warning, so the teacher remains the decision-maker. The default cultural context is Indian rather than Western.

**Maturity.** Shipped.

### A2. Worksheet Wizard

**What it does.** Takes a photograph of the teacher's own textbook page plus a short instruction and produces a worksheet with objectives, three to eight mixed activities, an answer key, per-activity pedagogical notes, and blackboard notes. A deterministic validator, `worksheet-validation.ts`, runs a Bharat-first check that rejects culturally out-of-place references (for example a list including dollar, elevator, subway, snowfall) and discards hollow explanations under twenty characters. Source: `src/ai/flows/worksheet-wizard.ts`.

**Why it matters.** Building a worksheet from the teacher's existing textbook keeps the content inside the syllabus the class is actually using and avoids copyright exposure from importing outside material.

**Governance principle.** NCF 2023 (contextual learning), UNESCO Guidance (human oversight, age-appropriate content).

**Risk it raises.** Culturally foreign examples that a rural child cannot connect to, and filler text that looks complete but teaches nothing.

**How the design answers it.** The Westernism check and the minimum-substance check are deterministic gates, repeatable and debuggable, not left to the model's discretion.

**Maturity.** Shipped.

### A3. Quiz Generator

**What it does.** Produces three parallel quiz variants (easy, medium, hard) in one request, with a grade-adaptive default question count (five for Classes 1 to 5 rising to twenty for Classes 11 to 12). It enforces an absolute language lock, supplies plausible misconception-based distractors, and runs the same deterministic Westernism and schema validation as the worksheet. Source: `src/ai/flows/quiz-generator.ts`, `quiz-definitions-enhanced-validation.ts`.

**Why it matters.** Differentiation in a multi-grade room is otherwise a manual burden. Three calibrated difficulty levels in a single step let one teacher serve several cohorts at once.

**Governance principle.** NEP 2020 (competency assessment), NCF 2023 (assessment as learning).

**Risk it raises.** Vocabulary above the child's grade, code-mixed output, or nonsense answer choices.

**How the design answers it.** A grade-band label is injected into the prompt to hold vocabulary down, the language lock is explicit, and an enum-and-list validator rejects malformed question types and out-of-place references.

**Maturity.** Shipped.

### A4. Exam Paper Generator

**What it does.** Generates a full board-pattern paper (CBSE, ICSE, or state) from a board, grade, subject, and selected chapters. It hard-codes the board's official section structure, duration, and marks distribution, blends roughly seventy percent previous-year questions with thirty percent fresh items, tags every question with its source (for example "PYQ 2021" or "AI Generated"), and validates chapter selections against the NCERT map. Source: `src/ai/flows/exam-paper-generator.ts`.

**Why it matters.** Producing a blueprint-faithful paper by hand is slow and error-prone, and a paper that drifts from the official pattern can disadvantage students at the board exam.

**Governance principle.** NCF 2023 (board examination reform), NEP 2020 (standardised, fair assessment).

**Risk it raises.** Plagiarised question banks, fabricated facts in questions, or a paper that silently violates the board blueprint.

**How the design answers it.** Provenance is tracked per question so adapted previous-year items are attributed rather than passed off as original. The blueprint is a deterministic constraint, not a suggestion. The prompt explicitly forbids altering the correctness of any question, and the marking scheme gives the teacher a step-wise basis to verify.

**Maturity.** Shipped.

### A5. Rubric Generator

**What it does.** Builds a four-level rubric (Exemplary, Proficient, Developing, Beginning) from an assignment description, with measurable level descriptions and a language lock. Source: `src/ai/flows/rubric-generator.ts`.

**Why it matters.** Consistent, transparent grading criteria are a precondition for fair assessment across schools and across teachers of differing experience.

**Governance principle.** NCF 2023 (transparent assessment), NEP 2020 (criterion-referenced evaluation).

**Risk it raises.** Vague, subjective descriptors that defeat the purpose of a rubric.

**How the design answers it.** The prompt requires objective and measurable language, and the schema validates that all levels and descriptions are present.

**Maturity.** Shipped.

### A6. Visual Aid Designer

**What it does.** Generates a black-and-white, chalk-on-blackboard educational illustration with labels rendered in the teacher's own script (Devanagari, Bangla, Tamil, and so on, never transliteration), accompanied by a pedagogical context note and a discussion-starter question. A rate limit caps usage because image generation is the most expensive operation in the system. Source: `src/ai/flows/visual-aid-designer.ts`.

**Why it matters.** A teacher with no drawing skill and no printer can still place an accurate, labelled diagram on the board, in the language of instruction.

**Governance principle.** NCF 2023 (visual and experiential learning), UNESCO Guidance (equity of access).

**Risk it raises.** An inaccurate diagram, label text corrupted into the wrong script, and runaway cost.

**How the design answers it.** Labels are language-locked to the native script. Cost is bounded by a per-user daily rate limit. Visual accuracy remains a human-in-the-loop matter: the aid is supplementary, and the teacher reviews before use.

**Maturity.** Shipped.

### A7. Virtual Field Trip Planner

**What it does.** Builds an itinerary of three to five Google Earth stops, each carrying an educational fact, a reflection prompt, and a mandatory cultural analogy that ties a distant place to something an Indian student already knows. A deterministic validator requires the analogy (minimum fifteen characters) and checks that each link is a genuine Google Earth URL. Source: `src/ai/flows/virtual-field-trip.ts`, `virtual-field-trip-validation.ts`.

**Why it matters.** Physical field trips are out of reach for most schools. A free, immersive substitute anchored in the child's own geography brings the world into a room that cannot afford a bus.

**Governance principle.** NCF 2023 (experiential learning), NEP 2020 (zero-cost enrichment).

**Risk it raises.** Foreign content with no bridge to the student's lived experience, or broken links.

**How the design answers it.** The cultural analogy is a required, length-checked field, and the URL format is validated deterministically.

**Maturity.** Shipped.

### A8. Avatar Generator

**What it does.** Produces a deterministic, photorealistic teacher headshot from a name, defaulting to Indian ethnicity and respecting gender cues, with a strict one-per-day rate limit. Source: `src/ai/flows/avatar-generator.ts`.

**Why it matters.** Identity and belonging matter for adoption. A teacher who sees themselves represented engages more readily than one facing a faceless console.

**Governance principle.** UNESCO Guidance (inclusion and representation).

**Risk it raises.** Homogenised or skewed representation, and cost abuse.

**How the design answers it.** The prompt explicitly seeks regional and gender diversity rather than a single default face, and a daily rate limit bounds cost.

**Maturity.** Shipped.

> **Recommendation A.** India should require that any AI which generates instructional or assessment content be grounded in NCERT, state board, and NCF 2023 frameworks by design, expose a visible curriculum-alignment signal to the teacher, and default to the cultural and resource context of the Indian classroom rather than a foreign one. Deterministic, auditable checks, not model discretion alone, should enforce this grounding.

---

## Theme B. Linguistic Equity

A question first. In a country with twenty-two scheduled languages, is it acceptable for a teacher's experience of an AI tool to be excellent in Hindi and English and visibly poorer in their own mother tongue?

India's answer, through NEP 2020's emphasis on mother-tongue and multilingual instruction, should be no. SahayakAI demonstrates both how far a small team can take multilingual parity and, just as usefully, exactly where the parity breaks. Both halves of that picture are instructive for policy.

### B1. Multilingual User Interface

**What it does.** The interface renders in eleven languages: English plus Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi, and Odia. Every label resolves to native script with no English fallback in the navigation, command palette, or empty states. Source: `src/context/language-context.tsx`.

**Why it matters.** A teacher should not need English literacy as the price of admission to a teaching tool. Native-script UI removes that toll.

**Governance principle.** NEP 2020 (multilingualism, mother-tongue instruction), NDEAR (multilingual public infrastructure).

**Risk it raises.** Partial coverage, where some screens silently revert to English.

**How the design answers it.** A completeness audit removed English fallbacks from the core surfaces, so the eleven-language claim is accurate for the UI.

**Maturity.** Shipped.

### B2. Voice-First Interaction (VIDYA Assistant)

**What it does.** A persistent floating microphone orb (the OmniOrb) connects to a conversational agent that detects the teacher's spoken intent and navigates to the right tool. It tolerates natural code-switching, the Hinglish and Benglish that bilingual teachers actually speak. Source: `src/ai/flows/vidya-assistant.ts`, `src/components/omni-orb.tsx`.

**Why it matters.** For a teacher whose comfort is in speech rather than menus and typing, voice is not a convenience feature, it is the difference between using the tool and abandoning it.

**Governance principle.** NEP 2020 (accessibility), UNESCO Guidance (lowering barriers to access).

**Risk it raises.** The intent-classification model is English-trained, so pure-mother-tongue commands from low-English teachers may be classified less reliably, and no per-language accuracy benchmarks are yet published.

**How the design answers it.** Code-switched input is explicitly accommodated and recent intent-collision hardening exists, but the honest position is that real-world mother-tongue robustness is not yet benchmarked. This is named, not hidden.

**Maturity.** Beta.

### B3. Speech Recognition (Dual-Provider ASR)

**What it does.** Speech-to-text uses Sarvam AI as the primary engine for Indian languages, with a Gemini-based fallback. All eleven languages are covered by the primary provider. Source: `src/lib/sarvam.ts`, `src/lib/sidecar/voice-to-text-client.ts`.

**Why it matters.** Accurate transcription of Indian-accented and code-switched speech is the gate to every voice workflow.

**Governance principle.** NEP 2020 (linguistic inclusion), IndiaAI Mission (indigenous language models).

**Risk it raises.** Accuracy for lower-resource languages such as Odia, Telugu, Marathi, and Punjabi is under-benchmarked relative to Hindi and English, and the fallback engine is English-optimised, so a provider outage can hand a Tamil or Odia teacher an English-tuned recogniser.

**How the design answers it.** The dual-provider design favours an Indic-specialist engine first and fails over rather than failing silent. The benchmark gap is acknowledged.

**Maturity.** Shipped, with a known fallback asymmetry.

### B4. Speech Synthesis (Stratified TTS)

**What it does.** Text-to-speech uses Sarvam's Indic voices first, with Google Cloud TTS as fallback. The fallback quality is stratified by language: Hindi and English receive premium Neural2 voices, seven languages receive mid-tier Wavenet voices, Telugu and Marathi receive the lowest Standard tier, and Odia has no native Google voice at all and is read phonetically through a Hindi voice. Source: `src/app/api/tts/route.ts`.

**Why it matters.** This is the clearest equity gap in the system, and the most useful one for policy. An Odia teacher hearing their content in a Hindi voice is a precise, measurable instance of the inequity that national language-technology policy exists to correct.

**Governance principle.** NEP 2020 (mother-tongue parity), IndiaAI Mission (Bhashini and indigenous voice models), UNESCO Guidance (equity).

**Risk it raises.** Unequal quality of experience by language, with speakers of lower-resource languages receiving a visibly poorer service.

**How the design answers it.** The Indic-specialist provider narrows the gap, and every fallback is logged so that demand for better Odia and Telugu voices is measurable rather than invisible. The gap itself remains and is named.

**Maturity.** Shipped, with a documented and honestly disclosed quality gradient.

> **Recommendation B.** India should set a language-parity standard for education AI: a baseline quality of recognition and synthesis that every scheduled language is entitled to, with public per-language benchmarks. Where a vendor cannot meet parity, the shortfall should be disclosed to users and the vendor should be expected to integrate national language assets such as Bhashini as they mature. Parity should be a measured, reported metric, not a marketing claim.

---

## Theme C. Human-in-the-Loop and Output Safety

A question. When an AI grades a child's paper or answers a teacher's question, who is accountable for the answer, and what stops the machine from being confidently wrong?

This theme is where SahayakAI's architecture is strongest, and where its design embodies a principle that national rules should make mandatory: deterministic logic must wrap probabilistic output, and the teacher must remain the decision-maker.

### C1. The Deterministic Validation Layer

**What it does.** A cross-cutting pattern: most generative flows have a sibling validator file that runs repeatable, non-AI checks on the model's output before it is trusted. These checks enforce schema completeness, reject culturally inappropriate content, require pedagogical grounding, and, critically, catch hallucination on blank inputs. The checks are regular expressions and list lookups, so they are repeatable and debuggable. Source: `*-validation.ts` across `src/ai/flows/`.

**Why it matters.** The defining failure of generative AI in a classroom is confident fabrication. A deterministic gate is the cheapest and most reliable defence against it, and it adds no model cost.

**Governance principle.** UNESCO Guidance (human oversight, validity), IndiaAI Mission (safe and trusted AI), NEP 2020 (teacher as professional decision-maker).

**Risk it raises.** Silent, plausible-looking wrong output reaching a child.

**How the design answers it.** The validation layer is load-bearing, not cosmetic. It is the structural reason the teacher can trust a draft enough to review it quickly rather than rebuild it.

**Maturity.** Shipped.

### C2. Assignment Assessor (Single-Page Grading)

**What it does.** Grades one handwritten assignment from a photograph through a five-stage pipeline: literal transcription, a blank-page presence check, scoring against a rubric, per-criterion feedback that cites the transcript, and a summary the teacher can read aloud. Transcription marks empty regions as [BLANK] and unreadable text as [???] and never invents content. A deterministic guard force-zeroes any non-zero score on a page that transcribes as blank and lowers the confidence. Source: `src/ai/flows/assignment-assessor.ts`, `assignment-assessor-validation.ts`.

**Why it matters.** Daily formative feedback is where learning is won or lost, and it is also the most time-consuming task a teacher faces. Faster feedback that the teacher still controls expands the teacher's reach without removing their judgement.

**Governance principle.** NCF 2023 (formative assessment), UNESCO Guidance (human oversight of automated grading).

**Risk it raises.** A multimodal model inventing answers on a blank or near-blank page, producing an unearned grade.

**How the design answers it.** The blank-page guard is deterministic and overrides the model. Low per-criterion confidence surfaces a visible warning, and the teacher can correct the transcript and re-score.

**Maturity.** Shipped.

### C3. Assessment Scanner (Multi-Page, Rubric-Graded)

**What it does.** A two-pass system that extracts questions and handwritten answers across up to three pages, then grades them against subject-aware, NCERT-grounded rubrics, reporting concept mastery by chapter and flagging any item below a confidence threshold for teacher review. Image-quality problems are reported honestly rather than papered over. Source: `src/ai/flows/assessment-scanner.ts`.

**Why it matters.** Per-chapter mastery signals let a teacher see not just a mark but where a class is actually stuck, which is the information NCF 2023's competency framing depends on.

**Governance principle.** NCF 2023 (competency-based, diagnostic assessment), UNESCO Guidance (validity and oversight).

**Risk it raises.** Over-confident grading, especially on subjective non-mathematics answers, and degraded accuracy on poor images.

**How the design answers it.** Non-mathematics grading is instructed to lean conservative and to set a review flag when confidence is low. Image-quality warnings are first-class output, and unreadable pages produce a typed error that tells the teacher to re-upload rather than a fabricated grade.

**Maturity.** Shipped (best-tuned for mathematics).

### C4. Instant Answer (Live-Grounded Knowledge)

**What it does.** Answers a teacher's question with live Google Search grounding, in any of the eleven languages in native script, optionally suggesting a video. It applies a topic-safety check that screens out non-educational and harmful queries and is rate-limited to authenticated users. Source: `src/ai/flows/instant-answer.ts`.

**Why it matters.** Teachers need current facts, exam dates, new circulars, recent events, without holding them in memory.

**Governance principle.** UNESCO Guidance (accuracy, provenance), IndiaAI Mission (safe deployment).

**Risk it raises.** The cost and accuracy questions that live grounding raises, and off-topic or unsafe use.

**How the design answers it.** Grounding is applied deliberately here, where live facts justify it, and was deliberately removed from the lesson planner where the syllabus is static, an explicit, documented cost-and-accuracy decision. A deterministic safety check gates the scope, and grounding calls are metered.

**Maturity.** Shipped.

### C5. Teacher Training (Pedagogical Coaching)

**What it does.** Answers a teacher's professional question with named pedagogical strategies, each tied to a recognised principle (scaffolding, the zone of proximal development, cooperative learning) and explained through an Indian analogy. The pedagogy field is mandatory, so advice cannot collapse into generic encouragement. Source: `src/ai/flows/teacher-training.ts`.

**Why it matters.** Continuous professional development is scarce in rural postings. A grounded, on-demand coach complements national programmes such as NISHTHA rather than replacing the human mentor.

**Governance principle.** NEP 2020 (continuous teacher development), NISHTHA alignment.

**Risk it raises.** Hollow platitudes presented as professional advice.

**How the design answers it.** The mandatory pedagogy citation forces every piece of advice to rest on a named principle, which is both more useful and more auditable.

**Maturity.** Shipped.

> **Recommendation C.** India should make human-in-the-loop the default legal posture for education AI: AI may draft, a teacher must decide. Vendors should be required to wrap probabilistic generation in deterministic validation, to surface confidence and curriculum-alignment signals to the user, and never to present an automated grade or answer as final without a clear path for the teacher to inspect and override it.

---

## Theme D. Teacher Bandwidth and Administrative Automation

A question. If a teacher in a single-teacher school spends a large part of every week on documentation, attendance, and parent communication, where is the time for actual teaching supposed to come from?

The premise of this theme is that automating low-criticality administrative labour is not a luxury, it is the mechanism by which a teacher is returned to teaching. It is also the theme that carries the most direct contact with parents and minors, and therefore the most careful governance obligations.

### D1. Attendance and Automated Parent Outreach

**What it does.** Teachers mark daily attendance; the system flags consecutive absences and can trigger outreach to a parent by message or by call. Student and parent records, including phone numbers, are stored per class, and the feature is gated to paid plans. Source: `src/app/attendance/`, `src/app/api/attendance/`.

**Why it matters.** Early, reliable parent contact on absence is one of the most effective and most neglected interventions against the dropout rate.

**Governance principle.** DPDP Act 2023 (processing of personal data, including children's data), NEP 2020 (retention and equity).

**Risk it raises.** Parent contact details are stored in plain text, there is no automated retention or deletion policy for them, and repeated automated outreach could become a nuisance if misused.

**How the design answers it.** Access is limited to the owning teacher and outreach is teacher-initiated rather than autonomous. The honest gaps are the absence of an explicit retention policy for parent contact data and the absence of a parent-facing deletion path, both of which a governance regime should require.

**Maturity.** Shipped, with named data-protection gaps.

### D2. AI Parent Message Generator

**What it does.** Drafts a short, warm, jargon-free parent message in any of the eleven languages for one of four reasons (consecutive absence, weak performance, behavioural concern, positive news), citing at most one real score and explicitly instructed never to invent one. Source: `src/ai/flows/parent-message-generator.ts`.

**Why it matters.** Many parents read in their mother tongue and on a basic phone. A message in their own language and script makes the school reachable to them.

**Governance principle.** NEP 2020 (parental engagement), DPDP Act 2023 (accuracy of personal data used).

**Risk it raises.** Fabricated performance claims about a child.

**How the design answers it.** The score citation is drawn from real assessment data, and the prompt forbids inventing scores; when no score exists, the message omits specifics. The honest residual is that this safeguard is prompt-level, without an output-layer guard.

**Maturity.** Shipped.

### D3. AI Parent Call Agent

**What it does.** Places a conversational phone call to a parent over a telephony provider, greets them with the school name and the teacher's message, converses for up to six turns in the parent's language, and stores a structured summary and transcript. The agent is explicitly instructed to speak as the school or the teacher and not to identify itself as an AI. A separate behavioural guard blocks replies that would break character or drift into the wrong script. A recording-and-AI disclosure notice exists in the code but is gated off behind a feature flag pending complete translation into all eleven languages. Source: `src/ai/flows/parent-call-agent.ts`, `src/app/api/attendance/`.

**Why it matters.** For a parent on a feature phone who does not read, a phone call in their language may be the only channel that reaches them at all. The reach is real and valuable.

**Governance principle.** DPDP Act 2023 (consent, notice, children's data, processing of voice data), TRAI telecom commercial-communication norms, UNESCO Guidance (transparency and disclosure of AI).

**Risk it raises.** This is the most governance-sensitive capability in the system. An automated agent that deliberately does not disclose it is an AI sits in direct tension with the transparency expectations of both the DPDP framework and the UNESCO Guidance. The recording-and-AI consent notice is built but not yet live, transcripts are retained without an explicit retention limit, and there is no recorded opt-in handshake from the parent.

**How the design answers it.** The design choice is honest about its motive: the agent speaks as the school to earn the trust of a low-literacy parent who may distrust a machine, and a fail-closed guard prevents impersonation drift. The consent notice is engineered and waiting on translation. The honest position for the book is that this capability needs its disclosure notice switched on, an explicit consent step added, and a defined retention limit applied before it can be called compliant. Presented this way, it becomes the single most valuable case study in the chapter for what AI-to-citizen disclosure rules must require.

**Maturity.** Beta, with disclosed consent and retention gaps.

> **Recommendation D.** India should require that any AI system which communicates directly with a parent or a minor disclose at the outset that it is automated, obtain and record explicit consent before recording or processing voice, and operate under a defined data-retention limit with a simple deletion path that works for a parent on a basic phone. A vendor's intent to build trust does not displace the citizen's right to know they are speaking with a machine.

---

## Theme E. Data Protection and Privacy

A question. If India's teachers and their students' data flow into an AI platform, where does that data physically live, who can see it, and can a teacher truly leave and take their data with them?

This theme maps most directly onto the DPDP Act 2023. SahayakAI's architecture is strong on consent, erasure, and data minimisation, and it carries one significant and honestly disclosed gap on data residency that the book should treat as its central governance lesson.

### E1. Analytics Consent

**What it does.** Usage tracking is opt-in. The teacher must acknowledge, in a versioned and revocable consent record, that activity will be tracked and data retained for a stated period. Source: `src/lib/analytics-consent.ts`.

**Why it matters.** The DPDP Act requires informed, itemised, revocable consent. Building consent as a first-class, versioned record is exactly the posture the Act expects.

**Governance principle.** DPDP Act 2023 (consent, notice, purpose limitation).

**Risk it raises.** Stated retention without automated enforcement.

**How the design answers it.** Consent is versioned and revocable. The honest gap is that the scheduled-deletion enforcement behind the stated retention period is not yet fully automated.

**Maturity.** Shipped, with deletion automation incomplete.

### E2. Right to Erasure (Account Deletion)

**What it does.** A deletion request triggers a thirty-day grace period with data export, cancels the subscription, removes the user from organisations, purges peer connections, and deletes the authentication account, with reminders during the grace period before anonymisation. Source: `src/app/api/user/delete-account/`.

**Why it matters.** This is the operational form of the DPDP Act's right to erasure, and a grace period with export respects the teacher rather than trapping them.

**Governance principle.** DPDP Act 2023 (right to erasure, data portability).

**Risk it raises.** Incomplete final anonymisation after the grace period.

**How the design answers it.** The user-facing flow, export, and authentication deletion are real and live. The honest gap is that the final automated anonymisation step still needs end-to-end verification and an audit log.

**Maturity.** Shipped, with final-purge verification outstanding.

### E3. Privacy-Preserving Impact Score

**What it does.** A transparent composite score from zero to one hundred built from four aggregate dimensions of a teacher's own activity (activity, engagement measured as feature-use entropy, success, and growth). It is aggregate-only by design, with no per-student or per-class breakdown and no school dashboard that would let an administrator surveil an individual teacher. An earlier opaque version was replaced after it failed an internal accountability check, in favour of a transparent sum. Source: `src/lib/analytics/impact-score.ts`, `src/app/privacy-for-teachers/`.

**Why it matters.** It offers administrators and funders a measurable signal of programme impact without turning the platform into a surveillance instrument pointed at teachers. It also gives the state an auditable basis for the return on a digital-inclusion investment.

**Governance principle.** DPDP Act 2023 (data minimisation, purpose limitation), NEP 2020 (evidence-based investment), UNESCO Guidance (privacy-preserving analytics).

**Risk it raises.** That organisation-level aggregates could be reverse-engineered to expose an individual.

**How the design answers it.** The personal score excludes the community dimension and exposes no individual breakdown, and the explicit privacy commitment is that no per-teacher monitoring dashboard ships. The residual obligation is that data-access rules must enforce the organisation-level isolation the design promises.

**Maturity.** Shipped.

### E4. Data Residency

**What it does.** The platform's data stores and compute run in the `asia-southeast1` region, which is Singapore. Source: `src/lib/firebase.ts`, deployment configuration.

**Why it matters.** This is the chapter's central honesty test and its most important governance lesson. A sovereignty-themed product whose data physically resides outside India illustrates precisely why data-residency must be a governance requirement and not a marketing adjective.

**Governance principle.** DPDP Act 2023 (cross-border transfer), IndiaAI Mission (sovereign data infrastructure), NDEAR (national digital public infrastructure).

**Risk it raises.** Data on Indian teachers and minors residing under Singapore's PDPA rather than India's DPDP Act, and any user-facing claim of Indian residency would be inaccurate.

**How the design answers it.** The honest answer is that it does not yet. The current state is Singapore-hosted, and any consent or marketing copy implying Indian residency is being corrected. The governance lesson is that residency is verifiable infrastructure, and the recommendation that follows is that the country should require it to be stated truthfully and, for education data on minors, increasingly to be located in India.

**Maturity.** Live in Singapore. India-region migration is a recommended next step, not a current fact.

### E5. Ephemeral Voice Handling

**What it does.** Voice input is transcribed and not persisted on servers unless the teacher explicitly chooses to share an audio message into the community, where it is then readable only by conversation participants. Codec selection adapts to the browser. Source: `src/app/api/ai/voice-to-text/`, community message handling.

**Why it matters.** Not retaining voice by default is textbook data minimisation.

**Governance principle.** DPDP Act 2023 (data minimisation, storage limitation).

**Risk it raises.** Shared community audio currently has no time-to-live.

**How the design answers it.** Default voice is ephemeral. The honest residual is that explicitly shared audio is retained indefinitely and would benefit from a cleanup policy and a revocation control.

**Maturity.** Shipped, with a retention gap on shared audio.

> **Recommendation E.** India should treat data residency, consent, and erasure for education data as verifiable obligations, not claims. For data concerning minors, the rules should move toward in-country storage, require that residency be stated truthfully, mandate automated enforcement of stated retention periods, and guarantee a working erasure path. Privacy-preserving, aggregate-only analytics should be the expected default, and any individual-level monitoring should require separate, explicit, revocable consent.

---

## Theme F. Accountability, Transparency, and Controlled Operation

A question. When something goes wrong with an AI system serving a million classrooms, can the operator turn it off in seconds, can the public see what it is doing, and can a regulator audit the claims?

This theme covers the operational governance machinery that turns good intentions into something a regulator can trust: kill switches, controlled rollout, billing integrity, authentication, and the honest labelling of AI content.

### F1. Feature Flags and Kill Switches

**What it does.** Every major feature and AI agent is governed by a central, server-side flag store supporting allow and block lists, percentage rollouts, sticky per-user bucketing, a maintenance mode, and kill switches that default to safe degradation. One flag flip can roll an entire class of agents back without a code deployment. Source: `src/lib/feature-flags.ts`.

**Why it matters.** The ability to disable a misbehaving capability instantly, without a deployment, is the single most important operational safety property a large-scale AI service can have.

**Governance principle.** IndiaAI Mission (safe and accountable AI), UNESCO Guidance (controllability).

**Risk it raises.** That a needed safeguard, such as the parent-call consent notice, stays switched off.

**How the design answers it.** The mechanism is live and defaults to the safe state. The honest note is that it must actually be used to switch on pending safeguards, not only to roll features out.

**Maturity.** Shipped.

### F2. Authentication and Authorisation

**What it does.** Every request is authenticated by verifying a signed token against Google's public certificates; the verified user identity is injected server-side and stripped from incoming requests so it cannot be spoofed by a client. A prior header-spoofing weakness was found and closed in a security audit. Source: `src/middleware.ts`.

**Why it matters.** Protecting one teacher's data and one student's records from another user is the floor of trust for any education platform.

**Governance principle.** DPDP Act 2023 (security safeguards), IndiaAI Mission (trusted infrastructure).

**Risk it raises.** Identity spoofing and cross-user data access.

**How the design answers it.** Identity is trusted only from a verified token, never from a client-supplied header, and an additional app-integrity check exists to be enforced as rollout completes.

**Maturity.** Shipped.

### F3. Billing Integrity and Usage Quotas

**What it does.** Subscription tiers carry monthly credit allocations that cap AI spend per user, and a scheduled reconciliation job compares the payment provider's records against the platform's own every few hours, auto-correcting safe mismatches and flagging the rest for human review. Source: `src/lib/billing-reconciliation.ts`.

**Why it matters.** Per-user quotas are a cost-and-abuse safeguard, and billing reconciliation is the financial-integrity control a publicly funded programme would be expected to demonstrate.

**Governance principle.** IndiaAI Mission (responsible resource use), public-procurement accountability.

**Risk it raises.** Runaway model cost and silent billing errors.

**How the design answers it.** Credits bound spend, and reconciliation detects double charges and missed webhooks rather than letting them pass.

**Maturity.** Shipped.

### F4. Automated Lifecycle Jobs

**What it does.** Scheduled jobs enforce data lifecycle and operations: deletion reminders and anonymisation, billing reconciliation, storage cleanup, community-chat age-off, and teacher-facing briefings and news. Each is authenticated by a shared secret. Source: `src/app/api/jobs/`.

**Why it matters.** Storage limitation under the DPDP Act is only real if something automatically enforces it.

**Governance principle.** DPDP Act 2023 (storage limitation), operational accountability.

**Risk it raises.** A lifecycle job that queues reminders but does not complete the final deletion.

**How the design answers it.** The jobs are live and authenticated. The honest residual, shared with E1 and E2, is that the final anonymisation path needs end-to-end verification and an audit trail.

**Maturity.** Shipped, with deletion verification outstanding.

### F5. AI Persona Transparency in Community

**What it does.** During the pilot phase, the community feed is seeded with a small set of AI-generated teacher personas that post in character every few minutes to make a young community feel alive. These personas are tagged in the database as demo personas, but the user interface does not currently display a visible AI label on them; they render like any human teacher. They are intended to be retired once real teacher volume arrives. Source: `src/ai/data/community-personas.ts`, `src/ai/flows/community-persona-message.ts`.

**Why it matters.** This is a transparency question of the same family as the parent-call agent, and the book should treat it with the same candour. Synthetic participants that are not visibly labelled as synthetic are exactly what disclosure norms exist to address.

**Governance principle.** UNESCO Guidance (disclosure of AI-generated content), IndiaAI Mission (transparency), DPDP Act 2023 (fairness).

**Risk it raises.** Users believing they are reading and taking pedagogical advice from real peers when they are reading model output, which is also unvetted for accuracy.

**How the design answers it.** The backend tagging makes filtering and retirement straightforward, and the personas are flagged for sunset at launch. The honest gap, which the book should state plainly, is that there is no visible AI label in the interface today and the advice is not fact-checked. The recommendation is a clear, visible AI label on any synthetic participant.

**Maturity.** Scaffolded (demo-only, slated for retirement).

> **Recommendation F.** India should require education-AI operators to demonstrate operational controllability and transparency: an instant, code-free kill switch for any AI capability; verifiable authentication and access controls; financial-integrity controls for publicly funded deployments; automated enforcement of data-lifecycle commitments; and a clear, visible label on any AI-generated content or synthetic participant a user might mistake for a human.

---

## Consolidated recommendations for India's education-AI governance

Drawing the six themes together, the country's emerging rules for AI in education could be built from seven requirements. Each is not a theoretical ideal; each is something a working system has already shown to be buildable, and in a few cases something a working system has shown is still missing.

1. **Curricular grounding by design.** Any AI that generates instructional or assessment content must ground it in NCERT, state board, and NCF 2023 frameworks, expose a visible alignment signal, and default to the Indian classroom's cultural and resource reality. Deterministic, auditable checks should enforce this.

2. **Measured language parity.** Every scheduled language is entitled to a published baseline of recognition and synthesis quality. Shortfalls must be disclosed to users, and vendors should integrate national language assets such as Bhashini as they mature.

3. **Human-in-the-loop as the legal default.** AI may draft; a teacher must decide. Probabilistic generation must be wrapped in deterministic validation, confidence and alignment signals must be visible, and no automated grade or answer may be presented as final without an inspect-and-override path.

4. **Honest disclosure to citizens.** Any AI that communicates with a parent or minor must disclose that it is automated, record explicit consent before processing voice, and operate under a defined retention limit with a deletion path usable from a basic phone. Synthetic participants in any community must carry a visible AI label.

5. **Verifiable data protection.** Residency, consent, and erasure must be verifiable obligations, not claims. Education data on minors should move toward in-country storage, stated residency must be truthful, retention must be enforced automatically, and erasure must work end to end.

6. **Privacy-preserving analytics by default.** Aggregate, minimised analytics should be the norm. Any individual-level monitoring of a teacher should require separate, explicit, revocable consent, and no surveillance dashboard should be the default.

7. **Demonstrable operational control.** Operators must show an instant kill switch, sound authentication, financial-integrity controls for public funds, automated lifecycle enforcement, and clear labelling of AI content.

## The honest ledger

A governance recommendation earns its credibility by naming what is not yet done. Held against its own proposed standard, the worked example in this chapter is strong on grounding, validation, consent, erasure, and operational control, and it carries five disclosed gaps that the country's rules should require it, and every vendor like it, to close:

1. **Data residency.** Currently Singapore, not India. Residency claims are being corrected; migration toward an India region is the right direction for data on minors.
2. **AI disclosure on parent calls.** The agent does not yet announce it is automated, and the consent notice, though built, is not switched on. Disclosure and a recorded consent step should precede further rollout.
3. **Synthetic-participant labelling.** Demo community personas are not visibly labelled as AI in the interface. A visible label should be added.
4. **Voice equity.** Telugu, Marathi, and especially Odia receive lower-quality synthesis. Closing this gap, including through Bhashini, is a parity obligation.
5. **Lifecycle enforcement.** Stated retention and final anonymisation need fully automated enforcement and an audit trail.

Naming these openly is not a weakness in the argument. It is the argument. The promise of a sovereign, teacher-centred education-AI stack for India is credible precisely because its capabilities are real, its safeguards are already load-bearing, and its remaining gaps are known, named, and closable. That combination, ambition disciplined by honesty, is the standard the country should ask of everyone who builds for its classrooms.

---

### Appendix: capability count and evidence

This chapter inventories thirty-eight distinct capabilities: nine content-generation engines (A1 to A8 plus the micro-lesson deck), five assessment, feedback, and knowledge systems with their shared validation layer (C1 to C5), four voice and multilingual capabilities (B1 to B4), six parent-engagement and community systems (D1 to D3, F5, plus teacher-to-teacher connections and messaging), and the data-protection and operational-governance controls (E1 to E5, F1 to F4). Every capability cites the source file or files that implement it, so each claim in this chapter can be independently verified against the codebase rather than taken on assertion.
