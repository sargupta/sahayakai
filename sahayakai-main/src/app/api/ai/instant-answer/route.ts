import { NextResponse } from 'next/server';
import { InstantAnswerInputSchema } from '@/ai/flows/instant-answer';
import { handleAIError } from '@/lib/ai-error-response';
import { withPlanCheck } from '@/lib/plan-guard';
import { dispatchInstantAnswer } from '@/lib/sidecar/instant-answer-dispatch';

/**
 * @swagger
 * /api/ai/instant-answer:
 *   post:
 *     summary: Get an Instant Answer
 *     description: Provides a direct answer to a user's question, augmented by Google Search.
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
 *               - question
 *             properties:
 *               question:
 *                 type: string
 *                 example: "What is photosynthesis?"
 *               language:
 *                 type: string
 *                 example: "English"
 *               gradeLevel:
 *                 type: string
 *                 example: "Class 5"
 *     responses:
 *       200:
 *         description: Generated Answer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: AI Generation failed
 */
async function _handler(request: Request) {
    let questionText = 'Unknown Question';
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const json = await request.json();
        questionText = json.question || 'Unknown Question';

        const body = InstantAnswerInputSchema.parse(json);

        // Phase B §B.6: dispatcher routes Genkit vs ADK sidecar based
        // on `SAHAYAKAI_INSTANT_ANSWER_MODE` env (default: off → Genkit
        // only, zero traffic-impact on merge). Sidecar uses Gemini's
        // native Google Search grounding; Genkit uses the legacy mock
        // googleSearch tool. Sidecar dispatcher returns the same wire
        // shape plus optional `source / decision / sidecarTelemetry`
        // fields that we strip before responding to keep the wire shape
        // backward-compatible.
        const dispatched = await dispatchInstantAnswer({
            ...body,
            userId,
        });

        // Strip dispatcher-only metadata; legacy clients only know
        // `{answer, videoSuggestionUrl, gradeLevel, subject}`.
        return NextResponse.json({
            answer: dispatched.answer,
            videoSuggestionUrl: dispatched.videoSuggestionUrl,
            gradeLevel: dispatched.gradeLevel,
            subject: dispatched.subject,
        });

    } catch (error) {
        // handleAIError: schema → 400, quota → 503 + Retry-After, else 500.
        return handleAIError(error, 'INSTANT_ANSWER', {
            message: `Instant Answer API Failed for question: "${questionText}"`,
            userId: request.headers.get('x-user-id'),
            extra: { path: '/api/ai/instant-answer' },
        });
    }
}

export const POST = withPlanCheck('instant-answer')(_handler);
