import { ai } from '@/ai/genkit';
import { SAHAYAK_SOUL_PROMPT, STRUCTURED_OUTPUT_OVERRIDE } from '@/ai/soul';

import {
    VideoStorytellerInputSchema,
    VideoStorytellerOutputSchema,
    type VideoStorytellerInput,
    type VideoCandidate,
} from '@/ai/schemas/video-storyteller';


/**
 * Ranks a pool of candidate videos into categories using 3-tier authority scoring
 * + quota-based distribution.
 *
 * KEY DESIGN DECISIONS:
 * 1. Three-tier authority: Govt/Formal (20) > NGO/Community (12) > Quality EdTech (6)
 *    State SCERT channels = Tier 1 for their state's teachers (equal to central govt).
 *    Commercial coaching institutes (Vedantu, BYJU's, PW) get 0 — they make content
 *    for students prepping for exams, not for classroom teachers.
 * 2. Language-first: +15 boost when video matches teacher's selected language.
 *    Language is politically and culturally sensitive — we never default to Hindi.
 * 3. Semi-urban teacher boost: classroom, blackboard, NISHTHA, DIKSHA, Indic script.
 * 4. QUOTA-BASED distribution replaces winner-take-all:
 *    - Phase 1: guarantee MIN_QUOTA (12) for every category
 *    - Phase 2: fill each to TARGET (30)
 *    - Phase 3: top up to MAX (60) with any remaining relevant videos
 *    This ensures all 5 carousels always have substantial content.
 */
