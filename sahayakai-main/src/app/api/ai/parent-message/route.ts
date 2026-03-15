import { NextRequest, NextResponse } from 'next/server';
import { generateParentMessage } from '@/ai/flows/parent-message-generator';

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();

        if (!body.studentName || !body.className || !body.subject || !body.reason || !body.parentLanguage) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const result = await generateParentMessage({ ...body, userId });
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[parent-message] Error:', error);
        return NextResponse.json({ error: error.message ?? 'Failed to generate message' }, { status: 500 });
    }
}
