import { NextRequest, NextResponse } from 'next/server';
import { quizFlow } from '@/ai/flows/quiz_flow';
import { getAuth } from 'firebase-admin/auth';
import { initFirebaseAdmin } from '@/lib/firebase-admin';

// Initialize Firebase Admin
initFirebaseAdmin();

export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // const token = authHeader.split('Bearer ')[1];
        // await getAuth().verifyIdToken(token); // Verify token

        // 2. Parse
        const body = await req.json();

        // Validate required fields
        if (!body.topic) {
            return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
        }

        // 3. Call Genkit Flow
        const result = await quizFlow({
            topic: body.topic,
            language: body.language || 'en',
            gradeLevel: body.gradeLevel || '5th Grade',
            numQuestions: body.numQuestions || 5,
            questionTypes: body.questionTypes || ["multiple_choice"],
            bloomsTaxonomyLevels: body.bloomsTaxonomyLevels || ['Remember'],
            imageDataUri: body.imageDataUri
        });

        return NextResponse.json(result, { status: 200 });
    } catch (error: any) {
        console.error('Quiz API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
