import { NextResponse } from 'next/server';
import { agentRouterFlow } from '@/ai/flows/agent-definitions';
import { instantAnswer } from '@/ai/flows/instant-answer';
import { logger } from '@/lib/logger';
import { logAIError } from '@/lib/ai-error-response';

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
        const flowOutput = await agentRouterFlow({
            prompt,
            language,
            userId
        });
        const {
            type: intent,
            topic: extractedTopic,
            gradeLevel: extractedGrade,
            subject: extractedSubject,
            language: detectedLanguage,
            // Phase N.1 — typed planned-action queue passed through to
            // the wire response so v0.4+ clients (OmniOrb post-δ
            // migration) get a uniform iteration surface across both
            // off-mode (Genkit) and canary/full (sidecar) paths. Empty
            // for instantAnswer / unknown / unroutable single-step.
            plannedActions = [],
        } = flowOutput;

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
            case 'examPaper':
                result = { action: 'NAVIGATE', url: `/exam-paper?${queryString}` };
                break;
            case 'instantAnswer':
            default: {
                // QA #1 (2026-05-28): a bare academic topic with no action verb
                // ("Relations and Functions Class 12") previously fell to the
                // default branch and returned "Not sure how to help", which felt
                // broken. Treat any unclassified-but-non-empty prompt as an
                // instant-answer question instead of erroring out. The teacher
                // gets a useful answer + video rather than a dead end.
                const answer = await instantAnswer({
                    question: prompt,
                    language: finalLanguage,
                    userId: userId,
                });
                result = { action: 'ANSWER', content: answer.answer, videoUrl: answer.videoSuggestionUrl };
                break;
            }
        }

        return NextResponse.json({
            type: intent,
            plannedActions,
            result: result,
        });

    } catch (error) {
        logAIError(error, 'INTENT', { message: `Intent Router API Failed for prompt: "${promptText}"`, userId: request.headers.get('x-user-id') });
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
