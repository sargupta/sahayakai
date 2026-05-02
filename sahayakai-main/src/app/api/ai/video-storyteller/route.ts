import { NextResponse } from 'next/server';
import { dispatchVideoStoryteller } from '@/lib/sidecar/video-storyteller-dispatch';
import { logger } from '@/lib/logger';
import { logAIError } from '@/lib/ai-error-response';

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
        // userId is optional — used only for profile-based personalization.
        // Video recommendations work without auth (RSS is free, no user data exposed).
        const userId = request.headers.get('x-user-id') || undefined;

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

        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Internal Server Error',
                code: (error as any).code || 'INTERNAL_ERROR'
            },
            { status: 500 }
        );
    }
}
