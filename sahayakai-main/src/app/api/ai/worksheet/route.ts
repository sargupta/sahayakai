
import { NextResponse } from 'next/server';
import { WorksheetWizardInputSchema } from '@/ai/flows/worksheet-wizard';
import { handleAIError } from '@/lib/ai-error-response';
import { withPlanCheck } from '@/lib/plan-guard';
import { dispatchWorksheet } from '@/lib/sidecar/worksheet-dispatch';

/**
 * @swagger
 * /api/ai/worksheet:
 *   post:
 *     summary: Generate a Worksheet
 *     description: Uses AI to generate a detailed worksheet based on a textbook image and a prompt.
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
 *               - imageDataUri
 *             properties:
 *               prompt:
 *                 type: string
 *                 example: "Create a math multiplication worksheet based on this page."
 *               imageDataUri:
 *                 type: string
 *                 description: "Base64 encoded image data URI"
 *                 example: "data:image/png;base64,..."
 *               gradeLevel:
 *                 type: string
 *                 example: "Class 4"
 *               language:
 *                 type: string
 *                 example: "English"
 *     responses:
 *       200:
 *         description: Generated Worksheet
 *       400:
 *         description: Invalid input
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

        const json = await request.json();
        promptText = json.prompt || 'Unknown Prompt';

        // SECURITY: Validate input against schema — rejects missing prompt or
        // malformed imageDataUri with a 400 instead of crashing inside the flow.
        const body = WorksheetWizardInputSchema.parse(json);

        // Phase D.4: dispatcher routes Genkit vs ADK sidecar based on
        // SAHAYAKAI_WORKSHEET_MODE env (default: off).
        const dispatched = await dispatchWorksheet({
            ...body,
            userId,
        });
        return NextResponse.json({
            title: dispatched.title,
            gradeLevel: dispatched.gradeLevel,
            subject: dispatched.subject,
            learningObjectives: dispatched.learningObjectives,
            studentInstructions: dispatched.studentInstructions,
            activities: dispatched.activities,
            answerKey: dispatched.answerKey,
        });

    } catch (error) {
        return handleAIError(error, 'WORKSHEET', {
            message: `Worksheet API Failed for prompt: "${promptText}"`,
            userId: request.headers.get('x-user-id'),
        });
    }
}

export const POST = withPlanCheck('worksheet')(_handler);
