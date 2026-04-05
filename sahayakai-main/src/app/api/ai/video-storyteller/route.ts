import { NextResponse } from 'next/server';
import { getVideoRecommendations } from '@/ai/flows/video-storyteller';
import { logger } from '@/lib/logger';

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

        const output = await getVideoRecommendations({
            ...body,
            userId
        });

        return NextResponse.json(output);
    } catch (error) {
        logger.error('Video Storyteller API Failed', error, 'VIDEO_STORYTELLER', {
            userId: request.headers.get('x-user-id')
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
