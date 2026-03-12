import { NextRequest, NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/db/adapter';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        // body should contain: { feedbackType, questionIndex, quizId, difficulty, value }

        await dbAdapter.saveFeedback(userId, {
            ...body,
            timestamp: new Date().toISOString()
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Error in feedback API', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