function rankVideosLocal(
    subject: string,
    gradeLevel: string,
    candidates: VideoCandidate[],
    topic?: string,
    language?: string,
    state?: string,
    educationBoard?: string
): Record<string, VideoCandidate[]> {
    if (candidates.length === 0) return {
        storytelling: [], pedagogy: [], courses: [], govtUpdates: [], topRecommended: []
    };

    // ── Tier 1: Government / Formal Education ─────────────────────────────────
    // Includes both Central govt AND State SCERT/DD regional channels.
    // State channels are equally authoritative for their state's teachers.
    const GOVT_TIER1 = new Set([
        // Central government
        'UCT0s92hGjqLX6p7qY9BBrSA', // NCERT Official (+ CIET + PM e-Vidya)
        'UCp2smQxAyu_09vXiPJ3vTTg', // Ministry of Education India
        'UCA7OQkX9AEIVQ6j9i0OSQhA', // CEC-UGC
        'UCaIXqbYp2OJ4fdTM4JqZuDg', // IGNOU
        'UC37XfXzS9Lp8XG-rW5_p0HA', // NIOS
        'UCFcnk6dM0LOIw6_Y8TGTIZQ', // Vigyan Prasar
        'UCJLZe_NoFcFPaAGgEtDSIbA', // SWAYAM / NPTEL
        'UCmFpTYjYEiU2QCPF7kFzFtQ', // PIB India
        'UCF57zF3at6kezb2_Xu73euA', // DD News
        'UCrL_FGRQ8bdDtf9FW19-vIA', // AIICT Education
        // State SCERT / State Education Departments
        'UCMBqaUcHMZMzPESmB9GXRWA', // Maharashtra SCERT / Balbharati (Marathi)
        'UCKe9f9xU4nzXpSoLGFHJLwg', // Kerala SCERT (Malayalam)
        'UCEuMGDfGkL_xZqRqpHJ0Kzw', // Karnataka DSERT / KTBS (Kannada)
        'UCN4DCiSAnCg4RnDQzCHf8Kw', // Tamil Nadu SCERT (Tamil)
        'UCjpyTm5Nk5gT0FtCj9mifJg', // AP SCERT (Telugu)
        'UCvKo9GHDPWGmK-MBfKFYCYQ', // Telangana SCERT (Telugu)
        'UCMkqMuC3GpPIHFpN6A5H8Ug', // GCERT Gujarat (Gujarati)
        'UCTuJpGBqP7g2UGBV2Q9HPPA', // SCERT Rajasthan (Hindi)
        'UCnIBBgcY7c5EBuJWCKHLv-w', // SCERT UP (Hindi)
        'UCcZkua98s7EBgM7JvHx_kxA', // West Bengal SCERT (Bengali)
        'UCJJzz4M1KLmWlGWtA2Tze7Q', // Punjab SCERT (Punjabi)
        'UC2y0GHgQ_DTqTsEcT5jJtmQ', // Odisha SCERT (Odia)
        'UCqS9WZ7dqwH5uGmqmfJc6hQ', // SCERT Assam (Assamese)
        // Doordarshan regional (state public broadcaster)
        'UCrP1-MtNhpHJ2Qf0TdHKS4Q', // DD Sahyadri (Marathi)
        'UCK0aqc0zr9pJTVmHUAYNiVA', // DD Chandana (Kannada)
        'UCJMpPpRtVGUyMTfH8MVGXCA', // DD Podhigai (Tamil)
        'UCbA4HlEVXBT-0OfmyAJHxwA', // DD Yadagiri (Telugu)
        'UCWwnQPMqnkUWCt4mUc3acHQ', // DD Bangla (Bengali)
    ]);

    // ── State-specific channels ────────────────────────────────────────────────
    // Dynamically built from STATE_EDUCATION_CONFIG — not hardcoded per call.
    // Import inline to avoid circular dependency.
    // These channels get stateBoost (+12) because they produce content
    // specifically aligned with that state's curriculum and language.
    // We use a static import-time lookup — the config is in youtube-channels.ts
    // but we inline the relevant IDs here for performance (no async in ranking).
    // NOTE: Channel IDs here match exactly what's in STATE_EDUCATION_CONFIG.
    const STATE_SCERT_CHANNELS: Record<string, string[]> = {
        'Andhra Pradesh':    ['UCjpyTm5Nk5gT0FtCj9mifJg', 'UCbA4HlEVXBT-0OfmyAJHxwA'],
        'Assam':             ['UCqS9WZ7dqwH5uGmqmfJc6hQ'],
        'Gujarat':           ['UCMkqMuC3GpPIHFpN6A5H8Ug'],
        'Karnataka':         ['UCEuMGDfGkL_xZqRqpHJ0Kzw', 'UCK0aqc0zr9pJTVmHUAYNiVA'],
        'Kerala':            ['UCKe9f9xU4nzXpSoLGFHJLwg'],
        'Maharashtra':       ['UCMBqaUcHMZMzPESmB9GXRWA', 'UCrP1-MtNhpHJ2Qf0TdHKS4Q'],
        'Odisha':            ['UC2y0GHgQ_DTqTsEcT5jJtmQ'],
        'Punjab':            ['UCJJzz4M1KLmWlGWtA2Tze7Q'],
        'Rajasthan':         ['UCTuJpGBqP7g2UGBV2Q9HPPA'],
        'Tamil Nadu':        ['UCN4DCiSAnCg4RnDQzCHf8Kw', 'UCJMpPpRtVGUyMTfH8MVGXCA'],
        'Telangana':         ['UCvKo9GHDPWGmK-MBfKFYCYQ', 'UCbA4HlEVXBT-0OfmyAJHxwA'],
        'Uttar Pradesh':     ['UCnIBBgcY7c5EBuJWCKHLv-w'],
        'West Bengal':       ['UCcZkua98s7EBgM7JvHx_kxA', 'UCWwnQPMqnkUWCt4mUc3acHQ'],
    };
    const stateScertIds = state ? new Set(STATE_SCERT_CHANNELS[state] || []) : new Set<string>();

    // ── Board-aligned channels ────────────────────────────────────────────────
    // CBSE → NCERT (NCERT IS the CBSE curriculum authority)
    // ICSE → CEC-UGC + Khan Academy (academic, global alignment)
    // State Board → already handled by stateScertIds above
    const CBSE_ALIGNED = new Set(['UCT0s92hGjqLX6p7qY9BBrSA', 'UCR3ZOcUoPHiFGd-Q9FwV-yA']); // NCERT, Khan Academy
    const ICSE_ALIGNED = new Set(['UCA7OQkX9AEIVQ6j9i0OSQhA', 'UCR3ZOcUoPHiFGd-Q9FwV-yA']); // CEC-UGC, Khan Academy
    const isCBSE = educationBoard === 'CBSE';
    const isICSE = educationBoard?.startsWith('ICSE');

    // ── Tier 2: NGO / Community Education ────────────────────────────────────
    // Organisations working directly in Indian classrooms — relatable for semi-urban teachers.
    const NGO_TIER2 = new Set([
        'UCV5w3dqPZL23JSjdAfsJpzw', // Let's LEARN
        'UCFidunW38-O2R0V1E9t2cKA', // Teach For India
        'UC0e9e-XlU6h8yW3o_d0m2Lg', // Azim Premji Foundation
        'UCcY7dEGfuuGc3VgKhVdVAMQ', // Room to Read India
        'UCVdReFH-HbVLkDzXCm1Gc3A', // iDiscoveri Education
        'UC1ib4-FWM5LPVBpFYHWnkig', // Pratham Education Foundation
        'UCBBbkBiYEdpKhOkOfj8KFhA', // Eklavya Foundation
        'UCy5_rlLzMv_i3OXX2HetGbA', // Teacher Solid
        'UCJHsSwkiNBSyQJ9UkiCqAaQ', // CEE India
        'UCM7O7-6tDuE0OIkbBTiafJQ', // Quest Alliance
        'UCc8mGNrTtinb0T5DOIabyqg', // Sankalp India Foundation
    ]);

    // ── Tier 3: Quality-aligned EdTech ────────────────────────────────────────
    // NCERT-aligned or language-supportive. Moderate trust.
    const QUALITY_TIER3 = new Set([
        'UCR3ZOcUoPHiFGd-Q9FwV-yA', // Khan Academy India
        'UCPaGYBr5v20Tc7uxAbKNVhQ', // Smart Learning for All
        'UCKlJf-hdpWiCFRisSq3-_lw', // Magnet Brains
        'UCqXgFDHMfSmq0CX5dCBfLcw', // Iken Edu
        'UCy9qSctGXf9rCCR7P2XOEHA', // Hindi Medium
        'UCFmBWgY4YOwaCNFLBShY2tg', // Geethanjali Kids
        'UCkIbWQlQl_VoB7j6D_c-JIA', // Katha Kids
        'UCzScGx9N8BkrLvp5PaE7N3Q', // Bharat Tales
        'UCq2qHFQsJJxUbJgFiDN1y2Q', // Manocha Academy
        'UC7f2MJ7EL3Z6DShBCCf7F_Q', // Tiwari Academy
        'UCbMOGhiuFKJZYLHB8dfD0yA', // Dronstudy
        'UCyO_bQ6ILqhD1OHmMLMRdqg', // Hindi Gyan
    ]);
    // Note: Vedantu, BYJU's, Physics Wallah, Unacademy, Study IQ = Tier 0 (0 pts).
    // Their content targets students for competitive exams — not relevant for teachers.

    // ── Language detection ─────────────────────────────────────────────────────
    // Language is a sensitive issue in India — we never assume Hindi.
    // When the teacher selects a language, videos in that language get a strong boost.
    // We detect language from: (a) Indic script in title, (b) language keyword in title/channel.
    const LANGUAGE_SCRIPT_MAP: Record<string, RegExp> = {
        'Hindi':     /[\u0900-\u097F]/,  // Devanagari (shared with Marathi, Maithili etc.)
        'Marathi':   /[\u0900-\u097F]/,  // Devanagari — channel name / title keyword distinguishes
        'Bengali':   /[\u0980-\u09FF]/,
        'Gujarati':  /[\u0A80-\u0AFF]/,
        'Punjabi':   /[\u0A00-\u0A7F]/,  // Gurmukhi
        'Odia':      /[\u0B00-\u0B7F]/,
        'Tamil':     /[\u0B80-\u0BFF]/,
        'Telugu':    /[\u0C00-\u0C7F]/,
        'Kannada':   /[\u0C80-\u0CFF]/,
        'Malayalam': /[\u0D00-\u0D7F]/,
        'Assamese':  /[\u0980-\u09FF]/,  // Assamese uses Bengali script
    };
    // Keywords that confirm a specific language when Devanagari alone is ambiguous
    const LANGUAGE_KEYWORD_MAP: Record<string, string[]> = {
        'Marathi':   ['marathi', 'महाराष्ट्र', 'मराठी'],
        'Hindi':     ['hindi', 'हिंदी', 'हिन्दी'],
        'Assamese':  ['assamese', 'assam', 'অসমীয়া'],
        'Tamil':     ['tamil', 'தமிழ்'],
        'Telugu':    ['telugu', 'తెలుగు'],
        'Kannada':   ['kannada', 'ಕನ್ನಡ'],
        'Malayalam': ['malayalam', 'മലയാളം'],
        'Bengali':   ['bengali', 'bangla', 'বাংলা'],
        'Gujarati':  ['gujarati', 'ગુજરાતી'],
        'Punjabi':   ['punjabi', 'ਪੰਜਾਬੀ'],
        'Odia':      ['odia', 'oriya', 'ଓଡ଼ିଆ'],
        'English':   ['english'],
    };

    const getLanguageBoost = (title: string, channelTitle: string, lang?: string): number => {
        if (!lang || lang === 'English') return 0;
        const text = `${title} ${channelTitle}`.toLowerCase();
        const scriptRegex = LANGUAGE_SCRIPT_MAP[lang];
        const keywords = LANGUAGE_KEYWORD_MAP[lang] || [];
        const hasScript = scriptRegex ? scriptRegex.test(title) : false;
        const hasKeyword = keywords.some(kw => text.includes(kw));
        // Strong boost for explicit language match; moderate for script-only (Devanagari ambiguity)
        if (hasKeyword) return 15;
        if (hasScript) return 8;
        return 0;
    };

    // ── Semi-urban classroom relevance boosts ─────────────────────────────────
    const CLASSROOM_KWS = [
        'classroom', 'blackboard', 'chalk', 'activity', 'practical',
        'nishtha', 'diksha', 'nipun', 'tarl', 'fln',
        'shikshak', 'adhyapak', 'primary teacher', 'foundational literacy',
        'remedial', 'government school', 'sarkari', 'joyful learning',
        'up board', 'mp board', 'state board', 'child centred',
        'lesson plan', 'learning outcome', 'inclusive classroom',
    ];

    // ── Content to penalise — not for school teachers ─────────────────────────
    // Exam coaching for students, college/university level, and non-school content.
    const EXAM_KWS = [
        // Student entrance/competitive exam content
        'iit jee', 'neet', 'entrance exam', 'crash course', 'rank booster',
        'jee main', 'jee advanced', 'neet ug', 'cuet', 'cat exam', 'gate exam',
        // College/university level content
        'undergraduate', 'postgraduate', 'b.tech', 'bca ', 'mba ', 'bcom',
        'university lecture', 'college lecture', 'degree course',
        'ugc net', 'upsc', 'ssc cgl', 'civil services',
        // NPTEL / IIT lecture series — engineering/college level, not school
        'nptel', 'iit madras', 'iit delhi', 'iit bombay', 'iit kharagpur',
        'iit roorkee', 'iit kanpur', 'iitm ', 'iit lecture',
        // Student-facing events (not teacher training)
        'pariksha pe charcha', 'ppc 2', 'ppc 20', // PM's annual student event
    ];

    // ── Per-category keyword banks ─────────────────────────────────────────────
    const CATEGORY_KWS: Record<string, string[]> = {
        storytelling: [
            'story', 'animated', 'animation', 'narrative', 'kahani', 'katha',
            'explanation', 'concept', 'visual', 'explainer', 'chapter', 'lesson',
            'interesting', 'magic', 'wonder', 'ncert chapter', 'class activity',
        ],
        pedagogy: [
            'pedagogy', 'teaching method', 'classroom management', 'active learning',
            'experiential', 'scaffolding', 'differentiated', 'assessment', 'feedback',
            'inclusive education', 'cpd', 'joyful learning', 'constructivist',
            'nep 2020', 'ncf', 'diksha', 'nishtha', 'nipun', 'fln', 'tarl',
            'child centred', 'play based', 'inquiry based', 'remedial teaching',
            'learning outcome', 'bloom', 'lesson plan', 'formative',
        ],
        courses: [
            'training', 'course', 'workshop', 'nishtha', 'diksha', 'certification',
            'swayam', 'professional development', 'teacher education', 'b.ed', 'm.ed',
            'upskilling', 'professional growth', 'seminar', 'webinar', 'module',
        ],
        govtUpdates: [
            'government', 'ministry', 'ncert', 'policy', 'rte', 'nep', 'ncf',
            'announcement', 'notification', 'scheme', 'update', 'circular',
            'pm shri', 'samagra shiksha', 'budget', 'state education',
            'nipun bharat', 'national curriculum', 'education report',
        ],
        topRecommended: [
            subject.toLowerCase(), gradeLevel.toLowerCase(),
            'teacher', 'classroom', 'ncert', 'india', 'school',
            'hindi', 'bharat', 'educational', 'primary', 'shikshak',
        ],
    };

    // govtUpdates MUST be first in Phase 1 so it claims govt-channel announcement
    // videos before topRecommended/pedagogy exhaust the Tier-1 channel pool.
    const ALL_CATS = ['govtUpdates', 'topRecommended', 'pedagogy', 'courses', 'storytelling'];

    // ── Score each video against EVERY category independently ─────────────────
    type ScoredVideo = { video: VideoCandidate; scores: Record<string, number> };

    const scoredVideos: ScoredVideo[] = candidates.map(video => {
        const titleLow = video.title.toLowerCase();
        const cid = video.channelId || '';

        // Authority base (same for all categories, then category-specific modifiers added)
        const authorityBase =
            GOVT_TIER1.has(cid)    ? 20 :
            NGO_TIER2.has(cid)     ? 12 :
            QUALITY_TIER3.has(cid) ?  6 : 0;

        // Language match — strong boost (never default to Hindi)
        const langBoost = getLanguageBoost(video.title, video.channelTitle || '', language);

        // State match — teacher's state SCERT content is most curriculum-relevant
        const stateBoost = stateScertIds.has(cid) ? 12 : 0;

        // Board alignment — CBSE teachers want NCERT, ICSE want academic, state board want SCERT
        const boardBoost =
            isCBSE  && CBSE_ALIGNED.has(cid) ? 8 :
            isICSE  && ICSE_ALIGNED.has(cid) ? 8 :
            !isCBSE && !isICSE && stateScertIds.has(cid) ? 8 : 0; // State board gets extra on top of stateBoost

        // Semi-urban classroom relevance
        const classroomBoost = CLASSROOM_KWS.some(kw => titleLow.includes(kw)) ? 5 : 0;

        // Indic script in title — weaker signal now that langBoost covers it more precisely
        const indicBoost = !langBoost && /[\u0900-\u097F\u0A00-\u0A7F\u0B00-\u0B7F\u0C00-\u0C7F]/.test(video.title) ? 3 : 0;

        // Exam-coaching penalty
        const examPenalty = EXAM_KWS.some(kw => titleLow.includes(kw)) ? -15 : 0;

        // Topic match (from manual search field) — strongest signal
        const topicBoost = topic && titleLow.includes(topic.toLowerCase()) ? 18 : 0;

        const scores: Record<string, number> = {};

        for (const cat of ALL_CATS) {
            const kws = CATEGORY_KWS[cat] || [];
            let score = authorityBase + langBoost + stateBoost + boardBoost + classroomBoost + indicBoost + examPenalty + topicBoost;

            // Keyword match (pedagogy/govtUpdates weighted higher — more specific)
            for (const kw of kws) {
                if (titleLow.includes(kw)) {
                    score += (cat === 'pedagogy' || cat === 'govtUpdates') ? 5 : 2;
                }
            }

            // Category-specific authority bonuses
            if (cat === 'govtUpdates' && GOVT_TIER1.has(cid)) score += 8;
            if (cat === 'pedagogy'    && (GOVT_TIER1.has(cid) || NGO_TIER2.has(cid))) score += 5;
            if (cat === 'courses'     && (GOVT_TIER1.has(cid) || NGO_TIER2.has(cid))) score += 4;

            scores[cat] = Math.max(0, score);
        }

        return { video, scores };
    });

    // ── Quota-based distribution ───────────────────────────────────────────────
    // Replaces winner-take-all. Every category is guaranteed content before overflow.
    const MIN_QUOTA = 12; // Guaranteed minimum — never show a near-empty carousel
    const TARGET    = 30; // Comfortable carousel depth
    const MAX       = 60; // Hard cap per category

    const result: Record<string, VideoCandidate[]> = {
        topRecommended: [], storytelling: [], pedagogy: [], govtUpdates: [], courses: []
    };
    const assigned = new Set<string>();

    const fillCategory = (cat: string, upTo: number) => {
        const needed = upTo - result[cat].length;
        if (needed <= 0) return;
        const sorted = scoredVideos
            .filter(item => !assigned.has(item.video.id) && item.scores[cat] > 0)
            .sort((a, b) => b.scores[cat] - a.scores[cat])
            .slice(0, needed);
        for (const { video } of sorted) {
            result[cat].push(video);
            assigned.add(video.id);
        }
    };

    // Phase 1: Guarantee MIN_QUOTA for every category (priority: topRecommended first)
    for (const cat of ALL_CATS) fillCategory(cat, MIN_QUOTA);
    // Phase 2: Fill to TARGET
    for (const cat of ALL_CATS) fillCategory(cat, TARGET);
    // Phase 3: Top up to MAX with any remaining relevant videos
    for (const cat of ALL_CATS) fillCategory(cat, MAX);

    return result;
}

