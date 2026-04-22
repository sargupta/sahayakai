import { NextResponse } from 'next/server';
import { generateQuiz } from '@/ai/flows/quiz-generator';
import { QuizGeneratorInputSchema } from '@/ai/schemas/quiz-generator-schemas';
import { handleAIError } from '@/lib/ai-error-response';
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
        return handleAIError(error, 'QUIZ', {
            message: `Quiz API Failed for topic: "${topicText}"`,
            userId: request.headers.get('x-user-id'),
        });
    }
}

export const POST = withPlanCheck('quiz')(_handler);
