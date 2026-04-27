import { NextResponse } from 'next/server';
import { QuizGeneratorInputSchema } from '@/ai/schemas/quiz-generator-schemas';
import { handleAIError } from '@/lib/ai-error-response';
import { withPlanCheck } from '@/lib/plan-guard';
import { dispatchQuiz } from '@/lib/sidecar/quiz-dispatch';

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

        // Phase E.1: dispatcher routes Genkit vs ADK sidecar based on
        // SAHAYAKAI_QUIZ_MODE env (default: off → Genkit only).
        const dispatched = await dispatchQuiz({
            ...body,
            userId,
        });
        return NextResponse.json({
            easy: dispatched.easy,
            medium: dispatched.medium,
            hard: dispatched.hard,
            id: dispatched.id,
            gradeLevel: dispatched.gradeLevel,
            subject: dispatched.subject,
            topic: dispatched.topic,
            isSaved: dispatched.isSaved,
        });

    } catch (error) {
        return handleAIError(error, 'QUIZ', {
            message: `Quiz API Failed for topic: "${topicText}"`,
            userId: request.headers.get('x-user-id'),
        });
    }
}

export const POST = withPlanCheck('quiz')(_handler);
