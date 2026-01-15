import { NextRequest, NextResponse } from 'next/server';
import { chatFlow } from '@/ai/flows/chat_flow';
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
        const { question, language, gradeLevel } = await req.json();

        if (!question) {
            return NextResponse.json({ error: 'Question is required' }, { status: 400 });
        }

        // 3. Call Genkit Flow
        const result = await chatFlow({
            question,
            language: language || 'en',
            gradeLevel: gradeLevel || '6th Grade',
        });

        return NextResponse.json(result, { status: 200 });
    } catch (error: any) {
        console.error('Chat API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
