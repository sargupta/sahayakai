'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { SAHAYAK_SOUL_PROMPT } from '@/ai/soul';

const VideoStorytellerInputSchema = z.object({
    subject: z.string().describe('The academic subject taught by the teacher.'),
    gradeLevel: z.string().describe('The target grade level or class (e.g., Class 5, Grade 10).'),
    topic: z.string().optional().describe('An optional specific chapter or topic within the subject.'),
    language: z.string().optional().describe('The preferred language for the content (e.g., Hindi, Tamil, English).'),
    userId: z.string().optional().describe('The ID of the user for personalization context.'),
});

export type VideoStorytellerInput = z.infer<typeof VideoStorytellerInputSchema>;

const VideoStorytellerOutputSchema = z.object({
    categories: z.object({
        pedagogy: z.array(z.string()).describe('Search queries for government-instructed pedagogy and teaching techniques.'),
        storytelling: z.array(z.string()).describe('Search queries for storytelling videos of chapters/subjects.'),
        govtUpdates: z.array(z.string()).describe('Search queries for personalized government related updates or educational news for teachers.'),
        courses: z.array(z.string()).describe('Search queries for relevant professional development courses for the teacher.'),
        topRecommended: z.array(z.string()).describe('Search queries for top recommended educational content for the subject and class.'),
    }),
    personalizedMessage: z.string().describe('A brief, supportive message explaining why these videos were chosen for this specific teacher.'),
});

export type VideoStorytellerOutput = z.infer<typeof VideoStorytellerOutputSchema>;

/**
 * Multi-tier video recommendation orchestrator.
 *
 * Strategy (in order of priority):
 *   L1 → Firestore semantic cache (by subject+grade hash, 6hr TTL)
 *   L2 → YouTube RSS feeds (zero quota, no API key, always works)
 *   L3 → YouTube Data API search (if key available and quota permits)
 *   L4 → Curated Indian edu video library (absolute last resort)
 *
 * AI runs independently to generate the personalized message and refine
 * channel selection — it does NOT block video display.
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

    // 2. [L1] Firestore semantic cache check
    let cachedResult = await getCachedVideos(subject, gradeLevel);
    if (cachedResult) {
        // Run AI message generation in background while returning cache immediately
        void runAIInBackground(input, subject, gradeLevel, language, cachedResult.personalizedMessage);
        return {
            categories: {},
            personalizedMessage: cachedResult.personalizedMessage,
            categorizedVideos: cachedResult.categorizedVideos,
            fromCache: true,
        };
    }

    // 3. Run AI + RSS concurrently — neither blocks the other
    const [aiOutput, rssVideos] = await Promise.allSettled([
        videoStorytellerFlow({ ...input, subject, gradeLevel, language }),
        fetchRSSVideosForTeacher(subject, language || 'English'),
    ]);

    const aiResult = aiOutput.status === 'fulfilled' ? aiOutput.value : null;
    const rssResult = rssVideos.status === 'fulfilled' ? rssVideos.value : {};

    // 4. [L2] Try YouTube Data API search if AI generated queries
    let searchVideos: Record<string, any[]> = {};
    if (aiResult?.categories) {
        try {
            const { getCategorizedVideos } = await import('@/lib/youtube');
            searchVideos = await getCategorizedVideos(aiResult.categories);
        } catch (e) {
            console.warn('[Storyteller] YouTube Data API failed, using RSS only:', e);
        }
    }

    // 5. Merge: Search API results → RSS → Curated fallback
    // Priority: live search > RSS > curated
    const mergedFromSearch = mergeLayers(searchVideos, rssResult);
    const finalVideos = mergeCuratedVideos(mergedFromSearch);

    const personalizedMessage = aiResult?.personalizedMessage ||
        `Namaste Adhyapak! Here are thoughtfully curated resources for your ${subject} class. These videos blend pedagogy guidance from NEP 2020, engaging storytelling for ${gradeLevel} students, and important government updates to help you become an even more effective teacher.`;

    // 6. Store result in Firestore cache (fire-and-forget)
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
            const videos = await fetchMultipleChannelsRSS(channels.slice(0, 3), 4);
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
