import { NextResponse } from 'next/server';
import { AssessAssignmentInputSchema } from '@/ai/flows/assignment-assessor';
import { handleAIError } from '@/lib/ai-error-response';
import { withPlanCheck } from '@/lib/plan-guard';
import { checkImageRateLimit } from '@/lib/server-safety';
import { dispatchAssessment } from '@/lib/sidecar/assignment-assessor-dispatch';

/**
 * @swagger
 * /api/ai/assess-assignment:
 *   post:
 *     summary: Grade a handwritten student assignment from a photo.
 *     description: |
 *       Sends one student-work photo (base64 data URI) to the vision model,
 *       returns a structured assessment: transcript, overall score, per-criterion
 *       feedback, strengths, improvements, next steps, and confidence per criterion.
 *
 *       The route strips any `studentName` field before the model call so minor
 *       PII never reaches the LLM (defence in depth — clients are asked not to
 *       send it either).
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
 *               - imageDataUri
 *             properties:
 *               imageDataUri:
 *                 type: string
 *                 description: data:image/{jpeg|png|webp};base64,...
 *               rubricSnapshot:
 *                 type: object
 *               language:
 *                 type: string
 *               studentId:
 *                 type: string
 *               mode:
 *                 type: string
 *                 enum: [full, transcribe, score]
 *     responses:
 *       200:
 *         description: Structured assessment result.
 *       400:
 *         description: Invalid input.
 *       401:
 *         description: Missing user identity.
 *       429:
 *         description: Rate limit / plan limit reached.
 *       503:
 *         description: AI service busy (transient).
 */
async function _handler(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const raw = await request.json();

        // Defence in depth — never log or transmit student name PII even if a
        // client accidentally sends it. The schema below does not allow
        // studentName either; this delete is belt-and-braces.
        if (raw && typeof raw === 'object') {
            delete (raw as Record<string, unknown>).studentName;
        }

        // Per-uid image-call throttle. checkServerRateLimit also runs inside
        // dispatchAssessment as an absolute floor — this one fires first so
        // an obviously-over-quota teacher gets the 429 before we even touch
        // the AI key pool.
        await checkImageRateLimit(userId);

        const body = AssessAssignmentInputSchema.parse({ ...raw, userId });

        const result = await dispatchAssessment({ ...body, userId });
        return NextResponse.json(result);

    } catch (error) {
        return handleAIError(error, 'ASSESS_ASSIGNMENT', {
            message: 'Assessment API failed',
            userId: request.headers.get('x-user-id'),
        });
    }
}

export const POST = withPlanCheck('assess-assignment')(_handler);
