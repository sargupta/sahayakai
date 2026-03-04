'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { SAHAYAK_SOUL_PROMPT } from '@/ai/soul';

import {
    VideoStorytellerInputSchema,
    VideoStorytellerOutputSchema,
    VideoCandidateSchema,
    VideoRankingSchema,
    type VideoStorytellerInput,
    type VideoStorytellerOutput,
    type VideoCandidate,
    type VideoRanking
} from '@/ai/schemas/video-storyteller';


/**
 * Ranks and deduplicates a pool of candidate videos into categories using deterministic local scoring.
 * Optimized for speed (< 100ms) to replace the 2-5s LLM ranking pass.
 */
function rankVideosLocal(
    subject: string,
    gradeLevel: string,
    candidates: VideoCandidate[],
    topic?: string
): Record<string, VideoCandidate[]> {
    if (candidates.length === 0) return {};

    const finalCategories: Record<string, VideoCandidate[]> = {
        storytelling: [],
        pedagogy: [],
        courses: [],
        govtUpdates: [],
        topRecommended: []
    };

    const seenIds = new Set<string>();

    // Authority Channels (Boost Score)
    const AUTHORITY_CHANNELS = new Set([
        'UCT0s92hGjqLX6p7qY9BBrSA', // NCERT
        'UCp2smQxAyu_09vXiPJ3vTTg', // Ministry of Ed
        'UCA7OQkX9AEIVQ6j9i0OSQhA', // CEC-UGC
        'UCaIXqbYp2OJ4fdTM4JqZuDg', // IGNOU
        'UC37XfXzS9Lp8XG-rW5_p0HA', // NIOS
        'UCV5w3dqPZL23JSjdAfsJpzw', // Let's LEARN
        'UCFidunW38-O2R0V1E9t2cKA', // Teach For India
        'UC0e9e-XlU6h8yW3o_d0m2Lg', // Azim Premji University
    ]);

    // Scoring Keywords
    const KEYWORDS: Record<string, string[]> = {
        storytelling: ['story', 'animated', 'narrative', 'kahani', 'explanation', 'concept', 'animation'],
        pedagogy: ['pedagogy', 'teaching method', 'classroom', 'nep 2020', 'ncf', 'active learning', 'experiential', 'scaffolding', 'differentiated', 'assessment'],
        courses: ['training', 'course', 'workshop', 'nistha', 'diksha', 'certification', 'swayam'],
        govtUpdates: ['update', 'announcement', 'notification', 'ministry', 'ncert', 'policy', 'rte'],
        topRecommended: [subject, gradeLevel, 'best', 'masterclass', 'ncert official']
    };

    // Score and Categorize
    const scoredList = candidates
        .map(video => {
            const title = video.title.toLowerCase();
            const channel = video.channelTitle.toLowerCase();

            // Basic relevance scoring
            const categoryScores: Record<string, number> = {};

            for (const [cat, kws] of Object.entries(KEYWORDS)) {
                let score = 0;

                // Keyword match
                kws.forEach(kw => {
                    if (title.includes(kw.toLowerCase())) score += 2;
                });

                // Authority boost
                if (AUTHORITY_CHANNELS.has(video.id)) score += 5;

                // Topic relevance boost! (Crucial for manual searches like Chola empire)
                if (topic && title.includes(topic.toLowerCase())) score += 10;

                // Explicit metadata boost (if available)
                if (video.channelTitle.includes('NCERT') || video.channelTitle.includes('Ministry')) score += 5;
                if (video.channelTitle.toLowerCase().includes('learn') || video.channelTitle.toLowerCase().includes('premji')) score += 3;

                categoryScores[cat] = score;
            }

            // Determine best category
            const entries = Object.entries(categoryScores);
            const [bestCat, bestScore] = entries.sort((a, b) => b[1] - a[1])[0];

            return { video, bestCat, bestScore };
        })
        .sort((a, b) => b.bestScore - a.bestScore);

    // Assign to categories (Priority order)
    const CATEGORY_ORDER = ['topRecommended', 'courses', 'pedagogy', 'storytelling', 'govtUpdates'];

    for (const cat of CATEGORY_ORDER) {
        const catVideos = scoredList
            .filter(item => item.bestCat === cat && !seenIds.has(item.video.id))
            .slice(0, 36)
            .map(item => item.video);

        finalCategories[cat] = catVideos;
        catVideos.forEach(v => seenIds.add(v.id));
    }

    return finalCategories;
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

    // 1. Enrich with profile data if available
    if (input.userId && (!subject || !gradeLevel)) {
        try {
            const profile = await dbAdapter.getUser(input.userId);
            if (profile) {
                subject = subject || profile.subjects?.[0] || 'General';
                gradeLevel = gradeLevel || profile.teachingGradeLevels?.[0] || 'Class 5';
                language = language || profile.preferredLanguage || 'English';
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
        fetchRSSVideosForTeacher(subject, language || 'English'),
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
    const rankedVideos = rankVideosLocal(subject, gradeLevel, candidates, input.topic);

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
 * Fetches RSS videos mapped to categories for a specific teacher.
 * Uses subject-aware channel prioritization.
 */
async function fetchRSSVideosForTeacher(
    subject: string,
    language: string
): Promise<Record<string, any[]>> {
    const { INDIAN_EDU_CHANNELS, SUBJECT_CHANNEL_MAP } = await import('@/lib/youtube-channels');
    const { fetchMultipleChannelsRSS } = await import('@/lib/youtube-rss');

    const categories = ['pedagogy', 'storytelling', 'govtUpdates', 'courses', 'topRecommended'];

    // Resolve subject-specific channel overrides
    const subjectChannels = SUBJECT_CHANNEL_MAP[subject] || SUBJECT_CHANNEL_MAP['General'];

    const results = await Promise.all(
        categories.map(async (cat) => {
            let channels = INDIAN_EDU_CHANNELS[cat] || [];
            // For storytelling and topRecommended, prioritize subject-specific channels
            if (cat === 'storytelling' || cat === 'topRecommended') {
                channels = [...subjectChannels, ...channels];
            }
            const videos = await fetchMultipleChannelsRSS(channels.slice(0, 8), 50);
            return [cat, videos] as [string, any[]];
        })
    );

    return Object.fromEntries(results);
}

/**
 * Merges two video result maps.
 * Source A (search) takes priority; B (RSS) fills gaps.
 */
function mergeLayers(
    a: Record<string, any[]>,
    b: Record<string, any[]>
): Record<string, any[]> {
    const merged: Record<string, any[]> = {};
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

    for (const key of allKeys) {
        const aVideos = a[key] || [];
        const bVideos = b[key] || [];
        const seenIds = new Set(aVideos.map((v: any) => v.id));
        const extras = bVideos.filter((v: any) => !seenIds.has(v.id));
        merged[key] = [...aVideos, ...extras].slice(0, 6);
    }

    return merged;
}

/**
 * Runs AI flow in background to update cache with fresh personalized message.
 * Never blocks the response.
 */
async function runAIInBackground(
    input: VideoStorytellerInput,
    subject: string,
    gradeLevel: string,
    language: string | undefined,
    currentMessage: string
): Promise<void> {
    // Only refresh if message is stale (> 6hrs — we'll rely on cache TTL)
    // This is intentionally a no-op for now; cache handles staleness
}

const videoStorytellerPrompt = ai.definePrompt({
    name: 'videoStorytellerPrompt',
    input: { schema: VideoStorytellerInputSchema },
    output: { schema: VideoStorytellerOutputSchema, format: 'json' },
    prompt: `${SAHAYAK_SOUL_PROMPT}

You are SahayakAI, a dedicated mentor for Indian teachers. Generate highly personalized YouTube search queries to help teachers find the best educational content, pedagogy guidance, and government updates.

**Teacher Profile:**
- **Subject:** {{{subject}}}
- **Grade Level:** {{{gradeLevel}}}
- **Topic Context:** {{{topic}}}
- **Language Preference:** {{{language}}}

**Instructions for Query Generation:**
1. **Pedagogy (Government-Instructed):** NEP 2020, NCF, DIKSHA portal techniques, Active Learning, Experiential Learning.
2. **Storytelling:** Narrative-based explanations, animated concept explainers, "stories for kids" for the subject/topic.
3. **Govt Updates:** Ministry of Education India updates, State Education Department notifications, RTE Act.
4. **Courses:** SWAYAM, professional training courses, Digital Teaching Tools, Remedial Teaching.
5. **Top Recommended:** Best educational YouTube channels in India (Khan Academy India, Vedantu, Magnet Brains) for {{{subject}}} at {{{gradeLevel}}}.

**Constraints:**
- Search queries must be concise (3-6 words).
- Provide 3-5 queries per category.
- Queries should be culturally relevant to rural and urban Indian educational contexts.
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
            });

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
