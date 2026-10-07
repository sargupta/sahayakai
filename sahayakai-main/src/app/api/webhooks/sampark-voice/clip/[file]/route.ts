/**
 * GET /api/webhooks/sampark-voice/clip/<sampark-audio token>.wav
 *
 * The audio behind every <Play> in a Sampark notice call. The token is in the
 * PATH and the URL ends exactly in `.wav`, with no query string: Vobiz caches a
 * fetched file under its URL and picks the decoder from the extension, so an
 * earlier `audio.wav?t=<token>` URL was downloaded on every real call and then
 * silently skipped — four test calls on 2026-10-07 answered, heard nothing and
 * hung up after the keypad timeout. (HEAD is answered by Next from this GET.)
 *
 * Input:  file (path) — `<audio token>.wav`, the token for `${orgId}~${clipKey}`
 *         minted when the answer/gather XML was built.
 * Output: audio/wav, 16-bit PCM (converted from the stored 8 kHz μ-law), or 404
 *         JSON unless the clip belongs to that org and passed its transcribe-back check.
 * Auth:   the signed token. Public prefix /api/webhooks/.
 * Flags:  SAMPARK_ENABLED !== 'true' → 404; SAMPARK_LIVE_DIAL_ENABLED !== 'true' → 404.
 * Cost:   one clip metadata read + one audio-store read.
 * Done:   Vobiz plays exactly the audio that was verified.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { getAudioStore } from '@/lib/sampark/repo/factory';
import { samparkContext, samparkDisabledResponse } from '@/server/sampark/http';
import { readSamparkVoiceAudio, tokenFromClipFile, voiceAudioResponse } from '@/server/sampark/voice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ file: string }> }): Promise<NextResponse> {
    const disabled = samparkDisabledResponse();
    if (disabled) return disabled;
    try {
        const [{ repo }, store] = await Promise.all([samparkContext(), getAudioStore()]);
        const wav = await readSamparkVoiceAudio({ repo, store }, { token: tokenFromClipFile((await params).file) });
        if (!wav) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return voiceAudioResponse(wav);
    } catch (err) {
        logger.error('Sampark voice audio failed', err, 'SAMPARK_VOICE');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
