# SahayakAI — NCERT Q&A Bank (5-min Q&A window)

**Honesty rule:** never overpromise. Where the honest answer might disappoint NCERT, the question is flagged with **[CANDID]** and the framing turns the gap into a co-design opportunity.

Answers are written to be spoken in 15–25 seconds each (2–3 sentences). Do not read verbatim; internalise the structure.

---

## 1. Content accuracy and hallucination mitigation

**Q:** "What is your hallucination rate? How do you prevent factual errors in front of children?"

**A:** Three-layer defence. One, every lesson plan carries an NCERT chapter citation that the teacher can verify in 2 seconds against her own textbook. Two, the system prompts the teacher with a one-tap "report incorrect content" button; flagged outputs are reviewed by our pedagogy lead within 24 hours and the prompt template is corrected. Three, factual queries route through Instant Answer which is Google-Search-grounded and returns sources — not memory. We treat the teacher as the final editor; the AI is a draft, never a directive.

---

## 2. Student data privacy and DPDP Act compliance

**Q:** "What student data do you store? Are you compliant with the Digital Personal Data Protection Act?"

**A:** SahayakAI is a teacher-facing product. We do not store any individually identifiable student record by default. Attendance and marks data, when entered by the teacher, are kept inside the teacher's own account scope. We are DPDP-aligned: data is hosted in India region (asia-southeast1), encrypted at rest and in transit, with documented data retention and deletion workflows. We have not yet completed a third-party DPIA — we would welcome NCERT or MoE guidance on the audit framework you would like applied.

---

## 3. DIKSHA / NISHTHA integration roadmap

**Q:** "How does this fit with DIKSHA and NISHTHA? The MoE has already invested heavily in those."

**A:** Complementary, not competing. DIKSHA hosts curated content libraries; SahayakAI generates and contextualises content into the teacher's specific classroom situation — language, grade, resource level. NISHTHA delivers structured training modules; SahayakAI is the daily-classroom support that helps teachers apply what NISHTHA taught them. Our roadmap includes: (a) consuming DIKSHA content as input to lesson plan generation, (b) exporting our content back into the DIKSHA format for state-curated libraries, and (c) reading the teacher's NISHTHA certification record to personalise the support we offer. We would like NCERT's guidance on the right integration sequence.

---

## 4. Offline capability — what works today, honestly

**Q:** "You claim offline-capable. 45% of our schools have no internet. What actually works without a connection?" **[CANDID]**

**A:** Honest answer: we have a Flutter-based offline pilot scaffolded — three agents are wired to Firebase AI Logic's hybrid inference, which falls back to the on-device Gemini Nano model when offline. This is in field test in two Karnataka districts, not yet production-GA. For today, the offline story is: cached lesson plans, locally stored worksheets and quizzes, and a one-time download model where a teacher syncs in the morning and uses cached outputs through the day. Full offline LLM generation is on the 6-month roadmap. We would not claim production offline GA — we are honest about where we are.

---

## 5. Cost per teacher per year

**Q:** "What does this cost the government per teacher? Per student?"

**A:** Our target government tariff is ₹1,000 per teacher per year, which works out to roughly ₹30 per student per year. Our unit economics support this: with semantic caching (currently 68% hit rate, scaling to 85%) and Gemini 2.0 Flash pricing, a typical teacher's monthly compute cost is under ₹40. At scale, gross margin reaches 76%. NITI Aayog's outcomes-based procurement framework — 50% upfront, 50% on documented learning improvement — fits our model directly.

---

## 6. State-board coverage

**Q:** "How many state boards have you mapped? Not just NCERT — there are 28+ boards."

**A:** We have NCERT, CBSE, ICSE, and IB mapped as authoritative. State board mapping is curriculum-by-curriculum: Karnataka State Board (full), West Bengal Board (full), Tamil Nadu State Board (Class 1–8), Telangana (Class 1–10), Maharashtra (Class 1–7) — five states deep, all others by chapter title match. The 22-language Sarvam AI integration on our roadmap is paired with state-board deepening in parallel; we target full coverage of 15 states by Month 18.

---

## 7. Language coverage — 11 active, 22 scheduled

**Q:** "You say 11 languages. India has 22 scheduled languages. When do you cover all 22?" **[CANDID]**

**A:** Eleven are live and quality-tested in classroom: English, Hindi, Kannada, Bengali, Tamil, Telugu, Marathi, Gujarati, Punjabi, Malayalam, Odia. The remaining 11 — Assamese, Urdu, Sanskrit, Maithili, Santali, Sindhi, Kashmiri, Nepali, Konkani, Manipuri, Bodo, Dogri — are on the roadmap with Sarvam AI integration, targeted within 12 months. We chose depth over breadth: an 11-language product that classrooms actually use, not a 22-language product where 11 are token-level translations. We would value NCERT's view on which of the remaining 11 to prioritise first.

