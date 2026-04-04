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

        if (!audioFile) {
            return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
        }

        // --- Try Sarvam STT first (cheaper, purpose-built for Indian languages) ---
        try {
            logger.info('[STT] Trying Sarvam Saaras v3', 'VOICE_TO_TEXT');
            const result = await sarvamSTT(audioFile);

            if (result.text && result.text.length >= 2) {
                logger.info(`[STT] Sarvam success: ${result.text.length} chars, lang=${result.language}`, 'VOICE_TO_TEXT');
                return NextResponse.json(result);
            }

            logger.warn('[STT] Sarvam returned insufficient text, falling back to Gemini', 'VOICE_TO_TEXT');
        } catch (sarvamErr) {
            logger.warn(`[STT] Sarvam failed: ${sarvamErr instanceof Error ? sarvamErr.message : String(sarvamErr)}, falling back to Gemini`, 'VOICE_TO_TEXT');
        }

        // --- Fallback: Gemini multimodal STT (via Genkit) ---
        // Rebuild FormData because the original File object is still valid but
        // voiceToTextFormData() expects a fresh FormData with an 'audio' key.
        logger.info('[STT] Using Gemini fallback', 'VOICE_TO_TEXT');
        const fallbackForm = new FormData();
        fallbackForm.append('audio', audioFile, audioFile.name || 'recording.webm');
        const output = await voiceToTextFormData(fallbackForm);
        return NextResponse.json(output);
    } catch (error) {
        logger.error('Voice-to-text API failed', error, 'VOICE_TO_TEXT');
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const POST = withPlanCheck('voice-to-text')(_handler);
