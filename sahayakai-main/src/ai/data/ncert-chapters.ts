/**
 * NCERT Chapter Seed — AI-side index for soft validation.
 *
 * This file is the *authoritative seed* the AI flows consult before generating
 * lesson plans, quizzes, and exam papers. It exists separately from
 * `src/data/ncert/**` (the rich teacher-facing curriculum browser) so AI flows
 * have a single, predictable import surface that returns the simplified
 * `{ number, title, topics, verifiedSource }` shape mandated by the AI agent
 * spec.
 *
 * Source of truth: `src/data/ncert/*` (NCERTChapter[] flat list). We adapt
 * that data into a per-(grade × subject) index here so:
 *   - Flows can do O(1) lookups by `Class X` + canonical subject
 *   - We can mark `verifiedSource: 'pending'` on entries we have not
 *     authoritatively reconciled against the published NCERT title list
 *   - We do not duplicate or fork the teacher-facing chapter content
 *
 * For the demo, the *critical accuracy* cells (verified by hand against the
 * existing rich dataset which mirrors official NCERT/NCF-2023 textbooks) are:
 *   - Class 10 Mathematics
 *   - Class 9  Mathematics
 *   - Class 8  Science (Force and Pressure, Friction, Sound, Chemical Effects…)
 *   - Class 5  EVS / Math
 *
 * Anything in the existing dataset is exposed with `verifiedSource:
 * 'ncert-existing-seed'`; anything we synthesised here as a placeholder is
 * marked `verifiedSource: 'pending'` so the validator stays lenient but the
 * UI can surface the caveat.
 */

import { allNCERTChapters, type NCERTChapter as RichNCERTChapter } from '@/data/ncert';
import { RATIONALIZED_OUT } from '@/data/ncert/rationalized-out';
import { CHAPTER_TOPIC_IDS, getTopicById } from '@/data/ncert/topics';

// ─── Public types ────────────────────────────────────────────────────────────

export interface SeedChapter {
    /** Stable chapter id from the rich taxonomy (e.g. 'math-10-1'). This is the
     *  rename-proof join key PYQ retrieval uses — carried through from
     *  `src/data/ncert/*` so `resolveChapterId` can return it. */
    id: string;
    number: number;
    title: string;
    /** Former / variant titles that resolve to this chapter (Phase 2). */
    aliases?: string[];
    /** MEMBERSHIP (Phase 4): first-class topic ids this chapter contains, or
     *  undefined for unseeded chapters (chapter-level retrieval only). */
    topicIds?: string[];
    topics: string[];
    /** 'ncert-existing-seed' = sourced from src/data/ncert/* (NCF-2023 aligned).
     *  'pending'              = placeholder; not yet reconciled with official NCERT TOC. */
    verifiedSource?: 'ncert-existing-seed' | 'pending';
}

export interface ChapterValidationResult {
    valid: boolean;
    suggestion?: string;
    closestMatch?: { id: string; number: number; title: string };
    reason?: string;
    /** When true, the validator deferred because the (class, subject) cell was
     *  marked `verifiedSource: 'pending'`. Callers should treat lenient passes
     *  as low-confidence and may still surface a "verifying" UI hint. */
    lenient?: boolean;
    /** How trustworthy the `closestMatch` is (H7):
     *  - 'exact'  numeric-unique / exact-title / alias hit — safe to commit as a
     *             stable join key or accept silently.
     *  - 'fuzzy'  small Levenshtein typo (dist ≤ 2) — good enough to *suggest* an
     *             auto-correct, but NOT to persist as an id.
     *  - 'weak'   substring / token-overlap / dist-3 guess — surface as a hint
     *             only; never auto-correct, never persist. */
    confidence?: 'exact' | 'fuzzy' | 'weak';
}

// ─── Canonical aliases ───────────────────────────────────────────────────────

