import { NextRequest, NextResponse } from 'next/server';
import { generateAvatar } from '@/ai/flows/avatar-generator';
import { checkImageRateLimit } from '@/lib/server-safety';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const body = await request.json();
        await checkImageRateLimit(userId);
        const output = await generateAvatar({ ...body, userId });
        return NextResponse.json(output);
    } catch (error) {
        logger.error('Avatar generation API failed', error, 'AVATAR');
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Daily image limit reached')) {
            return NextResponse.json({ error: message }, { status: 429 });
        }
        return NextResponse.json({ error: 'Image generation failed. Please try again.' }, { status: 500 });
    }
}
