
import { NextResponse } from 'next/server';
import { WorksheetWizardInputSchema } from '@/ai/flows/worksheet-wizard';
import { handleAIError } from '@/lib/ai-error-response';
import { withPlanCheck } from '@/lib/plan-guard';
import { dispatchWorksheet, type DispatchedWorksheet } from '@/lib/sidecar/worksheet-dispatch';

/**
 * The 200 wire payload. Declared explicitly, and built by `toPayload` below,
 * so that dropping a field from the response is a build error rather than a
 * silent change of contract: this route once served every structured field
 * but not `worksheetContent`, which is the only one the client renders.
 */
interface WorksheetApiPayload {
    title: string;
    gradeLevel: string;
    subject: string;
    learningObjectives: string[];
    studentInstructions: string;
    activities: DispatchedWorksheet['activities'];
    answerKey: DispatchedWorksheet['answerKey'];
    worksheetContent: string;
}

function toPayload(dispatched: DispatchedWorksheet): WorksheetApiPayload {
    return {
        title: dispatched.title,
        gradeLevel: dispatched.gradeLevel,
        subject: dispatched.subject,
        learningObjectives: dispatched.learningObjectives,
        studentInstructions: dispatched.studentInstructions,
        activities: dispatched.activities,
        answerKey: dispatched.answerKey,
        worksheetContent: dispatched.worksheetContent,
    };
}

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

        // A worksheet with no Markdown body is not a worksheet. Serving it as
        // 200 renders an empty page AND banks the teacher's plan quota, since
        // withPlanCheck only refunds a non-2xx. Throwing here becomes a 500
        // and the gate rolls the reservation back — a blank success is worse
        // than an honest error.
        if (!dispatched.worksheetContent?.trim()) {
            throw new Error(
                `Worksheet dispatch (${dispatched.source}) returned no worksheetContent`,
            );
        }

        return NextResponse.json(toPayload(dispatched));

    } catch (error) {
        return handleAIError(error, 'WORKSHEET', {
            message: `Worksheet API Failed for prompt: "${promptText}"`,
            userId: request.headers.get('x-user-id'),
        });
    }
}

export const POST = withPlanCheck('worksheet')(_handler);