/** Map any incoming subject string to a canonical key used in CHAPTERS_INDEX. */
export function canonicaliseSubject(input: string): string | null {
    const norm = input.trim().toLowerCase();
    if (!norm) return null;

    // Mathematics
    if (['math', 'maths', 'mathematics', 'गणित', 'ganit', 'arithmetic', 'algebra'].includes(norm)) {
        return 'Mathematics';
    }
    // Science (Grades 6-10)
    if (['science', 'sci', 'विज्ञान', 'vigyan', 'physical science', 'natural science'].includes(norm)) {
        return 'Science';
    }
    // EVS (Grades 3-5)
    if (['evs', 'environmental studies', 'environmental studies (evs)', 'environment', 'looking around', 'पर्यावरण', 'paryavaran'].includes(norm)) {
        return 'EVS';
    }
    // Social Science / Studies
    if (['social science', 'social studies', 'sst', 'social', 'सामाजिक विज्ञान', 'samajik vigyan'].includes(norm)) {
        return 'Social Studies';
    }
    // History / Geography / Civics — sub-domains of Social Science. The seed
    // indexes them under the single 'Social Studies' cell (rich subject), so
    // fold them there; emitting the sub-domain names left them in a dead lenient
    // branch that never resolved a chapter (L13).
    if (['history', 'इतिहास', 'itihaas',
         'geography', 'भूगोल', 'bhugol',
         'civics', 'political science', 'नागरिक शास्त्र'].includes(norm)) {
        return 'Social Studies';
    }
    // English
    if (['english', 'eng', 'अंग्रेज़ी', 'angrezi'].includes(norm)) return 'English';
    // Hindi
    if (['hindi', 'hin', 'हिंदी', 'हिन्दी'].includes(norm)) return 'Hindi';
    // Sciences split (Class 11-12)
    if (['physics', 'भौतिकी', 'bhautiki'].includes(norm)) return 'Physics';
    if (['chemistry', 'रसायन विज्ञान', 'rasayan'].includes(norm)) return 'Chemistry';
    if (['biology', 'जीव विज्ञान', 'jeev vigyan'].includes(norm)) return 'Biology';
    // Languages
    if (['sanskrit', 'संस्कृत'].includes(norm)) return 'Sanskrit';
    if (['kannada', 'ಕನ್ನಡ'].includes(norm)) return 'Kannada';
    if (['tamil', 'தமிழ்'].includes(norm)) return 'Tamil';
    if (['telugu', 'తెలుగు'].includes(norm)) return 'Telugu';
    if (['marathi', 'मराठी'].includes(norm)) return 'Marathi';
    if (['bengali', 'bangla', 'বাংলা'].includes(norm)) return 'Bengali';
    if (['gujarati', 'ગુજરાતી'].includes(norm)) return 'Gujarati';
    if (['punjabi', 'ਪੰਜਾਬੀ'].includes(norm)) return 'Punjabi';
    if (['malayalam', 'മലയാളം'].includes(norm)) return 'Malayalam';
    if (['urdu', 'اردو'].includes(norm)) return 'Urdu';

    return null;
}

/** Map any grade-level string to a numeric class (1-12), or null. */
export function canonicaliseGrade(input: string | number): number | null {
    if (typeof input === 'number') {
        return input >= 1 && input <= 12 ? input : null;
    }
    const raw = String(input).trim().toLowerCase();
    if (!raw) return null;

    // Roman numerals: I–XII
    const roman: Record<string, number> = {
        'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6,
        'vii': 7, 'viii': 8, 'ix': 9, 'x': 10, 'xi': 11, 'xii': 12,
    };
    // Strip leading "class " or "grade " / trailing "th"/"st"/"nd"/"rd"
    const stripped = raw
        .replace(/^class\s+/, '')
        .replace(/^grade\s+/, '')
        .replace(/(st|nd|rd|th)$/, '')
        .trim();

    if (roman[stripped]) return roman[stripped];

    const n = parseInt(stripped, 10);
    if (!isNaN(n) && n >= 1 && n <= 12) return n;
    return null;
}

// ─── Build CHAPTERS_INDEX from existing rich data ────────────────────────────

