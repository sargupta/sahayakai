import { NextResponse } from 'next/server';
import { dispatchVideoStoryteller } from '@/lib/sidecar/video-storyteller-dispatch';
import { logger } from '@/lib/logger';
import { logAIError } from '@/lib/ai-error-response';
import { reserveDailyQuota, rollbackDailyQuota } from '@/lib/usage-tracker';

// Allow up to 120s for video storyteller generation (multi-step orchestration)
export const maxDuration = 120;

/**
 * @swagger
 * /api/ai/video-storyteller:
 *   post:
 *     summary: Get Personalized Video Recommendations
 *     description: Returns categorized YouTube videos based on teacher profile (Subject, Class, Pedagogy).
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
 *             properties:
 *               subject:
 *                 type: string
 *               gradeLevel:
 *                 type: string
 *               topic:
 *                 type: string
 *               language:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed
 */
export async function POST(request: Request) {
    // Require authentication. Middleware already 401s unauthenticated
    // /api/ai/* calls; we assert it here too so this expensive endpoint
    // (Gemini categorization + YouTube fan-out) can never be driven
    // anonymously even if the route were ever moved to the public list.
    const userId = request.headers.get('x-user-id');
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SERVER-SIDE daily quota gate — the most expensive flow in the product
    // (Gemini categorization + YouTube fan-out) previously had no cap.
    // Atomic check-and-reserve; free = 3/day, paid = 30/day (FOUNDER-TUNABLE
    // in DAILY_FEATURE_QUOTAS, src/lib/usage-tracker.ts). Response contract
    // matches the plan-guard 429 shape so useLimitGuard/UpgradePrompt work
    // unchanged on the client.
    const quota = await reserveDailyQuota(userId, 'video_storyteller');
    if (!quota.ok) {
        return NextResponse.json(
            {
                error: 'DAILY_LIMIT_REACHED',
                message: `You've used all ${quota.limit} video recommendation runs for today. Try again tomorrow.`,
                used: quota.used,
                limit: quota.limit,
                feature: 'video-storyteller',
                currentPlan: quota.plan,
            },
            { status: 429 }
        );
    }

    try {
        const body = await request.json();

        // Phase F.1: dispatcher routes Genkit vs ADK sidecar based on
        // SAHAYAKAI_VIDEO_STORYTELLER_MODE env (default: off → Genkit only).
        // Sidecar replaces ONLY the AI categories+message call; YouTube
        // ranking + curated fallback merge stays in Next.js.
        const dispatched = await dispatchVideoStoryteller({
            ...body,
            userId
        });

        return NextResponse.json({
            categories: dispatched.categories,
            personalizedMessage: dispatched.personalizedMessage,
            categorizedVideos: dispatched.categorizedVideos,
            fromCache: dispatched.fromCache,
            latencyScore: dispatched.latencyScore,
        });
    } catch (error) {
        // Return the reserved quota unit — the call delivered no value.
        await rollbackDailyQuota(userId, 'video_storyteller');

        logAIError(error, 'VIDEO_STORYTELLER', {
            message: 'Video Storyteller API Failed',
            userId,
        });

        // Do not leak internal error detail (model IDs, endpoints, stack) to
        // the client — log it server-side, return a generic message.
        return NextResponse.json(
            { error: 'Failed to generate video recommendations', code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
