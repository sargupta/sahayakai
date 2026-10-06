/**
 * GET /api/webhooks/sampark-voice/audio.wav?t=<sampark-audio token>
 *
 * The audio behind every <Play> in a Sampark notice call. The path ends in
 * `.wav` before the query string because some players choose a decoder by
 * extension. (HEAD is answered by Next from this GET.)
 *
 * Input:  t (query) — audio token for `${orgId}~${clipKey}`, minted when the
 *         answer/gather XML was built.
 * Output: audio/wav, 16-bit PCM (converted from the stored 8 kHz μ-law), or 404
 *         JSON unless the clip belongs to that org and passed its transcribe-back check.
 * Auth:   the signed token. Public prefix /api/webhooks/.
 * Flags:  SAMPARK_ENABLED !== 'true' → 404; SAMPARK_LIVE_DIAL_ENABLED !== 'true' → 404.
 * Cost:   one clip metadata read + one audio-store read.
 * Done:   Vobiz plays exactly the audio that was verified.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { getSpeechDeps } from '@/lib/sampark/repo/factory';
import { samparkContext, samparkDisabledResponse } from '@/server/sampark/http';
import { readSamparkVoiceAudio, voiceAudioResponse } from '@/server/sampark/voice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
    const disabled = samparkDisabledResponse();
    if (disabled) return disabled;
    try {
        const [{ repo }, { store }] = await Promise.all([samparkContext(), getSpeechDeps()]);
        const wav = await readSamparkVoiceAudio({ repo, store }, { token: req.nextUrl.searchParams.get('t') });
        if (!wav) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return voiceAudioResponse(wav);
    } catch (err) {
        logger.error('Sampark voice audio failed', err, 'SAMPARK_VOICE');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
