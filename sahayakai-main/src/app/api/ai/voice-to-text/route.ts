import { NextRequest, NextResponse } from 'next/server';
import { voiceToTextFormData } from '@/ai/flows/voice-to-text';
import { logger } from '@/lib/logger';
import { withPlanCheck } from '@/lib/plan-guard';

async function _handler(request: NextRequest) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const output = await voiceToTextFormData(formData);
        return NextResponse.json(output);
    } catch (error) {
        logger.error('Voice-to-text API failed', error, 'VOICE_TO_TEXT');
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const POST = withPlanCheck('voice-to-text')(_handler);
