import { NextRequest, NextResponse } from 'next/server';
import { dispatchAvatar } from '@/lib/sidecar/avatar-generator-dispatch';
import { checkImageRateLimit } from '@/lib/server-safety';
import { logger } from '@/lib/logger';
import { logAIError } from '@/lib/ai-error-response';
import { withPlanCheck } from '@/lib/plan-guard';

async function _handler(request: NextRequest) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const body = await request.json();
        await checkImageRateLimit(userId);
        // Phase F.2: dispatcher routes Genkit vs ADK sidecar based on
        // SAHAYAKAI_AVATAR_MODE env (default: off → Genkit only).
        // Sidecar generates only the image; Storage write happens in
        // the dispatcher when sidecar is the source.
        const dispatched = await dispatchAvatar({ ...body, userId });
        return NextResponse.json({
            imageDataUri: dispatched.imageDataUri,
        });
    } catch (error) {
        logAIError(error, 'AVATAR', { message: 'Avatar generation API failed' });
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Daily image limit reached')) {
            return NextResponse.json({ error: message }, { status: 429 });
        }
        return NextResponse.json({ error: 'Image generation failed. Please try again.' }, { status: 500 });
    }
}

export const POST = withPlanCheck('avatar')(_handler);
