import { NextResponse } from 'next/server';
import { agentRouterFlow } from '@/ai/flows/agent-definitions';
import { instantAnswer } from '@/ai/flows/instant-answer';
import { logger } from '@/lib/logger';

/**
 * @swagger
 * /api/ai/intent:
 *   post:
 *     summary: AI Intent Router
 *     description: Determines the user's intent and either returns a navigation recommendation or an instant answer.
 *     tags:
 *       - AI Generation
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 example: "Create a quiz about gravity."
 *               language:
 *                 type: string
 *                 example: "English"
 *     responses:
 *       200:
 *         description: Intent analysis or Instant Answer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Analysis failed
 */
export async function POST(request: Request) {
    let promptText = 'Unknown Prompt';
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const body = await request.json();
        const { prompt, language } = body;
        promptText = prompt || 'Unknown Prompt';

        // 1. Determine Intent and extract params
        const {
            type: intent,
            topic: extractedTopic,
            gradeLevel: extractedGrade,
            subject: extractedSubject,
            language: detectedLanguage
        } = await agentRouterFlow({
            prompt,
            language,
            userId
        });

        // Use extracted topic if prompt is generic, otherwise use prompt
        const finalTopic = extractedTopic || prompt;
        const finalLanguage = detectedLanguage || language || 'en';

        let result: any;
        const queryParams = new URLSearchParams();
        queryParams.set('topic', finalTopic);
        if (extractedGrade) queryParams.set('gradeLevel', extractedGrade);
        if (extractedSubject) queryParams.set('subject', extractedSubject);
        if (finalLanguage) queryParams.set('language', finalLanguage);

        const queryString = queryParams.toString();

        // 2. Route based on intent (Sync with processAgentRequest logic)
        switch (intent) {
            case 'lessonPlan':
                result = { action: 'NAVIGATE', url: `/lesson-plan?${queryString}` };
                break;
            case 'quiz':
                result = { action: 'NAVIGATE', url: `/quiz-generator?${queryString}` };
                break;
            case 'visualAid':
                result = { action: 'NAVIGATE', url: `/visual-aid-designer?${queryString}` };
                break;
            case 'worksheet':
                result = { action: 'NAVIGATE', url: `/worksheet-wizard?${queryString}` };
                break;
            case 'virtualFieldTrip':
                result = { action: 'NAVIGATE', url: `/virtual-field-trip?${queryString}` };
                break;
            case 'teacherTraining':
                result = { action: 'NAVIGATE', url: `/teacher-training?${queryString}` };
                break;
            case 'rubric':
                result = { action: 'NAVIGATE', url: `/rubric-generator?${queryString}` };
                break;
            case 'videoStoryteller':
                result = { action: 'NAVIGATE', url: `/video-storyteller?${queryString}` };
                break;
            case 'instantAnswer':
                const answer = await instantAnswer({
                    question: prompt,
                    language: finalLanguage,
                    userId: userId,
                });
                result = { action: 'ANSWER', content: answer.answer, videoUrl: answer.videoSuggestionUrl };
                break;
            default:
                result = { error: "I'm not sure how to help with that. Please try rephrasing your request." };
                break;
        }

        return NextResponse.json({
            type: intent,
            result: result,
        });

    } catch (error) {
        logger.error(`Intent Router API Failed for prompt: "${promptText}"`, error, 'INTENT', { userId: request.headers.get('x-user-id') });
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
