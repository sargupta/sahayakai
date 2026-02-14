import { NextResponse } from 'next/server';
import { agentRouterFlow } from '@/ai/flows/agent-definitions';
import { instantAnswer } from '@/ai/flows/instant-answer';

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
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const body = await request.json();
        const { prompt, language } = body;

        // 1. Determine Intent
        const { type: intent } = await agentRouterFlow({
            prompt,
            language,
            userId
        });

        let result: any;

        // 2. Route based on intent (Sync with processAgentRequest logic)
        switch (intent) {
            case 'lessonPlan':
                result = { action: 'NAVIGATE', url: `/lesson-plan?topic=${encodeURIComponent(prompt)}` };
                break;
            case 'quiz':
                result = { action: 'NAVIGATE', url: `/quiz-generator?topic=${encodeURIComponent(prompt)}` };
                break;
            case 'visualAid':
                result = { action: 'NAVIGATE', url: `/visual-aid-designer?topic=${encodeURIComponent(prompt)}` };
                break;
            case 'worksheet':
                result = { action: 'NAVIGATE', url: `/worksheet-wizard?topic=${encodeURIComponent(prompt)}` };
                break;
            case 'virtualFieldTrip':
                result = { action: 'NAVIGATE', url: `/virtual-field-trip?topic=${encodeURIComponent(prompt)}` };
                break;
            case 'teacherTraining':
                result = { action: 'NAVIGATE', url: `/teacher-training?topic=${encodeURIComponent(prompt)}` };
                break;
            case 'rubric':
                result = { action: 'NAVIGATE', url: `/rubric-generator?topic=${encodeURIComponent(prompt)}` };
                break;
            case 'instantAnswer':
                const answer = await instantAnswer({
                    question: prompt,
                    language: language,
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
        console.error('Intent Router API Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