/**
 * Multi-tier video recommendation orchestrator.
 * 
 * "LATENCY BLITZ" OPTIMIZED VERSION:
 * 1. Parallel retrieval (AI + RSS in one Promise.all)
 * 2. Deterministic Local Ranking (Eliminates 2-5s LLM latency)
 * 3. Structured Logging of total duration
 */
export async function getVideoRecommendations(input: VideoStorytellerInput): Promise<Record<string, any>> {
    const { getCachedVideos, setCachedVideos } = await import('@/lib/youtube-video-cache');
    const { mergeCuratedVideos } = await import('@/lib/curated-videos');
    const { dbAdapter } = await import('@/lib/db/adapter');
    const { StructuredLogger } = await import('@/lib/logger/structured-logger');

    const startTime = Date.now();

    let subject = input.subject;
    let gradeLevel = input.gradeLevel;
    let language = input.language;
    let state = input.state;
    let educationBoard = input.educationBoard;

    // 1. Enrich with profile data if available
    if (input.userId && (!subject || !gradeLevel)) {
        try {
            const profile = await dbAdapter.getUser(input.userId);
            if (profile) {
                subject = subject || profile.subjects?.[0] || 'General';
                gradeLevel = gradeLevel || profile.teachingGradeLevels?.[0] || 'Class 5';
                language = language || profile.preferredLanguage || 'English';
                state = state || (profile as any).state;
                educationBoard = educationBoard || (profile as any).educationBoard;
            }
        } catch (e) {
            console.error('[Storyteller] Profile fetch failed (non-fatal):', e);
        }
    }

    subject = subject || 'General';
    gradeLevel = gradeLevel || 'Class 5';

    // 2. [Tier 1] Firestore semantic cache check
    let cachedResult = await getCachedVideos(subject, gradeLevel);
    if (cachedResult) {
        StructuredLogger.info('Video Storyteller served from cache', {
            metadata: { subject, gradeLevel },
            duration: Date.now() - startTime
        });
        return {
            ...cachedResult,
            fromCache: true,
            latencyScore: Date.now() - startTime
        };
    }

    // 3. [Tier 2] Parallel Retrieval Phase (LATENCY BLITZ)
    const [aiOutput, rssVideos] = await Promise.allSettled([
        videoStorytellerFlow({ ...input, subject, gradeLevel, language }),
        fetchRSSVideosForTeacher(subject, language || 'English', state),
    ]);

    const aiResult = aiOutput.status === 'fulfilled' ? aiOutput.value : null;
    const rssResult = rssVideos.status === 'fulfilled' ? rssVideos.value : {};

    // YouTube Search Layer (if AI queries exist)
    let searchVideos: Record<string, any[]> = {};
    if (aiResult?.categories) {
        try {
            const { getCategorizedVideos } = await import('@/lib/youtube');
            searchVideos = await getCategorizedVideos(aiResult.categories);
        } catch (e) {
            console.warn('[Storyteller] YouTube Data API failed, using RSS only:', e);
        }
    }

    // Aggregate into a flat unique pool
    let flatRSS = Object.values(rssResult).flat();
    let flatSearch = Object.values(searchVideos).flat();

    // EMERGENCY SEARCH: If a specific topic was requested but we have no candidates, 
    // trigger a direct fallback search to ensure users see results for specific queries (e.g. Chola empire)
    if (flatSearch.length === 0 && input.topic) {
        try {
            const { getCategorizedVideos } = await import('@/lib/youtube');
            const emergencyResults = await getCategorizedVideos({
                topRecommended: [input.topic]
            });
            flatSearch = Object.values(emergencyResults).flat();
        } catch (e) {
            console.error('[Storyteller] Emergency search failed:', e);
        }
    }

    const candidatePoolMap = new Map<string, VideoCandidate>();
    [...flatSearch, ...flatRSS].forEach(v => {
        if (!candidatePoolMap.has(v.id)) candidatePoolMap.set(v.id, v);
    });

    const candidates = Array.from(candidatePoolMap.values());

    // 4. [Tier 3] Deterministic Local Ranking (Eliminates 2nd LLM call)
    const rankedVideos = rankVideosLocal(subject, gradeLevel, candidates, input.topic, language, state, educationBoard);

    const personalizedMessage = aiResult?.personalizedMessage ||
        `Namaste Adhyapak! Here are thoughtfully curated resources for your ${subject} class. These videos blend pedagogy guidance from NEP 2020, engaging storytelling for ${gradeLevel} students, and important government updates.`;

    // 5. Build final result with curated fallback for empty categories
    const finalVideos = mergeCuratedVideos(rankedVideos);

    // 6. Store in cache & Log duration
    const duration = Date.now() - startTime;
    StructuredLogger.info('Video Storyteller curation complete', {
        metadata: { subject, gradeLevel, candidates: candidates.length },
        duration
    });

    void setCachedVideos(subject, gradeLevel, finalVideos, personalizedMessage);

    return {
        categories: aiResult?.categories || {},
        personalizedMessage,
        categorizedVideos: finalVideos,
        fromCache: false,
        latencyScore: duration
    };
}

