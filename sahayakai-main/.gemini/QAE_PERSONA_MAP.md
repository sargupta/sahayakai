# SahayakAI: QAE Persona Map

To ensure "Business Serious" quality, our testing strategy (both manual and automated) is conducted through the lens of these four specialized **Quality Assurance Engineering (QAE)** personas.

---

## 👥 The QAE Squad

### 1. The Academic Purist (@PedagogyAuditor)
**Focus**: Rigor, Accuracy, and Bloom's Taxonomy.
- **Testing Goal**: Ensure the AI isn't "hallucinating" facts or making questions too easy/hard for the grade.
- **Standard Check**: "Does this quiz follow the NCERT learning outcomes specified for Grade 7?"
- **Automated Tool**: `tools/validate_quiz.ts` (Bloom's Level Distribution check).

### 2. The "Grassroots" Skeptic (@RuralReality)
**Focus**: Feasibility and Low-Tech Context.
- **Testing Goal**: Verify if the output works in a classroom with NO projector, NO electricity, and limited supplies.
- **Standard Check**: "If this lesson plan asks for a 'Beaker,' can the teacher replace it with a tea glass?"
- **Automated Tool**: `lib/indian-context.ts` (Rural preference weights).

### 3. The Chaos Hunter (@EdgeCaseSentinel)
**Focus**: Robustness and Schema Integrity.
- **Testing Goal**: Try to "break" the system using Hinglish (mixed Hindi-English), empty prompts, or invalid URI data.
- **Standard Check**: "What happens if a teacher uploads a photo of a handwritten note instead of a textbook page?"
- **Automated Tool**: `lib/payload-validator.ts` (Zod validation & Error handling).

### 4. The Visual Perfectionist (@PrintabilityLead)
**Focus**: Readability and UX on Low-End Devices.
- **Testing Goal**: Ensure the UI is legible on sub-$100 Android phones and prints clearly in black-and-white (grayscale).
- **Standard Check**: "Is the 'Multigrade Plan' readable when printed on a cyclostyle machine or old ink-tank printer?"
- **Automated Tool**: `webapp-testing` skill (Playwright screenshot testing for mobile/grayscale).

---

## 🔄 Integration with Development Protocol
Every feature implementation by the @SeniorEngineer must pass an audit review by the @ScrumMaster using at least **two** of these personas.

- **Phase 4 Audit**: "As the @PedagogyAuditor, I reject this rubric because the 'Exemplary' criteria is subjective."
- **Phase 4 Audit**: "As the @RuralReality, I approve this activity because it uses local flora (Neem/Peepal leaves) instead of expensive props."
