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

const videoRankerPrompt = ai.definePrompt({
    name: 'videoRankerPrompt',
    input: {
        schema: z.object({
            subject: z.string(),
            gradeLevel: z.string(),
            videos: z.array(VideoCandidateSchema)
        })
    },
    output: { schema: VideoRankingSchema, format: 'json' },
    prompt: `
You are an expert Educational Content Curator. Your task is to rank a list of YouTube videos based on their relevance to a **Teacher's** specific needs.

**Teacher Profile:**
- Subject: {{subject}}
- Grade Level: {{gradeLevel}}

**Categories to Score (0-10):**
1. **Storytelling**: Narrative explanation of topics, animated stories, high student engagement.
2. **Pedagogy**: Methods, classroom management, NEP 2020 workshops, teacher mindset.
3. **Courses**: Professional training, SWAYAM, long-form certification previews.
4. **Govt Updates**: Ministry news, policy changes, NCERT announcements.
5. **Top Recommended**: High-quality gems that fit multiple educator needs.

**CRITICAL RULE: "The Teacher/Student Filter"**
- A video about "Chapter 5 Exercise Solutions" is for **STUDENTS**. Set \`isForTeachers: false\`.
- A video about "How to teach Chapter 5 effectively" is for **TEACHERS**. Set \`isForTeachers: true\`.
- Professional Development is ALWAYS for teachers.

Provide a score (0.0 to 10.0) for each category. If a video is purely for students, demote its pedagogy/courses scores.

**Videos to Evaluate:**
{{#each videos}}
- ID: {{id}} | Title: {{title}} | Channel: {{channelTitle}}
{{/each}}
`,
});

/**
 * Ranks and deduplicates a pool of candidate videos into categories.
 * USES AI to ensure relevance and eliminates cross-category duplication.
 */
async function rankAndDeduplicateVideos(
    subject: string,
    gradeLevel: string,
    candidates: VideoCandidate[]
): Promise<Record<string, VideoCandidate[]>> {
    const { runResiliently } = await import('@/ai/genkit');

    if (candidates.length === 0) return {};

    // 1. LLM Ranking Pass
    const { output } = await runResiliently(async (config) => {
        return await videoRankerPrompt({ subject, gradeLevel, videos: candidates.slice(0, 40) }, config);
    });

    if (!output || !output.rankedVideos) {
        console.warn('[Ranker] AI failed to rank videos, returning raw pool');
        return { topRecommended: candidates.slice(0, 6) };
    }

    // 2. Filter, Score, and Deduplicate
    const finalCategories: Record<string, VideoCandidate[]> = {
        storytelling: [],
        pedagogy: [],
        courses: [],
        govtUpdates: [],
        topRecommended: []
    };

    const seenIds = new Set<string>();

    // Create a map for quick lookup
    const candidateMap = new Map(candidates.map(v => [v.id, v]));

    // Sort candidates by their highest category score
    const scoredList = output.rankedVideos
        .filter(v => v.isForTeachers) // Mandatory teacher filter
        .map(rank => {
            const video = candidateMap.get(rank.id);
            if (!video) return null;

            // Find best category for this video
            const scores = rank.categoryScores;
            const entries = Object.entries(scores) as [string, number][];
            const [bestCat, bestScore] = entries.sort((a, b) => b[1] - a[1])[0];

            return { video, bestCat, bestScore };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => b.bestScore - a.bestScore);

    // 3. Assign to categories strictly
    for (const item of scoredList) {
        if (seenIds.has(item.video.id)) continue;

        if (finalCategories[item.bestCat] && finalCategories[item.bestCat].length < 6) {
            finalCategories[item.bestCat].push(item.video);
            seenIds.add(item.video.id);
        }
    }

    return finalCategories;
}

/**
 * Multi-tier video recommendation orchestrator.
 *
 * NEW 4-Tier RECOMENDATION PIPELINE:
 * 1. [L1] Firestore Semantic Cache (Fastest)
 * 2. [L2] Candidate Retrieval (RSS + Search + Curated)
 * 3. [L3] AI Ranking & Deduplication (The "ML" Layer)
 * 4. [L4] Personalized Context Generation
 */
export async function getVideoRecommendations(input: VideoStorytellerInput): Promise<Record<string, any>> {
    const { getCachedVideos, setCachedVideos } = await import('@/lib/youtube-video-cache');
    const { fetchMultipleChannelsRSS } = await import('@/lib/youtube-rss');
    const { INDIAN_EDU_CHANNELS, SUBJECT_CHANNEL_MAP } = await import('@/lib/youtube-channels');
    const { mergeCuratedVideos } = await import('@/lib/curated-videos');
    const { dbAdapter } = await import('@/lib/db/adapter');

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
        return {
            categories: {},
            personalizedMessage: cachedResult.personalizedMessage,
            categorizedVideos: cachedResult.categorizedVideos,
            fromCache: true,
        };
    }

    // 3. [Tier 2] Candidate Retrieval Phase
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

    // Aggregrate all candidates into a flat unique pool
    const flatRSS = Object.values(rssResult).flat();
    const flatSearch = Object.values(searchVideos).flat();

    // Priority deduplication for pooling
    const candidatePoolMap = new Map<string, VideoCandidate>();
    [...flatSearch, ...flatRSS].forEach(v => {
        if (!candidatePoolMap.has(v.id)) candidatePoolMap.set(v.id, v);
    });

    const candidates = Array.from(candidatePoolMap.values());

    // 4. [Tier 3] AI Ranking & Deduplication Pass
    // This phase ensures "Chapter Exercises" are hidden from "Teacher Training"
    const rankedVideos = await rankAndDeduplicateVideos(subject, gradeLevel, candidates);

    const personalizedMessage = aiResult?.personalizedMessage ||
        `Namaste Adhyapak! Here are thoughtfully curated resources for your ${subject} class. These videos blend pedagogy guidance from NEP 2020, engaging storytelling for ${gradeLevel} students, and important government updates to help you become an even more effective teacher.`;

    // 5. Build final result with curated fallback for empty categories
    const finalVideos = mergeCuratedVideos(rankedVideos);

    // 6. Store result in Firestore cache
    void setCachedVideos(subject, gradeLevel, finalVideos, personalizedMessage);

    return {
        categories: aiResult?.categories || {},
        personalizedMessage,
        categorizedVideos: finalVideos,
        fromCache: false,
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
            const videos = await fetchMultipleChannelsRSS(channels.slice(0, 3), 10);
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

export const videoStorytellerFlow = ai.defineFlow(
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
