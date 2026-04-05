
import { NextResponse } from 'next/server';
import { planVirtualFieldTrip } from '@/ai/flows/virtual-field-trip';
import { logger } from '@/lib/logger';
import { withPlanCheck } from '@/lib/plan-guard';

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
 *         description: Planned Virtual Field Trip
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

        const body = await request.json();
        topicName = body.topic || 'Unknown Topic';

        const output = await planVirtualFieldTrip({
            ...body,
            userId: userId
        });

        return NextResponse.json(output);

    } catch (error) {
        logger.error(`Virtual Field Trip API Failed for topic: "${topicName}"`, error, 'VIRTUAL_FIELD_TRIP', { userId: request.headers.get('x-user-id') });

        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export const POST = withPlanCheck('virtual-field-trip')(_handler);
