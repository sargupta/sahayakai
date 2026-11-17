import { NextRequest, NextResponse } from 'next/server';

import { liveVoiceAccess } from '@/lib/vidya-live/live-access';

/**
 * GET /api/vidya-voice/eligibility → { live: boolean }
 *
 * Asked once by the app shell (VidyaLiveProvider) before it shows the
 * hands-free VIDYA orb. `live: false` keeps the tap-to-talk VIDYA, so a
 * teacher outside the Live cohort, or a deployment without the voice
 * service, never sees a voice orb that only answers "not available".
 * Same decision as start-session (src/lib/vidya-live/live-access.ts); the
 * reason is not returned, so the answer cannot be used to probe the cohort.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const uid = request.headers.get('x-user-id');
    if (!uid) return NextResponse.json({ live: false }, { status: 401 });
    return NextResponse.json({ live: liveVoiceAccess(uid).ok }, { headers: { 'Cache-Control': 'no-store' } });
}
