import { NextRequest, NextResponse } from 'next/server';
import { voiceToTextFormData } from '@/ai/flows/voice-to-text';
import { sarvamSTT } from '@/lib/sarvam';
import { logger } from '@/lib/logger';
import { withPlanCheck } from '@/lib/plan-guard';

async function _handler(request: NextRequest) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const audioFile = formData.get('audio') as File | null;

        // --- Try Sarvam STT first (cheaper, purpose-built for Indian languages) ---
        if (audioFile) {
            try {
                logger.info('[STT] Trying Sarvam Saaras v3', 'VOICE_TO_TEXT');
                const result = await sarvamSTT(audioFile);

                if (result.text && result.text.length >= 2) {
                    logger.info(`[STT] Sarvam success: ${result.text.length} chars, lang=${result.language}`, 'VOICE_TO_TEXT');
                    return NextResponse.json(result);
                }

                // Sarvam returned empty/too-short — fall through to Gemini
                logger.warn('[STT] Sarvam returned insufficient text, falling back to Gemini', 'VOICE_TO_TEXT');
            } catch (sarvamErr) {
                logger.warn(`[STT] Sarvam failed: ${sarvamErr instanceof Error ? sarvamErr.message : String(sarvamErr)}, falling back to Gemini`, 'VOICE_TO_TEXT');
            }
        }

        // --- Fallback: Gemini multimodal STT (via Genkit) ---
        logger.info('[STT] Using Gemini fallback', 'VOICE_TO_TEXT');
        const output = await voiceToTextFormData(formData);
        return NextResponse.json(output);
    } catch (error) {
        logger.error('Voice-to-text API failed', error, 'VOICE_TO_TEXT');
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const POST = withPlanCheck('voice-to-text')(_handler);
