import { NextResponse } from 'next/server';
import { generateQuiz } from '@/ai/flows/quiz-generator';
import { QuizGeneratorInputSchema } from '@/ai/schemas/quiz-generator-schemas';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
    let topicText = 'Unknown Topic';
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const json = await request.json();
        topicText = json.topic || 'Unknown Topic';

        // SECURITY: Validate input against schema
        const body = QuizGeneratorInputSchema.parse(json);

        // Call the AI Flow
        const output = await generateQuiz({
            ...body,
            userId: userId
        });

        return NextResponse.json(output);

    } catch (error) {
        logger.error(`Quiz API Failed for topic: "${topicText}"`, error, 'QUIZ', { userId: request.headers.get('x-user-id') });

        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: errorMessage },
            { status: 500 }
        );
    }
}
