
import { NextResponse } from 'next/server';
import { RubricGeneratorInputSchema } from '@/ai/flows/rubric-generator';
import { handleAIError } from '@/lib/ai-error-response';
import { withPlanCheck } from '@/lib/plan-guard';
import { dispatchRubric } from '@/lib/sidecar/rubric-dispatch';

/**
 * @swagger
 * /api/ai/rubric:
 *   post:
 *     summary: Generate a Rubric
 *     description: Uses AI to generate a detailed performance rubric for an assignment.
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
 *               - assignmentDescription
 *             properties:
 *               assignmentDescription:
 *                 type: string
 *                 example: "A grade 5 project on renewable energy sources."
 *               gradeLevel:
 *                 type: string
 *                 example: "Class 5"
 *               language:
 *                 type: string
 *                 example: "English"
 *     responses:
 *       200:
 *         description: Generated Rubric
 *       400:
 *         description: Invalid input
 *       500:
 *         description: AI Generation failed
 */
async function _handler(request: Request) {
    let assignmentText = 'Unknown Assignment';
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const json = await request.json();
        assignmentText = json.assignmentDescription || 'Unknown Assignment';

        const body = RubricGeneratorInputSchema.parse(json);

        // Phase D.1: dispatcher routes Genkit vs ADK sidecar based on
        // SAHAYAKAI_RUBRIC_MODE env (default: off → Genkit only).
        const dispatched = await dispatchRubric({
            ...body,
            userId,
        });
        return NextResponse.json({
            title: dispatched.title,
            description: dispatched.description,
            criteria: dispatched.criteria,
            gradeLevel: dispatched.gradeLevel,
            subject: dispatched.subject,
        });

    } catch (error) {
        return handleAIError(error, 'RUBRIC', {
            message: `Rubric API Failed for assignment: "${assignmentText}"`,
            userId: request.headers.get('x-user-id'),
        });
    }
}

export const POST = withPlanCheck('rubric')(_handler);
