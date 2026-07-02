import { NextResponse } from 'next/server';
import { dispatchVideoStoryteller } from '@/lib/sidecar/video-storyteller-dispatch';
import { logger } from '@/lib/logger';
import { logAIError } from '@/lib/ai-error-response';

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
    try {
        // Require authentication. Middleware already 401s unauthenticated
        // /api/ai/* calls; we assert it here too so this expensive endpoint
        // (Gemini categorization + YouTube fan-out) can never be driven
        // anonymously even if the route were ever moved to the public list.
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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
        logAIError(error, 'VIDEO_STORYTELLER', {
            message: 'Video Storyteller API Failed',
            userId: request.headers.get('x-user-id'),
        });

        // Do not leak internal error detail (model IDs, endpoints, stack) to
        // the client — log it server-side, return a generic message.
        return NextResponse.json(
            { error: 'Failed to generate video recommendations', code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
