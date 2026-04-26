
import { NextResponse } from 'next/server';
import { LessonPlanInputSchema } from '@/ai/flows/lesson-plan-generator';
import { handleAIError } from '@/lib/ai-error-response';
import { withPlanCheck } from '@/lib/plan-guard';
import { dispatchLessonPlan } from '@/lib/sidecar/lesson-plan-dispatch';

/**
 * @swagger
 * /api/ai/lesson-plan:
 *   post:
 *     summary: Generate a Lesson Plan
 *     description: Uses AI to generate a detailed 5E lesson plan and saves it to the user's library.
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
 *               - topic
 *             properties:
 *               topic:
 *                 type: string
 *                 example: "Photosynthesis"
 *               gradeLevels:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Class 5"]
 *               language:
 *                 type: string
 *                 enum: [English, Hindi, Bengali, Kannada, Tamil, Telugu, Marathi]
 *                 example: "English"
 *               resourceLevel:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 default: low
 *               difficultyLevel:
 *                 type: string
 *                 enum: [remedial, standard, advanced] 
 *                 default: standard
 *               useRuralContext:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Generated Lesson Plan
 *       400:
 *         description: Invalid input
 *       500:
 *         description: AI Generation failed
 */
async function _handler(request: Request) {
    let topicText = 'Unknown Topic';
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const json = await request.json();
        topicText = json.topic || 'Unknown Topic';

        // Pre-validate input so schema errors return 400 via handleAIError
        // rather than crashing inside Genkit's own validator as a 500.
        const body = LessonPlanInputSchema.parse(json);

        // Phase 3 §3.4: dispatcher routes to Genkit (legacy) or the
        // Python ADK sidecar based on `lessonPlanSidecarMode`. Default
        // is "off" so existing prod traffic is unchanged. The flag is
        // flipped per-rollout-step from the Firestore feature_flags doc.
        const output = await dispatchLessonPlan({
            ...body,
            userId: userId,
        });

        return NextResponse.json(output);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // handleAIError differentiates:
        //   - safety violation → 400 + original message (user can rephrase)
        //   - quota/429 → 503 + Retry-After + friendly message (tells the user
        //     to wait, not that the feature is broken)
        //   - everything else → 500 with the generic fallback
        return handleAIError(error, 'LESSON_PLAN', {
            message: `Lesson Plan API Failed for topic: "${topicText}"`,
            userId: request.headers.get('x-user-id'),
            extra: { path: '/api/ai/lesson-plan', errorMessage },
        });
    }
}

export const POST = withPlanCheck('lesson-plan')(_handler);
