/**
 * POST /api/sampark/[orgId]/campaigns/[id]/preview — what parents will hear.
 *
 * Input:  { languages?: ParentLanguage[] } (default: all four).
 * Output: { previews: ScriptPreview[] } — one per language × audio variant
 *         (emergency closure: 'today' and 'tomorrow'). Text always; `audioKey`
 *         and `durationSeconds` set when that exact clip has been rendered
 *         (play it via GET /api/sampark/[orgId]/audio/[key]).
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   template rendering only (no TTS) + 1 clip-metadata read per clip.
 * Done:   English, Hindi, Bengali and Nepali previews show the typed facts.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { previewCampaign, PreviewSchema } from '@/server/sampark/campaigns';
import { DocIdSchema, errorResponse, guardOrgRoute, invalidRequest, parseBody, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
    const p = await params;
    const guard = await guardOrgRoute(req, p.orgId);
    if ('response' in guard) return guard.response;
    const id = DocIdSchema.safeParse(p.id);
    if (!id.success) return invalidRequest(id.error);
    const body = await parseBody(req, PreviewSchema.optional().transform((b) => b ?? {}));
    if ('response' in body) return body.response;
    try {
        const previews = await previewCampaign(await samparkContext(), guard.orgId, id.data, body.data.languages);
        return NextResponse.json({ previews });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_PREVIEW');
    }
}
