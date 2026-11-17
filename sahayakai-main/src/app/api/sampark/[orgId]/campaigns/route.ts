/**
 * GET  /api/sampark/[orgId]/campaigns — the school's campaigns, newest first (≤100).
 * POST /api/sampark/[orgId]/campaigns — create a DRAFT campaign.
 *
 * Input (POST): { purpose, facts, audience: { sections: {grade, section}[] }, notBefore? }
 *         purpose must be catalogue 'available', dialable and 'service' (class
 *         gate 8); facts are typed per purpose (date YYYY-MM-DD not in the past,
 *         time on the hour or half hour, venueId one of the school's venues;
 *         a closure must be for today or tomorrow IST). expiresAt is derived:
 *         end of the closure day (D4) or end of the event day, IST.
 * Output: GET { campaigns: Campaign[] }; POST Campaign (status 'draft').
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   GET 1 query; POST 1 read + 1 create + 1 audit write. Nothing is
 *         rendered or dialled until the campaign is approved.
 * Done:   a PTM, event or closure draft appears in the list; an unavailable
 *         purpose or a past date is refused 400.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { createCampaign, CreateCampaignSchema, listCampaigns } from '@/server/sampark/campaigns';
import { errorResponse, guardOrgRoute, parseBody, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    try {
        return NextResponse.json({ campaigns: await listCampaigns(await samparkContext(), guard.orgId) });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_CAMPAIGNS');
    }
}

export async function POST(req: NextRequest, { params }: Params) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const body = await parseBody(req, CreateCampaignSchema);
    if ('response' in body) return body.response;
    try {
        return NextResponse.json(await createCampaign(await samparkContext(), guard.orgId, guard.uid, body.data));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_CAMPAIGNS');
    }
}