/** Key shape: `${grade}:${canonicalSubject}` → SeedChapter[] */
type IndexKey = string;
const indexKey = (grade: number, subject: string): IndexKey => `${grade}:${subject}`;

function topicsFor(c: RichNCERTChapter): string[] {
    // Phase 4: when a chapter has authored first-class topics, `topics` mirrors
    // their titles (incl. retained-inactive — the classification menu needs
    // them). Otherwise fall back to the keyword ∪ learning-outcome bag so every
    // chapter that had a non-empty `topics` before still does.
    const topicIds = CHAPTER_TOPIC_IDS[c.id];
    if (topicIds && topicIds.length > 0) {
        const titles = topicIds
            .map(id => getTopicById(id)?.title)
            .filter((t): t is string => Boolean(t));
        return [...new Set(titles)];
    }
    const merged = [...(c.keywords ?? []), ...(c.learningOutcomes ?? [])]
        .map(t => t.toLowerCase().trim())
        .filter(Boolean);
    return [...new Set(merged)];
}

/** Map rich `subject` field to canonical seed key. Most are 1:1; a few aliases. */
function richSubjectToCanonical(richSubject: string): string {
    if (richSubject === 'Information Technology') return 'Information Technology';
    return richSubject; // already canonical: Mathematics, Science, EVS, Social Studies, English, Hindi, …
}

const CHAPTERS_INDEX: Map<IndexKey, SeedChapter[]> = (() => {
    const m = new Map<IndexKey, SeedChapter[]>();
    for (const c of allNCERTChapters) {
        if (c.isActive === false) continue;
        const canonical = richSubjectToCanonical(c.subject);
        const key = indexKey(c.grade, canonical);
        const list = m.get(key) ?? [];
        list.push({
            id: c.id,
            number: c.number,
            title: c.title,
            ...(c.aliases && c.aliases.length > 0 ? { aliases: c.aliases } : {}),
            ...(CHAPTER_TOPIC_IDS[c.id] ? { topicIds: CHAPTER_TOPIC_IDS[c.id] } : {}),
            topics: topicsFor(c),
            verifiedSource: 'ncert-existing-seed',
        });
        m.set(key, list);
    }
    // Sort each list by chapter number for determinism.
    for (const list of m.values()) list.sort((a, b) => a.number - b.number);
    return m;
})();

// Subjects/grades the existing dataset does not cover get *pending* placeholders.
// Today the existing dataset already covers Grades 1-12 across the in-scope
// subjects, so this map stays small. Keeping the hook here means any future
// addition (e.g. CBSE Class 11 IT, regional state-board chapters) can be
// patched in without touching flows.
const PENDING_FALLBACK: Map<IndexKey, SeedChapter[]> = new Map();

/** Public read API — returns chapters for a (grade, subject) cell or []. */
export function getChaptersForCell(grade: number, canonicalSubject: string): SeedChapter[] {
    const key = indexKey(grade, canonicalSubject);
    return CHAPTERS_INDEX.get(key) ?? PENDING_FALLBACK.get(key) ?? [];
}

/** Cells the seed authoritatively covers (for diagnostics, coverage reports). */
export function listCoveredCells(): Array<{ grade: number; subject: string; chapterCount: number }> {
    const cells: Array<{ grade: number; subject: string; chapterCount: number }> = [];
    for (const [key, list] of CHAPTERS_INDEX.entries()) {
        const [gradeStr, subject] = key.split(':');
        cells.push({ grade: parseInt(gradeStr, 10), subject, chapterCount: list.length });
    }
    return cells.sort((a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject));
}

// ─── Topic accessors (Phase 4) ───────────────────────────────────────────────
// The contract retrieval + backfill code consumes. Chapter membership and topic
// currency are authored in `src/data/ncert/topics.ts`; these adapt it to the
// stable-id shape those flows need.

/**
 * Ordered classification menu for a chapter (the LLM picks from this at
 * ingestion). Includes retained-inactive topics so old PYQs can still map to
 * what they test. Empty `[]` when the chapter has no authored topics.
 */
