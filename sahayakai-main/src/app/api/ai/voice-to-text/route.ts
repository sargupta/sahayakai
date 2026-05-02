import { NextRequest, NextResponse } from 'next/server';
import { dispatchVoiceToText } from '@/lib/sidecar/voice-to-text-dispatch';
import { sarvamSTT } from '@/lib/sarvam';
import { logger } from '@/lib/logger';
import { logAIError } from '@/lib/ai-error-response';
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

        // Wave 2: cap audio at 10 MB. STT cost scales with duration, and a
        // 10 MB Opus file is already ~30 minutes — far longer than any
        // legitimate teacher voice note or chat dictation.
        const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
        if (audioFile.size > MAX_AUDIO_BYTES) {
            return NextResponse.json(
                { error: `Audio file too large (max ${MAX_AUDIO_BYTES / 1024 / 1024} MB).` },
                { status: 413 },
            );
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

        // --- Fallback: Gemini multimodal STT (via dispatcher → Genkit or ADK sidecar) ---
        // Phase I: dispatcher routes Genkit vs ADK sidecar based on
        // SAHAYAKAI_VOICE_TO_TEXT_MODE env (default: off → Genkit only).
        // Build the data URI form the sidecar (and Genkit) expect.
        logger.info('[STT] Using Gemini fallback (via dispatcher)', 'VOICE_TO_TEXT');
        const arrayBuffer = await audioFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = audioFile.type || 'audio/webm';
        const audioDataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
        const dispatched = await dispatchVoiceToText({
            audioDataUri,
            userId,
        });
        return NextResponse.json({
            text: dispatched.text,
            language: dispatched.language,
        });
    } catch (error) {
        logAIError(error, 'VOICE_TO_TEXT', { message: 'Voice-to-text API failed' });
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const POST = withPlanCheck('voice-to-text')(_handler);
