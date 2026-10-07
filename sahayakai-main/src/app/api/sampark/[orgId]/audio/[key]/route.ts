/**
 * GET /api/sampark/[orgId]/audio/[key] — a rendered clip, for preview playback.
 *
 * Input:  key = the clip's content-hash key (from a ScriptPreview's audioKey).
 * Output: audio/wav bytes (8 kHz μ-law WAV). 404 unless a clip with this key
 *         exists under THIS school and its orgId matches.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   1 metadata read + 1 audio-store read (local disk in dev).
 * Done:   the console plays the exact audio a parent would hear.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getAudioStore } from '@/lib/sampark/repo/factory';
import { AudioKeySchema, getClipAudio } from '@/server/sampark/audio';
import { toPcm16Wav } from '@/server/sampark/audio-format';
import { errorResponse, guardOrgRoute, invalidRequest, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string; key: string }> }) {
    const p = await params;
    const guard = await guardOrgRoute(req, p.orgId);
    if ('response' in guard) return guard.response;
    const key = AudioKeySchema.safeParse(p.key);
    if (!key.success) return invalidRequest(key.error);
    try {
        const store = await getAudioStore();
        const { audio: stored } = await getClipAudio(await samparkContext(), store, guard.orgId, key.data);
        // Browsers cannot all decode μ-law WAV; the console asks for ?format=pcm (same samples, 16-bit).
        const audio = req.nextUrl.searchParams.get('format') === 'pcm' ? toPcm16Wav(stored) : stored;
        return new NextResponse(new Uint8Array(audio), {
            status: 200,
            headers: {
                'Content-Type': 'audio/wav',
                'Content-Length': String(audio.length),
                'Cache-Control': 'private, max-age=3600',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_AUDIO');
    }
}
