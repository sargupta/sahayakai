
import { NextResponse } from 'next/server';
import { generateWorksheet } from '@/ai/flows/worksheet-wizard';

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
export async function POST(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const body = await request.json();

        // Call the AI Flow
        const output = await generateWorksheet({
            ...body,
            userId: userId
        });

        return NextResponse.json(output);

    } catch (error: any) {
        console.error('Worksheet API Error:', error);

        const errorMessage = error.message || 'Internal Server Error';
        const errorCode = error.errorCode || 'UNKNOWN_ERROR';
        const context = error.context || null;

        return NextResponse.json(
            {
                error: errorMessage,
                errorCode: errorCode,
                details: errorMessage,
                context: context
            },
            { status: 500 }
        );
    }
}
