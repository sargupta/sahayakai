import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbAdapter } from '@/lib/db/adapter';
import { logger } from '@/lib/logger';

/**
 * POST /api/feedback
 *
 * F3-001 fix: previously the route spread `...body` straight into the
 * Firestore write, allowing a caller to inject arbitrary fields (incl.
 * fields that would shadow internal state). We now validate with Zod
 * and pass only allow-listed fields through.
 */

const FeedbackSchema = z.object({
    feedbackType: z.enum(['quiz', 'lesson_plan', 'assistant', 'general', 'bug', 'feature']).optional(),
    questionIndex: z.number().int().min(0).max(10_000).optional(),
    quizId: z.string().max(128).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    value: z.union([
        z.string().max(2000),
        z.number(),
        z.boolean(),
        z.enum(['up', 'down', 'like', 'dislike']),
    ]).optional(),
    rating: z.number().min(1).max(5).optional(),
    comment: z.string().max(2000).optional(),
    context: z.record(z.string().max(1000)).optional(),
}).strict();

export async function POST(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let raw: unknown;
        try {
            raw = await req.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const parsed = FeedbackSchema.safeParse(raw);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid feedback payload', issues: parsed.error.flatten() },
                { status: 400 },
            );
        }

        await dbAdapter.saveFeedback(userId, {
            ...parsed.data,
            timestamp: new Date().toISOString(),
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Error in feedback API', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
