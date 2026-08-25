
import { NextResponse } from 'next/server';
import { VirtualFieldTripInputSchema } from '@/ai/flows/virtual-field-trip';
import { handleAIError } from '@/lib/ai-error-response';
import { withPlanCheck } from '@/lib/plan-guard';
import {
    dispatchVirtualFieldTrip,
    VirtualFieldTripStillGeneratingError,
} from '@/lib/sidecar/virtual-field-trip-dispatch';

// Allow up to 120s for AI generation (hot path can be slow under load)
export const maxDuration = 120;

/**
 * @swagger
 * /api/ai/virtual-field-trip:
 *   post:
 *     summary: Plan a Virtual Field Trip
 *     description: Uses AI to plan an immersive virtual field trip using Google Earth stops.
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
 *                 example: "The Great Barrier Reef"
 *               gradeLevel:
 *                 type: string
 *                 example: "Class 7"
 *               language:
 *                 type: string
 *                 example: "English"
 *     responses:
 *       200:
 *         description: >
 *           Planned Virtual Field Trip. Always carries a non-empty `stops`
 *           array — the client maps over it unconditionally.
 *       202:
 *         description: >
 *           Generation exceeded the dispatcher budget and is still running in
 *           the background; the trip will appear in My Library. The body is an
 *           `{ error: "still_generating" }` envelope and carries NO trip
 *           fields, so a client must branch on the 202 before touching it —
 *           `res.ok` is true here.
 *       400:
 *         description: Invalid input
 *       500:
 *         description: AI Generation failed
 */
async function _handler(request: Request) {
    let topicName = 'Unknown Topic';
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const json = await request.json();
        topicName = json.topic || 'Unknown Topic';

        const body = VirtualFieldTripInputSchema.parse(json);

        // Phase D.3: dispatcher routes Genkit vs ADK sidecar based on
        // SAHAYAKAI_VIRTUAL_FIELD_TRIP_MODE env (default: off).
        const dispatched = await dispatchVirtualFieldTrip({
            ...body,
            userId,
        });
        // `stops` is the entire trip as far as the client is concerned — the
        // display maps over it and renders nothing else. Serving a 200 without
        // stops would spend a plan credit on a blank page (withPlanCheck only
        // refunds a non-2xx), so throw instead and let the gate roll back.
        if (!Array.isArray(dispatched.stops) || dispatched.stops.length === 0) {
            throw new Error('Virtual field trip generation produced no stops');
        }

        return NextResponse.json({
            title: dispatched.title,
            stops: dispatched.stops,
            gradeLevel: dispatched.gradeLevel,
            subject: dispatched.subject,
        });

    } catch (error) {
        // NCERT demo hot-fix: when the dispatcher's 45s timeout fires, the
        // Genkit flow itself keeps running in the background and finishes
        // writing the trip to Firestore. Return a user-actionable 202
        // pointing the teacher at My Library instead of a generic 500
        // "AI generation failed" that hides the silently-saved content.
        if (error instanceof VirtualFieldTripStillGeneratingError) {
            return NextResponse.json(
                {
                    error: 'still_generating',
                    message:
                        'Your field trip is still generating. Check My Library in a minute.',
                    budgetMs: error.budgetMs,
                    elapsedMs: error.elapsedMs,
                },
                { status: 202 },
            );
        }
        return handleAIError(error, 'VIRTUAL_FIELD_TRIP', {
            message: `Virtual Field Trip API Failed for topic: "${topicName}"`,
            userId: request.headers.get('x-user-id'),
        });
    }
}

export const POST = withPlanCheck('virtual-field-trip')(_handler);
