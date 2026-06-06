/**
 * Grade-band utilities (F18 fix).
 *
 * Indian school system splits into pedagogically distinct bands. AI flows
 * (quiz numQuestions default, lesson plan pedagogy framework, vocabulary
 * age constraint) must respect these bands instead of assuming a single
 * default (Class 5 / 5-question / 5E-everywhere).
 *
 * Bands:
 *   - primary    : Class 1-5            (story-based, concrete examples)
 *   - middle     : Class 6-8            (5E inquiry model)
 *   - secondary  : Class 9-10           (structured + exam-prep)
 *   - senior     : Class 11-12          (deep analysis + competitive-exam)
 *
 * Pre-primary (Nursery / LKG / UKG) collapses into 'primary' for AI
 * generation purposes — the same concrete/story pedagogy applies.
 */

export type GradeBand = 'primary' | 'middle' | 'secondary' | 'senior';

/**
 * Extract a numeric class number from a "Class 7" / "Grade 7" / "7th" / "7"
 * style label. Returns null if no number found.
 */
function extractClassNumber(label: string | undefined | null): number | null {
  if (!label) return null;
  const s = String(label).toLowerCase().trim();
  // pre-primary collapses to "1" (primary band) for our purposes
  if (s.includes('nursery') || s.includes('lkg') || s.includes('ukg') || s.includes('kg')) {
    return 1;
  }
  const m = s.match(/(\d{1,2})/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > 12) return null;
  return n;
}

/**
 * Derive the grade band from a single grade label.
 * Falls back to 'middle' (the historical SahayakAI default) when the label
 * cannot be parsed, so existing behaviour is preserved for unrecognised
 * inputs.
 */
export function getGradeBand(gradeLabel: string | undefined | null): GradeBand {
  const n = extractClassNumber(gradeLabel);
  if (n === null) return 'middle';
  if (n <= 5) return 'primary';
  if (n <= 8) return 'middle';
  if (n <= 10) return 'secondary';
  return 'senior';
}

/**
 * Default number of quiz questions per band (F18-01).
 * Increasing with grade keeps the assessment volume proportional to the
 * cognitive endurance and revision needs of older students.
 */
export function defaultNumQuestionsForBand(band: GradeBand): number {
  switch (band) {
    case 'primary': return 5;
    case 'middle': return 10;
    case 'secondary': return 15;
    case 'senior': return 20;
  }
}

/**
 * Convenience helper — derive default question count from a grade label
 * (single label OR first label of an array). Used by quiz-generator.ts
 * before schema validation so the schema's `default(5)` is only hit for
 * truly grade-less inputs.
 */
export function defaultNumQuestionsForGrade(
  grade: string | string[] | undefined | null,
): number {
  const label = Array.isArray(grade) ? grade[0] : grade;
  return defaultNumQuestionsForBand(getGradeBand(label));
}

/**
 * Human-readable band label for prompts. Used in vocabulary-age constraint
 * and pedagogy headers so the model knows exactly which band to target.
 */
export function getBandDisplayLabel(band: GradeBand): string {
  switch (band) {
    case 'primary': return 'Primary (Class 1-5)';
    case 'middle': return 'Middle (Class 6-8)';
    case 'secondary': return 'Secondary (Class 9-10)';
    case 'senior': return 'Senior Secondary (Class 11-12)';
  }
}

/**
 * Band-specific pedagogy framework for the lesson plan prompt (F18-02).
 * The lesson plan template hard-applied the 5E model to every grade,
 * which is age-inappropriate for primary (too abstract) and underspecified
 * for senior secondary (no competitive-exam awareness). This returns a
 * complete Markdown block the prompt template injects directly.
 */