export function getTopicMenu(chapterId: string): { topicId: string; title: string; titleHindi?: string; isActive: boolean }[] {
    const ids = CHAPTER_TOPIC_IDS[chapterId] ?? [];
    const menu: { topicId: string; title: string; titleHindi?: string; isActive: boolean }[] = [];
    for (const id of ids) {
        const t = getTopicById(id);
        if (t) menu.push({ topicId: t.topicId, title: t.title, titleHindi: t.titleHindi, isActive: t.isActive !== false });
    }
    return menu;
}

/**
 * Active topic ids for a chapter — retrieval query leg (b)
 * (`array-contains-any`). Excludes `isActive:false`. Empty `[]` when the chapter
 * has no authored / no active topics (retrieval falls back to the chapterId leg).
 */
export function getActiveTopicIds(chapterId: string): string[] {
    return (CHAPTER_TOPIC_IDS[chapterId] ?? []).filter(id => getTopicById(id)?.isActive !== false);
}

/**
 * Live currency check for the retrieval filter. Unknown topicId → false
 * (conservative: an untaggable/removed topic is treated as off-syllabus).
 */
export function isTopicActive(topicId: string): boolean {
    const t = getTopicById(topicId);
    return t !== undefined && t.isActive !== false;
}

// ─── Fuzzy matcher ───────────────────────────────────────────────────────────

/** Levenshtein distance — capped at `max + 1` for early exit. Pure, no deps. */
function levenshtein(a: string, b: string, max = 5): number {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const al = a.length;
    const bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    let prev = new Array(bl + 1);
    let curr = new Array(bl + 1);
    for (let j = 0; j <= bl; j++) prev[j] = j;
    for (let i = 1; i <= al; i++) {
        curr[0] = i;
        let rowMin = curr[0];
        for (let j = 1; j <= bl; j++) {
            const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
            curr[j] = Math.min(
                curr[j - 1] + 1,
                prev[j] + 1,
                prev[j - 1] + cost
            );
            if (curr[j] < rowMin) rowMin = curr[j];
        }
        if (rowMin > max) return max + 1;
        [prev, curr] = [curr, prev];
    }
    return prev[bl];
}

function normaliseTitle(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9\s]+/g, '').replace(/\s+/g, ' ').trim();
}

// ─── validateChapter ─────────────────────────────────────────────────────────

/**
 * Validate a (gradeLevel, subject, chapter) triple against the NCERT seed.
 *
 * Behavior contract (soft validation — never throws):
 *   - Unknown grade/subject → valid:true + lenient:true (so flows don't block)
 *   - Unknown grade or subject we *do* have coverage for → valid:false + reason
 *   - Empty chapter input → valid:true (chapter optional — topic-driven flows)
 *   - Chapter passed as number → must be a valid chapter index for that cell
 *   - Chapter passed as exact title → valid:true
 *   - Chapter close-match (levenshtein 1–3 OR substring of a title) → valid:false
 *     + suggestion + closestMatch (high-confidence auto-correct candidate
 *     when dist ≤ 2)
 *   - Chapter completely unknown → valid:false + reason
 *   - Cell exists only as PENDING placeholder → valid:true + lenient:true
 */
