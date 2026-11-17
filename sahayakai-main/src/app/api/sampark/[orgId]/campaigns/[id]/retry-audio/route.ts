/**
 * POST /api/sampark/[orgId]/campaigns/[id]/retry-audio — prepare a campaign's
 * audio again after a clip failed its transcribe-back check.
 *
 * Input:  none.
 * Output: Campaign ('render_failed' → 'rendering', failures cleared). The next
 *         render job re-renders only the clips that failed; passed clips are kept.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   1 read + 1 update + 1 audit write here; the failed clips' TTS + STT on the next job.
 * Done:   409 unless the campaign is 'render_failed' and not expired.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { retryCampaignAudio } from '@/server/sampark/campaigns';
import { DocIdSchema, errorResponse, guardOrgRoute, invalidRequest, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
    const p = await params;
    const guard = await guardOrgRoute(req, p.orgId);
    if ('response' in guard) return guard.response;
    const id = DocIdSchema.safeParse(p.id);
    if (!id.success) return invalidRequest(id.error);
    try {
        return NextResponse.json(await retryCampaignAudio(await samparkContext(), guard.orgId, id.data, guard.uid));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_RETRY_AUDIO');
    }
}
