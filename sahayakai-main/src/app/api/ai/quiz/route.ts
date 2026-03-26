import { NextResponse } from 'next/server';
import { generateQuiz } from '@/ai/flows/quiz-generator';
import { QuizGeneratorInputSchema } from '@/ai/schemas/quiz-generator-schemas';
import { logger } from '@/lib/logger';
import { withPlanCheck } from '@/lib/plan-guard';

async function _handler(request: Request) {
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

        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export const POST = withPlanCheck('quiz')(_handler);
