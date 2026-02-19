import { NextRequest, NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/db/adapter';
import { getAuthInstance } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
    try {
        const auth = await getAuthInstance();
        const authHeader = req.headers.get('Authorization');

        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        let userId: string;

        try {
            const decodedToken = await auth.verifyIdToken(token);
            userId = decodedToken.uid;
        } catch (e) {
            return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
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
