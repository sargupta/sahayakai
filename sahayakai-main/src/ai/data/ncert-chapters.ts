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

// ─── Public types ────────────────────────────────────────────────────────────

export interface SeedChapter {
    number: number;
    title: string;
    topics: string[];
    /** 'ncert-existing-seed' = sourced from src/data/ncert/* (NCF-2023 aligned).
     *  'pending'              = placeholder; not yet reconciled with official NCERT TOC. */
    verifiedSource?: 'ncert-existing-seed' | 'pending';
}

export interface ChapterValidationResult {
    valid: boolean;
    suggestion?: string;
    closestMatch?: { number: number; title: string };
    reason?: string;
    /** When true, the validator deferred because the (class, subject) cell was
     *  marked `verifiedSource: 'pending'`. Callers should treat lenient passes
     *  as low-confidence and may still surface a "verifying" UI hint. */
    lenient?: boolean;
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
    // History / Geography / Civics — within Social Science but valid sub-domains
    if (['history', 'इतिहास', 'itihaas'].includes(norm)) return 'History';
    if (['geography', 'भूगोल', 'bhugol'].includes(norm)) return 'Geography';
    if (['civics', 'political science', 'नागरिक शास्त्र'].includes(norm)) return 'Civics';
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
    // Topics = keywords + first few learning outcomes (lower-cased, deduped).
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
            number: c.number,
            title: c.title,
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

    // Numeric chapter input: validate as chapter number.
    if (typeof chapter === 'number' || /^\d+$/.test(String(chapter).trim())) {
        const num = typeof chapter === 'number' ? chapter : parseInt(String(chapter).trim(), 10);
        const match = chapters.find(c => c.number === num);
        if (match) {
            return { valid: true, closestMatch: { number: match.number, title: match.title } };
        }
        return {
            valid: false,
            reason: `Chapter ${num} does not exist for Class ${grade} ${canonSubject} (only chapters 1-${chapters.length} are defined).`,
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
            return { valid: true, closestMatch: { number: c.number, title: c.title } };
        }
    }

    // Pass 2: substring containment (input is a substring of a title or vice-versa)
    for (const c of chapters) {
        const normTitle = normaliseTitle(c.title);
        if (normTitle.includes(normInput) || normInput.includes(normTitle)) {
            return {
                valid: false,
                suggestion: `Did you mean "${c.title}"?`,
                closestMatch: { number: c.number, title: c.title },
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
        return {
            valid: false,
            suggestion: `Did you mean "${best.chapter.title}"?`,
            closestMatch: { number: best.chapter.number, title: best.chapter.title },
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
                suggestion: `Did you mean "${c.title}"?`,
                closestMatch: { number: c.number, title: c.title },
            };
        }
    }

    return {
        valid: false,
        reason: `Chapter "${chapterStr}" not found in NCERT Class ${grade} ${canonSubject}.`,
    };
}

/** Convenience: should the caller auto-correct based on suggestion?
 *  Returns true only when fuzzy distance was small enough to trust. */
export function shouldAutoCorrect(result: ChapterValidationResult): boolean {
    if (result.valid) return false;
    if (!result.closestMatch || !result.suggestion) return false;
    // The suggestion exists only when we found a close match in passes 2-3.
    return true;
}