/**
 * Daily rotation shuffle — time-seeded so results change every 6 hours.
 * Same pool of videos, different order = freshness without extra API calls.
 * Formula: seed changes 4× per day (every 21,600 seconds).
 */
function dailyShuffle<T>(arr: T[]): T[] {
    if (arr.length <= 1) return arr;
    // Seed changes every 6 hours
    const seed = Math.floor(Date.now() / (1000 * 60 * 60 * 6));
    // Pre-compute hash for each index once (O(n)) to avoid O(n²) arr.indexOf inside sort
    const hashes = arr.map((_, i) => Math.sin(seed * 9301 + i * 49297) * 233280);
    return [...arr]
        .map((item, i) => ({ item, h: hashes[i] - Math.floor(hashes[i]) }))
        .sort((a, b) => a.h - b.h)
        .map(({ item }) => item);
}

/**
 * Fetches RSS videos mapped to categories for a specific teacher.
 * Injects language-specific state SCERT channels so teachers see their
 * own state's content in their preferred language — not just central/Hindi channels.
 */
async function fetchRSSVideosForTeacher(
    subject: string,
    language: string,
    state?: string
): Promise<Record<string, any[]>> {
    const { INDIAN_EDU_CHANNELS, SUBJECT_CHANNEL_MAP, LANGUAGE_CHANNEL_MAP, STATE_EDUCATION_CONFIG } = await import('@/lib/youtube-channels');
    const { fetchMultipleChannelsRSS } = await import('@/lib/youtube-rss');

    const categories = ['pedagogy', 'storytelling', 'govtUpdates', 'courses', 'topRecommended'];

    // State/language-specific channels (SCERT + regional DD) — prepended for priority
    const languageChannels = LANGUAGE_CHANNEL_MAP[language] || [];

    // State-specific SCERT channels (injected into govtUpdates + topRecommended for state policy content)
    const stateConfig = state ? STATE_EDUCATION_CONFIG[state] : null;
    const stateScertChannels = stateConfig?.scertChannelIds.map(id => ({
        id,
        name: `${state} SCERT`,
        description: `${state} state curriculum & policy updates`,
        tier: 1 as const,
    })) || [];

    // Subject-specific channel overrides
    const subjectChannels = SUBJECT_CHANNEL_MAP[subject] || SUBJECT_CHANNEL_MAP['General'];

    const results = await Promise.all(
        categories.map(async (cat) => {
            let channels = INDIAN_EDU_CHANNELS[cat] || [];

            // Language channels go first in every category — state content is always relevant
            channels = [...languageChannels, ...channels];

            // State SCERT channels go first in govtUpdates + topRecommended — state policy is most relevant
            if (cat === 'govtUpdates' || cat === 'topRecommended') {
                channels = [...stateScertChannels, ...channels];
            }

            // For storytelling and topRecommended, also inject subject-specific channels
            if (cat === 'storytelling' || cat === 'topRecommended') {
                channels = [...subjectChannels, ...channels];
            }

            // Deduplicate channels by ID before fetching
            const uniqueChannels = channels.filter(
                (ch, i, arr) => arr.findIndex(c => c.id === ch.id) === i
            );

            // Fetch all unique channels — no cap. Each returns 15 recent videos via RSS.
            const videos = await fetchMultipleChannelsRSS(uniqueChannels, 15);
            // Apply daily rotation so the order feels fresh on every page load
            return [cat, dailyShuffle(videos)] as [string, any[]];
        })
    );

    return Object.fromEntries(results);
}

