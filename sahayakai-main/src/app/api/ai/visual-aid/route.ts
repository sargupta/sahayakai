
// Allow up to 120s for image generation (Gemini preview model can be slow)
export const maxDuration = 120;

import { NextResponse } from 'next/server';
import { generateVisualAid } from '@/ai/flows/visual-aid-designer';
import { logger } from '@/lib/logger';
import { logAIError } from '@/lib/ai-error-response';
import { withPlanCheck } from '@/lib/plan-guard';

/**
 * @swagger
 * /api/ai/visual-aid:
 *   post:
 *     summary: Generate a Visual Aid (Drawing)
 *     description: Uses AI to generate a blackboard-style chalk drawing for a specific topic.
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
 *                 example: "Structure of a plant cell"
 *               gradeLevel:
 *                 type: string
 *                 example: "Class 6"
 *               language:
 *                 type: string
 *                 example: "English"
 *     responses:
 *       200:
 *         description: Generated Visual Aid
 *       400:
 *         description: Invalid input or Safety violation
 *       500:
 *         description: AI Generation failed
 */
async function _handler(request: Request) {
    let promptText = 'Unknown Prompt';
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const body = await request.json();
        promptText = body.prompt || 'Unknown Prompt';

        // NOTE: checkImageRateLimit is called INSIDE generateVisualAid after
        // the image is confirmed, so failed/timed-out generations don't consume quota.

        // Call the AI Flow
        const output = await generateVisualAid({
            ...body,
            userId: userId
        });

        return NextResponse.json(output);

    } catch (error: any) {
        logAIError(error, 'VISUAL_AID', { message: `Visual Aid API Failed for prompt: "${promptText}"`, userId: request.headers.get('x-user-id') });

        const errorMessage = error.message || 'Internal Server Error';
        const errorCode = error.errorCode || 'UNKNOWN_ERROR';
        const context = error.context || null;

        if (errorMessage.includes('Daily image limit reached')) {
            return NextResponse.json({ error: errorMessage }, { status: 429 });
        }

        if (errorMessage.includes('Safety Violation')) {
            return NextResponse.json({ error: errorMessage }, { status: 400 });
        }

        if (errorMessage === 'IMAGE_GENERATION_TIMEOUT') {
            return NextResponse.json(
                { error: 'Image generation timed out. Try a simpler diagram description or retry.' },
                { status: 504 }
            );
        }

        if (errorMessage === 'IMAGE_GENERATION_EMPTY') {
            return NextResponse.json(
                { error: 'The AI could not generate an image for this prompt. Try rephrasing with fewer labels.' },
                { status: 422 }
            );
        }

        return NextResponse.json(
            { error: 'Image generation failed. Please try again.' },
            { status: 500 }
        );
    }
}

export const POST = withPlanCheck('visual-aid')(_handler);
