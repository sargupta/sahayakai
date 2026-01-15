import { NextRequest, NextResponse } from 'next/server';
import { lessonPlanFlow } from '@/ai/flows/lesson_plan_flow';
import { getAuth } from 'firebase-admin/auth';
import { initFirebaseAdmin } from '@/lib/firebase-admin';

// Initialize Firebase Admin if not already done
initFirebaseAdmin();

export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate Request
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            // return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
        }

        // const token = authHeader.split('Bearer ')[1];
        // let decodedToken;
        // try {
        //     decodedToken = await getAuth().verifyIdToken(token);
        // } catch (error) {
        //     console.error('Token verification failed:', error);
        //     return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        // }

        // 2. Parse Input
        const body = await req.json();

        // 3. Call Genkit Flow
        // Map Mobile App's "gradeLevels" (List) to "gradeLevel" (String)
        const flowInput = {
            topic: body.topic,
            language: body.language || 'English',
            gradeLevel: Array.isArray(body.gradeLevels) ? body.gradeLevels[0] : (body.gradeLevel || 'Grade 1'),
        };

        const lessonPlan = await lessonPlanFlow(flowInput);

        return NextResponse.json(lessonPlan, { status: 200 });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}