export function validateChapter(
    gradeLevel: string | number,
    subject: string,
    chapter: string | number,
): ChapterValidationResult {
    const grade = canonicaliseGrade(gradeLevel);
    if (grade === null) {
        return { valid: true, lenient: true, reason: `Unrecognised grade "${gradeLevel}" — skipping NCERT validation.` };
    }

    let canonSubject = canonicaliseSubject(subject);
    if (canonSubject === null) {
        return { valid: true, lenient: true, reason: `Unrecognised subject "${subject}" — skipping NCERT validation.` };
    }

    // EVS↔Science overlap: in NCERT, Grades 3-5 study "EVS" (which is the
    // Science/Social hybrid book). Teachers commonly call it "Science" at
    // primary level. Re-route to EVS if Science was asked for and the grade
    // doesn't have a dedicated Science cell.
    if (canonSubject === 'Science' && grade <= 5 && getChaptersForCell(grade, 'Science').length === 0) {
        canonSubject = 'EVS';
    }
    // Inverse: an upper-primary EVS request (grades 6+) should fall back to
    // Science, where the seed lives.
    if (canonSubject === 'EVS' && grade >= 6 && getChaptersForCell(grade, 'EVS').length === 0) {
        canonSubject = 'Science';
    }

    const chapters = getChaptersForCell(grade, canonSubject);
    if (chapters.length === 0) {
        return {
            valid: true,
            lenient: true,
            reason: `No NCERT seed data for Class ${grade} ${canonSubject} — proceeding without chapter validation.`,
        };
    }

    // Numeric chapter input: validate as chapter number. A cell can hold several
    // chapters sharing a number (e.g. Class 10 Social Studies numbers History,
    // Geography, Civics & Economics books all from 1) — so a bare number is only
    // unambiguous when exactly one chapter carries it (H9).
    if (typeof chapter === 'number' || /^\d+$/.test(String(chapter).trim())) {
        const num = typeof chapter === 'number' ? chapter : parseInt(String(chapter).trim(), 10);
        const matches = chapters.filter(c => c.number === num);
        if (matches.length === 1) {
            const m = matches[0];
            return { valid: true, confidence: 'exact', closestMatch: { id: m.id, number: m.number, title: m.title } };
        }
        if (matches.length > 1) {
            const titles = matches.map(m => `"${m.title}"`).join(', ');
            return {
                valid: false,
                reason: `Chapter ${num} is ambiguous for Class ${grade} ${canonSubject} — it spans multiple textbooks (${titles}); specify by title.`,
            };
        }
        const maxNumber = chapters.reduce((mx, c) => Math.max(mx, c.number), 0);
        return {
            valid: false,
            reason: `Chapter ${num} does not exist for Class ${grade} ${canonSubject} (only chapters 1-${maxNumber} are defined).`,
        };
    }

    const chapterStr = String(chapter).trim();
    if (!chapterStr) {
        // Empty / no chapter supplied → caller is using a free-form topic; skip.
        return { valid: true, lenient: true };
    }

    const normInput = normaliseTitle(chapterStr);

    // Pass 1: exact (case-insensitive) match
    for (const c of chapters) {
        if (normaliseTitle(c.title) === normInput) {
            return { valid: true, confidence: 'exact', closestMatch: { id: c.id, number: c.number, title: c.title } };
        }
    }

    // Pass 1b: alias match (Phase 2). A former/variant title recorded on the
    // chapter resolves deterministically to it — this is how known renames and
    // common PYQ spelling variants map without relying on fuzzy heuristics.
    // Treated as a confident hit: valid + closestMatch (the canonical chapter).
    for (const c of chapters) {
        if (c.aliases?.some(a => normaliseTitle(a) === normInput)) {
            return { valid: true, confidence: 'exact', closestMatch: { id: c.id, number: c.number, title: c.title } };
        }
    }

    // Pass 2: substring containment (input is a substring of a title or vice-versa)
    for (const c of chapters) {
        const normTitle = normaliseTitle(c.title);
        if (normTitle.includes(normInput) || normInput.includes(normTitle)) {
            return {
                valid: false,
                confidence: 'weak',
                suggestion: `Did you mean "${c.title}"?`,
                closestMatch: { id: c.id, number: c.number, title: c.title },
            };
        }
    }

    // Pass 3: fuzzy Levenshtein on full title
    let best: { dist: number; chapter: SeedChapter } | null = null;
    for (const c of chapters) {
        const dist = levenshtein(normInput, normaliseTitle(c.title), 5);
        if (best === null || dist < best.dist) {
            best = { dist, chapter: c };
        }
    }

    if (best && best.dist <= 3) {
        // dist ≤ 2 is a trustworthy typo (auto-correctable); dist === 3 is a
        // weaker guess we only surface as a hint (H7).
        return {
            valid: false,
            confidence: best.dist <= 2 ? 'fuzzy' : 'weak',
            suggestion: `Did you mean "${best.chapter.title}"?`,
            closestMatch: { id: best.chapter.id, number: best.chapter.number, title: best.chapter.title },
        };
    }

    // Pass 4: token overlap on topics (catches "Quadratic Equations" → "quadratic")
    const inputTokens = new Set(normInput.split(' ').filter(t => t.length >= 3));
    for (const c of chapters) {
        const titleTokens = new Set(normaliseTitle(c.title).split(' '));
        let overlap = 0;
        for (const t of inputTokens) if (titleTokens.has(t)) overlap++;
        if (overlap >= 1 && inputTokens.size <= 3) {
            return {
                valid: false,
                confidence: 'weak',
                suggestion: `Did you mean "${c.title}"?`,
                closestMatch: { id: c.id, number: c.number, title: c.title },
            };
        }
    }

    return {
        valid: false,
        reason: `Chapter "${chapterStr}" not found in NCERT Class ${grade} ${canonSubject}.`,
    };
}

