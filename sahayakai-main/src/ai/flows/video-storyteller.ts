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
 * High-level function to get personalized video recommendations.
 * Fetches user profile if userId is provided to enhance personalization.
 */
export async function getVideoRecommendations(input: VideoStorytellerInput): Promise<Record<string, any>> {
    const { videoStorytellerFlow } = await import('./video-storyteller');
    const { getCategorizedVideos } = await import('@/lib/youtube');
    const { dbAdapter } = await import('@/lib/db/adapter');

    let subject = input.subject;
    let gradeLevel = input.gradeLevel;
    let language = input.language;

    // Enhance with profile data if available
    if (input.userId && (!subject || !gradeLevel)) {
        try {
            const profile = await dbAdapter.getUser(input.userId);
            if (profile) {
                subject = subject || profile.subjects?.[0] || 'General';
                gradeLevel = gradeLevel || profile.teachingGradeLevels?.[0] || 'Class 5';
                language = language || profile.preferredLanguage || 'English';
            }
        } catch (e) {
            console.error('Error fetching user profile for video recommendations:', e);
        }
    }

    // Fallbacks if still missing
    subject = subject || 'General';
    gradeLevel = gradeLevel || 'Class 5';

    const aiOutput = await videoStorytellerFlow({
        ...input,
        subject,
        gradeLevel,
        language
    });

    const categorizedVideos = await getCategorizedVideos(aiOutput.categories);

    return {
        ...aiOutput,
        categorizedVideos
    };
}

const videoStorytellerPrompt = ai.definePrompt({
    name: 'videoStorytellerPrompt',
    input: { schema: VideoStorytellerInputSchema },
    output: { schema: VideoStorytellerOutputSchema, format: 'json' },
    prompt: `${SAHAYAK_SOUL_PROMPT}

You are SahayakAI, a dedicated mentor for Indian teachers. Your task is to generate highly personalized and effective YouTube search queries to help teachers find the best educational content, pedagogy guidance, and government updates.

**Teacher Profile:**
- **Subject:** {{{subject}}}
- **Grade Level:** {{{gradeLevel}}}
- **Topic Context:** {{{topic}}}
- **Language Preference:** {{{language}}}

**Instructions for Query Generation:**
1. **Pedagogy (Government-Instructed):** Generate queries focused on NEP 2020, NCF (National Curriculum Framework), DIKSHA portal techniques, and modern classroom management strategies. Focus on "Active Learning" and "Experiential Learning".
2. **Storytelling:** Create queries that look for narrative-based explanations of the specified subject/topic. Use keywords like "stories for kids", "animated concept explanation", "historical context of {{{topic}}}", etc.
3. **Govt Updates:** Focus on "Ministry of Education India updates", "State Education Department notifications", "New rules for {{{subject}}} teachers in India", and relevant news for {{{gradeLevel}}} teachers.
4. **Courses:** Search for professional training courses, MOOCs (like SWAYAM), and skills like "Digital Teaching Tools", "Remedial Teaching for {{{subject}}}", etc.
5. **Top Recommended:** These should be generic but highly relevant queries for the best educational YouTube channels in India (e.g., Khan Academy India, BYJU's, local language educators) specific to {{{subject}}} for {{{gradeLevel}}}.

**Tone:** Supportive, insightful, and "Bharat-First".
**Language:** The search queries should be a mix of English and the teacher's preferred language ({{{language}}}) to get the best results from Indian YouTube educators. The \`personalizedMessage\` MUST be in the teacher's preferred language.

**Constraints:**
- Search queries must be concise (3-6 words).
- Provide 3-5 queries per category.
- Ensure queries are culturally relevant to rural and urban Indian educational contexts.
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