const videoStorytellerPrompt = ai.definePrompt({
    name: 'videoStorytellerPrompt',
    input: { schema: VideoStorytellerInputSchema },
    output: { schema: VideoStorytellerOutputSchema, format: 'json' },
    prompt: `${SAHAYAK_SOUL_PROMPT}${STRUCTURED_OUTPUT_OVERRIDE}

You are SahayakAI, a dedicated mentor for Indian PRIMARY and SECONDARY school teachers (Classes 1-12).
Generate highly personalized YouTube search queries for SCHOOL TEACHERS — NOT college professors, NOT students.

**Teacher Profile:**
- **Subject:** {{{subject}}}
- **Grade Level:** {{{gradeLevel}}}
- **Topic Context:** {{{topic}}}
- **Language Preference:** {{{language}}}

**Instructions for Query Generation:**
1. **Pedagogy:** NEP 2020, NCF, DIKSHA, NISHTHA, Active Learning, child-centred teaching methods for school classrooms.
2. **Storytelling:** Animated concept explainers, narrative lessons, NCERT chapter visualisations for Classes 1-12.
3. **Govt Updates:** MoE school education announcements, state education department notifications, RTE Act, Samagra Shiksha.
4. **Courses:** NISHTHA training, SWAYAM school-teacher CPD, D.El.Ed, B.Ed refresher courses, DIKSHA modules.
5. **Top Recommended:** Channels that help school teachers teach better — NCERT, state SCERT, Azim Premji, Teach For India.

**Hard Constraints:**
- Queries MUST be for school teachers (primary/secondary), never for college professors or students.
- No JEE, NEET, UPSC, MBA, B.Tech, or any higher education/competitive exam content.
- Search queries must be concise (3-6 words).
- Provide 3-5 queries per category.
- Queries must be culturally relevant to Indian school contexts (govt schools, semi-urban, CBSE, state boards).
- The \`personalizedMessage\` MUST be in the teacher's preferred language ({{{language}}}).
`,
});