export function getPedagogyFrameworkBlock(band: GradeBand): string {
  switch (band) {
    case 'primary':
      return `**Structural Instructions (Story-Based + Concrete Examples — Primary Band Class 1-5):**
Primary students learn best through narrative, sensory experience, and concrete
manipulation of familiar objects. Use the 5E phase enum (Engage / Explore /
Explain / Elaborate / Evaluate) for the activities array, BUT interpret each
phase the Primary way:
1. **Engage** = Story / song / rhyme. Open with a short story (e.g. "A farmer's daughter named Meera notices that the mango tree...") or a familiar rhyme. Never open with an abstract definition.
2. **Explore** = Show and Tell with REAL, touchable objects (leaves, stones, fruits, rope, sand, pebbles). Every concept must have a physical anchor the child can hold.
3. **Explain** = Teacher demonstrates step-by-step; students repeat in chorus or pairs. Keep sentences very short. Use the mother tongue for any abstract noun.
4. **Elaborate** = A game, drawing, role-play, or song that reinforces the concept. Movement is encouraged.
5. **Evaluate** = 2-3 simple recall questions ("Show me the green leaf", "Which is bigger?"). No abstract reasoning expected.
Avoid: long lectures, abstract definitions before concrete examples, written reflection tasks, multi-step word problems.`;

    case 'middle':
      return `**Structural Instructions (5E Inquiry Model — Middle Band Class 6-8):**
You MUST organize the activities into the 5E Instructional Model:
1. **Engage**: Catch student interest, connect to prior knowledge (e.g., a story, a riddle, or a real-life scenario).
2. **Explore**: Hands-on experience or guided inquiry where students investigate.
3. **Explain**: Direct instruction where the core concept is clarified.
4. **Elaborate**: Applying the concept to new situations or connecting to local Indian context.
5. **Evaluate**: Check for understanding (formative).`;

    case 'secondary':
      return `**Structural Instructions (Structured + Exam-Prep Framework — Secondary Band Class 9-10):**
Class 9-10 students are preparing for Board exams (CBSE / ICSE / State Boards).
Lessons must build conceptual depth AND board-exam readiness. Use the 5E
phase enum (Engage / Explore / Explain / Elaborate / Evaluate), BUT interpret
each phase the Secondary way:
1. **Engage** = 5-min recap of prerequisite concepts + a real-world hook tied to the board syllabus framing.
2. **Explore** = Structured derivation, definitions, and one fully worked example following NCERT framing. Treat this as concept build-up, not open inquiry.
3. **Explain** = Direct explanation of the core theory with at least one worked numerical or analytical example in board-exam style. Annotate the mark distribution where relevant (e.g. "this step would earn 1 mark").
4. **Elaborate** = Practice set mixing short-answer (2-mark) and long-answer (3-5 mark) questions matching board patterns. Explicitly name 1-2 common mistakes students make on board exams for this topic.
5. **Evaluate** = Summary recap + assigned practice problems from NCERT exercises with marks indicated.
Tone: precise, exam-aware, but still rooted in Indian rural / mandi / agricultural examples for context where natural.`;

    case 'senior':
      return `**Structural Instructions (Deep Analysis + Competitive-Exam Awareness — Senior Band Class 11-12):**
Class 11-12 students are preparing for Boards AND competitive entrance exams
(JEE, NEET, CUET, CLAT, etc. depending on stream). Pedagogy must be analytical,
rigorous, and exam-strategy aware. Use the 5E phase enum (Engage / Explore /
Explain / Elaborate / Evaluate), BUT interpret each phase the Senior way:
1. **Engage** = Surface prior knowledge via a probing question; flag this topic's relevance to JEE/NEET/CUET (or the relevant entrance exam for the subject).
2. **Explore** = First-principles derivation or theoretical framing. Do not skip the "why". Include the historical or experimental basis where relevant.
3. **Explain** = Two worked examples — one at NCERT / board-exam difficulty, then a second at competitive-exam (JEE/NEET/CUET) difficulty so students see the analytical jump required.
4. **Elaborate** = Strategy notes naming which sub-topics historically appear in entrance exams + trap distractors to watch for + a practice set of 2 board-level and 2 competitive-level questions with full solutions.
5. **Evaluate** = Synthesis questions that connect this topic to adjacent concepts (e.g., link organic mechanisms to spectroscopy; link integration to area-under-curves).
Tone: precise, analytical, assumes mathematical or scientific maturity. Indian-context examples remain — but at this level "context" can include Indian industry, ISRO missions, national infrastructure, not just rural mandis.`;
  }
}
