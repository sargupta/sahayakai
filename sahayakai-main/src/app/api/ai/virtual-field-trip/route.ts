
import { NextResponse } from 'next/server';
import { planVirtualFieldTrip } from '@/ai/flows/virtual-field-trip';

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
export async function POST(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const body = await request.json();

        const output = await planVirtualFieldTrip({
            ...body,
            userId: userId
        });

        return NextResponse.json(output);

    } catch (error) {
        console.error('Virtual Field Trip API Error:', error);

        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: errorMessage },
            { status: 500 }
        );
    }
}