const videoStorytellerFlow = ai.defineFlow(
    {
        name: 'videoStorytellerFlow',
        inputSchema: VideoStorytellerInputSchema,
        outputSchema: VideoStorytellerOutputSchema,
    },
    async (input) => {
        const { runResiliently } = await import('@/ai/genkit');
        const { StructuredLogger } = await import('@/lib/logger/structured-logger');
        const { FlowExecutionError, SchemaValidationError } = await import('@/lib/errors');

        const startTime = Date.now();

        try {
            StructuredLogger.info('Starting Video Storyteller flow', {
                service: 'video-storyteller-flow',
                userId: input.userId,
                input
            });

            const { output } = await runResiliently(async (resilienceConfig) => {
                return await videoStorytellerPrompt(input, resilienceConfig);
            }, 'videoStoryteller.generate');

            if (!output) {
                throw new FlowExecutionError('AI model returned null output for Video Storyteller');
            }

            // Explicit validation
            try {
                VideoStorytellerOutputSchema.parse(output);
            } catch (e: any) {
                throw new SchemaValidationError(`Video Storyteller output failed validation: ${e.message}`, {
                    rawOutput: output
                });
            }

            const duration = Date.now() - startTime;
            StructuredLogger.info('Video Storyteller flow completed successfully', {
                service: 'video-storyteller-flow',
                duration
            });

            return output;
        } catch (error: any) {
            StructuredLogger.error('Video Storyteller flow failed', {
                service: 'video-storyteller-flow',
                metadata: { error: error.message }
            }, error);
            throw error;
        }
    }
);