---

## 8. How does this differ from DIKSHA?

**Q:** "Honestly — DIKSHA already exists. What is the additionality?"

**A:** DIKSHA is a content distribution platform — videos, e-books, NISHTHA modules. SahayakAI is a content *generation* and *contextualisation* engine for the individual teacher. DIKSHA gives a Karnataka teacher a Hindi video on photosynthesis. SahayakAI takes that teacher's specific class — Class 7, Kannada-medium, paddy-growing district, no smart board — and produces a 5E lesson plan in Kannada using paddy-field examples in 5 minutes. They are different layers of the same system.

---

## 9. NCERT textbook chapter alignment

**Q:** "Can you guarantee chapter-level alignment with NCERT textbooks?"

**A:** Yes for NCERT-published textbooks (Class 1–12, all NCERT-authored subjects). Every generated plan references the specific NCERT chapter by name and number; teachers can verify against the printed textbook. Karnataka pilot data: 92% chapter alignment accuracy on teacher review. The 8% gap is largely in newly revised NCERT 2024–25 editions where our content index is still catching up — we are happy to share our chapter-mapping methodology with the NCERT Textbook Division for review.

---

## 10. FLN (Foundational Literacy & Numeracy) coverage

**Q:** "How does SahayakAI support the FLN mission for Grades 1–3?"

**A:** Three FLN-specific design choices. One, the worksheet generator produces pre-literate friendly outputs — picture-match, oral exit tickets, gesture-based activities — so a child who cannot yet decode still participates. Two, every lesson plan offers three difficulty tiers automatically, accommodating the wide reading-level range in a typical Grade 1–3 multi-grade classroom. Three, mother-tongue output is the default for Grades 1–5 per NEP 4.11. Our pilot in Karnataka included 38 FLN-grade teachers; comprehension gain was actually highest in this cohort.

---

## 11. Multi-grade differentiation

**Q:** "104,000 of our schools have a single teacher teaching all grades. Does SahayakAI help her?"

**A:** This is one of our anchor use cases. A single voice command — "lesson plan for Grades 3, 4, and 5 on the water cycle" — produces three parallel, age-appropriate plans the teacher can run as parallel station activities. The Worksheet Wizard produces a shared activity sheet where the same topic has three difficulty zones on one A4 page, so the single teacher manages three grades from one paper. Two-thirds of our Karnataka pilot teachers ran multi-grade classes; the system was designed against that constraint.

---

## 12. Teacher training requirement

**Q:** "How much training does a teacher need before she can use this productively?"

**A:** Median time-to-first-useful-output in our Karnataka pilot was 9 minutes for voice users, 14 minutes for text users — measured from app install to first lesson plan that the teacher rated 4/5 or higher. We provide a 45-minute video walkthrough in each language and a one-page printed quickstart. We do not require formal training programmes; the voice-first design is what makes this possible. We would welcome NCERT's input on whether to package this as a NISHTHA-aligned micro-module.

---

## 13. Bandwidth requirements

**Q:** "What is the minimum bandwidth a school needs to use SahayakAI?"

**A:** A standard lesson plan generation transfers approximately 40 KB of compressed text. Even on a 2G connection (50 kbps) this completes in under 8 seconds. The TTS audio for read-aloud output is 80–120 KB for a typical 30-second clip. The product was built to work on 2G; we test on throttled connections in CI. The 45% of schools without internet are served by the offline pilot path described in question 4.

---

## 14. Smartphone requirements

**Q:** "What kind of phone do our teachers need?"

**A:** Android 9 or higher, 2 GB RAM, 200 MB free storage. This deliberately targets the ₹6,000 entry-level smartphone tier that rural teacher salary brackets can afford. We do not require flagship hardware. Our mobile app is under 20 MB. iOS support is on roadmap but not the priority — Android covers 96% of the Indian teacher base.

---

## 15. What happens if WiFi fails mid-class

**Q:** "Hypothetically — teacher is mid-lesson, WiFi drops. What does she see?"

**A:** Already-generated content stays available in the on-device cache — the lesson plan she opened this morning is still there. New generation requests queue up and process when connectivity returns. The Flutter offline path (pilot) lets her continue generating on-device for the three agents that are wired into Firebase AI Logic hybrid inference. Honestly, full offline parity is a 2026 H2 roadmap item; today the realistic answer is "she keeps what she has, she gets new when she's back online."

---

## 16. Pedagogy validation methodology