/** Convenience: should the caller auto-correct based on suggestion?
 *  Returns true only for a small-typo ('fuzzy') match — substring / token-overlap
 *  / dist-3 ('weak') guesses are surfaced as hints but not silently applied (H7). */
export function shouldAutoCorrect(result: ChapterValidationResult): boolean {
    if (result.valid) return false;
    return result.confidence === 'fuzzy';
}

/**
 * Resolve a (possibly messy or outdated) chapter title to the STABLE chapter id
 * (`NCERTChapter.id`, e.g. 'math-10-1') — the rename-proof join key PYQ retrieval
 * and ingestion use instead of the volatile display title (Phase 1).
 *
 * Reuses `validateChapter`'s 4-pass match but commits ONLY an `'exact'` hit
 * (numeric-unique / exact-title / alias) as the persisted id — a fuzzy typo or
 * a substring/token-overlap guess is too weak to bake into a rename-proof join
 * key and would silently mis-bind PYQs (H7/M8). Returns null otherwise (caller
 * treats as unmappable → title fallback / orphan report; never blocks). Alias
 * resolution (Phase 2) rides for free here — aliases resolve as 'exact'.
 */
export function resolveChapterId(
    gradeLevel: string | number,
    subject: string,
    title: string | number,
): string | null {
    if (title === null || title === undefined || String(title).trim() === '') return null;
    const result = validateChapter(gradeLevel, subject, title);
    return result.confidence === 'exact' ? (result.closestMatch?.id ?? null) : null;
}

// ─── Currency (rationalized-out) check ───────────────────────────────────────

/** Removed chapters indexed by cell → normalized title/alias set (Phase 3). */
const REMOVED_INDEX: Map<IndexKey, string[]> = (() => {
    const m = new Map<IndexKey, string[]>();
    for (const c of RATIONALIZED_OUT) {
        const canon = canonicaliseSubject(c.subject) ?? c.subject;
        const key = indexKey(c.grade, canon);
        const forms = [c.title, ...(c.aliases ?? [])].map(normaliseTitle);
        m.set(key, [...(m.get(key) ?? []), ...forms]);
    }
    return m;
})();

/**
 * Is this (gradeLevel, subject, chapter) a chapter the board REMOVED from the
 * current syllabus (Phase 3)? Lets retrieval distinguish "off-syllabus → do not
 * serve" from "unknown chapter → title fallback". Matches on normalized title or
 * a recorded alias. Never throws; unknown grade/subject → false.
 */
export function isChapterRemoved(
    gradeLevel: string | number,
    subject: string,
    chapter: string | number | null | undefined,
): boolean {
    const grade = canonicaliseGrade(gradeLevel);
    const canonSubject = canonicaliseSubject(subject);
    if (grade === null || canonSubject === null) return false;
    const chapterStr = String(chapter ?? '').trim();
    if (!chapterStr) return false;
    const removed = REMOVED_INDEX.get(indexKey(grade, canonSubject));
    if (!removed) return false;
    return removed.includes(normaliseTitle(chapterStr));
}
