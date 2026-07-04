import { NextRequest, NextResponse } from 'next/server';
import { dispatchVoiceToText } from '@/lib/sidecar/voice-to-text-dispatch';
import { sarvamSTT } from '@/lib/sarvam';
import { logger } from '@/lib/logger';
import { logAIError } from '@/lib/ai-error-response';
import { withPlanCheck } from '@/lib/plan-guard';
import { normalizeIsoLang, scriptMatchesExpected } from '@/ai/flows/voice-to-text';

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

        // Optional 2-letter ISO language hint from the client (e.g. "bn", "ta").
        // Forwarded through dispatcher → sidecar so the script-mismatch retry
        // path can fire. Mirrors the `uiLanguage` plumbing in /api/assistant.
        const rawExpectedLanguage = formData.get('expectedLanguage');
        const expectedLanguage =
            typeof rawExpectedLanguage === 'string' && /^[a-z]{2}$/i.test(rawExpectedLanguage)
                ? rawExpectedLanguage.toLowerCase()
                : undefined;

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
        // Sarvam Saaras v3 accepts mpeg/mp3/wav AND opus in webm/ogg containers.
        // The webm/ogg support was re-verified empirically on 2026-07-05
        // (saaras:v3, HTTP 200 + accurate Hindi transcript for both, ~0.4-1.1s):
        // an older Sarvam model rejected them with HTTP 400, which is why this
        // gate used to skip straight to Gemini. Because the browser
        // MediaRecorder records `audio/ogg;codecs=opus` (Firefox) or
        // `audio/webm;codecs=opus` (Chrome), that stale gate meant EVERY mic
        // recording bypassed Sarvam and paid for the slower, pricier, non-India
        // Gemini path. Including webm/ogg here restores the fast, cheap,
        // India-resident Sarvam path for the primary recorder. The regex is not
        // end-anchored so it still matches the `;codecs=opus` suffix.
        const sarvamSupportedMime = /^audio\/(mpeg|mp3|mpeg3|x-mpeg-3|x-mp3|wav|wave|x-wav|webm|ogg)/i;
        const audioMime = audioFile.type || '';
        const sarvamCanHandle = sarvamSupportedMime.test(audioMime);

        if (!sarvamCanHandle) {
            logger.info(
                `[STT] Skipping Sarvam (unsupported MIME: "${audioMime || 'unknown'}"), going straight to Gemini`,
                'VOICE_TO_TEXT',
            );
        }

        if (sarvamCanHandle) try {
            logger.info('[STT] Trying Sarvam Saaras v3', 'VOICE_TO_TEXT');
            const result = await sarvamSTT(audioFile);

            if (result.text && result.text.length >= 2) {
                // Lane A5 fix — Sarvam ignores `expectedLanguage` for some
                // languages (notably Punjabi: returns Devanagari labeled as
                // `hi`). When the user asked for a specific Indic language
                // and the transcript script doesn't match, drop the Sarvam
                // result and fall through to the Gemini path (which honours
                // the expectedLanguage hint and has the forceScript retry).
                if (expectedLanguage && !scriptMatchesExpected(result.text, expectedLanguage)) {
                    logger.warn(
                        `[STT] Sarvam script_mismatch expectedLanguage=${expectedLanguage} sarvamLang=${result.language} sample="${result.text.slice(0, 60)}" — falling through to Gemini`,
                        'VOICE_TO_TEXT',
                    );
                } else {
                    // Normalize the detected language at the output boundary
                    // so downstream consumers see canonical 2-letter codes
                    // (e.g. Sarvam's `od` → `or` for Odia).
                    const normalizedLang = normalizeIsoLang(result.language);
                    logger.info(`[STT] Sarvam success: ${result.text.length} chars, lang=${normalizedLang}`, 'VOICE_TO_TEXT');
                    return NextResponse.json({ text: result.text, language: normalizedLang });
                }
            } else {
                logger.warn('[STT] Sarvam returned insufficient text, falling back to Gemini', 'VOICE_TO_TEXT');
            }
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
            expectedLanguage,
        });
        return NextResponse.json({
            text: dispatched.text,
            language: normalizeIsoLang(dispatched.language),
        });
    } catch (error) {
        logAIError(error, 'VOICE_TO_TEXT', { message: 'Voice-to-text API failed' });
        // Server-side detail is captured by logAIError; return a generic body
        // so the client never sees raw internal error strings.
        return NextResponse.json({ error: 'Failed to transcribe. Please try again.', code: 'INTERNAL_ERROR' }, { status: 500 });
    }
}

export const POST = withPlanCheck('voice-to-text')(_handler);