**Q:** "Who validated your pedagogy? How do we know the 5E plans are pedagogically sound?"

**A:** Three validations. One, our Pedagogy Lead is a former NCERT-curriculum trainer; she reviews every model prompt template before release. Two, the Karnataka pilot was independently evaluated by the Samarasya Foundation, in partnership with the Dr Ramdas Pai Chair on Education — 11.8% comprehension gain, p = 0.012, statistically significant. Three, we are open-sourcing the prompt templates this quarter so academic peers can audit them. We would warmly welcome NCERT's curriculum experts to review and red-team the prompts directly.

---

## 17. Partnership ask — what we actually want from NCERT

**Q:** "What exactly are you asking NCERT for?"

**A:** Three things, in order. One — a co-designed pilot, 40 teachers, two NCERT-affiliated demonstration schools, six weeks, NCERT-defined success metrics. Two — feedback on curriculum alignment, ideally an NCERT subject-matter expert who can sit on a 60-minute monthly review call. Three — guidance on the right pathway to scale the validated pilot into a state-board offering with NCERT's institutional support. We are not asking for funding. We are asking for credibility and curriculum partnership.

---

## 18. Pilot terms — cost, IP, data

**Q:** "What does a pilot cost us? Who owns the data?"

**A:** Pilot is free of cost to NCERT for the six weeks — we absorb the platform and training cost. NCERT owns the curriculum design and the success-metric definition. SahayakAI owns the product and the underlying technology. Anonymised aggregate pilot data is shared jointly — NCERT for research and publication, SahayakAI for product improvement. Individual teacher and student data stays in India region, DPDP-compliant, deleted on pilot conclusion if NCERT wishes. We are flexible on terms; we would welcome a written MoU template you prefer.

---

## 19. Data residency and model used

**Q:** "Where is the data hosted? Which AI model do you use? Why not a Bharat-native model?" **[CANDID]**

**A:** Hosted in Cloud Run, asia-southeast1 region (Singapore, the nearest Google Cloud India-adjacent region; Mumbai region migration is on the 6-month roadmap once Gemini API parity is available there). The model is currently Google Gemini 2.x Flash for generation and Google Cloud TTS for speech. On the Bharat-native model question — yes, this is a fair challenge. Sarvam AI integration is on our active roadmap; we have evaluated their models on Hindi, Kannada, and Bengali and the quality is competitive on Indic-language tasks. We expect to dual-route between Gemini and Sarvam by end of 2026, choosing the better-quality model per language. We do not believe model-nationalism should override classroom outcomes — but model sovereignty for Indian languages is genuinely on the path.

---

## 20. Why should NCERT bet on a startup over the MoE's own Teacher App 2.0?

**Q:** "The MoE launched Teacher App 2.0 with Airtel and CK-12 in February. Why work with you?" **[CANDID]**

**A:** Teacher App 2.0 is English-first, cloud-only, and built on US-nonprofit (CK-12) content. SahayakAI is 11-Indian-language native, hybrid-offline-capable, and built on NCERT and state-board curriculum. Different problems being solved. A teacher in rural Karnataka does not benefit from English-language CK-12 content — she needs Kannada, NCERT-aligned, offline-capable. We see Teacher App 2.0 as the urban-and-elite layer; SahayakAI as the rural-and-mid-tier layer. Both can exist; both should. We would welcome NCERT's view on how the two complement each other.

---

## Hardest three questions (flagged for founder rehearsal)

1. **Q19 (Bharat-native model).** This is a national-sentiment question disguised as a technical one. Honesty + roadmap + clear principle ("classroom outcomes over model nationalism") is the answer.
2. **Q20 (Teacher App 2.0 vs SahayakAI).** Do not denigrate Teacher App 2.0. Position both as complementary. NCERT may have institutional politics around this — stay neutral.
3. **Q4 (Offline reality).** Do not overclaim. The roadmap is honest. The pilot status is real. If pressed, offer: "Would NCERT like to visit a Karnataka pilot school and see the offline path in field test?"

---

## Things to NEVER say in Q&A

- "We will replace DIKSHA."
- "Indian teachers are not trained."
- "The government is slow."
- "We are the Khan Academy of India."
- "We are India's ChatGPT for teachers."
- Anything that implies SahayakAI alone solves India's learning crisis. We are infrastructure. Teachers and curriculum bodies do the teaching.

---

## Things it is OK to say

- "I do not have a precise answer to that. I will get you one in writing within 24 hours."
- "That is a fair challenge, and here is how we are honestly placed today."
- "We would welcome NCERT's guidance on that."
- "We are happy to run a deeper technical session with your curriculum team."
