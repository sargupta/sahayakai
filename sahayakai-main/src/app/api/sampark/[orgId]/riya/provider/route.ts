/**
 * The school's calling provider (Settings → Calling provider).
 *
 * GET → SchoolProviderView: the school's provider, whether it was explicitly chosen, each option
 *       ({ id, available, price: { inrPerMinute, asOf }, differences }) and the estimate's starting
 *       values (families = the school's guardians on record). Prices are deployment settings;
 *       a missing price is null, never a made-up number. No configuration values are returned.
 * PUT { provider: 'elevenlabs' | 'vobiz' } → SchoolProviderView after the change.
 *       409 PROVIDER_NOT_AVAILABLE for a provider this deployment has not set up. Asking for the
 *       stored provider changes nothing. Every change is audited (school.conversation_provider),
 *       and a running class-wide batch pauses on its next tick (PROVIDER_CHANGED).
 *
 * Auth:  x-user-id (401) + requireOrgAdmin (403) — the same guard as every Riya route.
 * Flags: SAMPARK_ENABLED==='true' else 404; SAMPARK_ELEVENLABS_ENABLED==='true' (Riya) else 404.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { guardRiyaRoute } from '@/server/sampark/conversation-http';
import { errorResponse, parseBody, samparkContext } from '@/server/sampark/http';
import { changeSchoolProvider, getSchoolProvider } from '@/server/sampark/provider-setting';
import { ConversationProviderSchema } from '@/server/sampark/school';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardRiyaRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    try {
        return NextResponse.json(await getSchoolProvider(await samparkContext(), guard.orgId), { headers: { 'cache-control': 'no-store' } });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_PROVIDER_GET');
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardRiyaRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const body = await parseBody(req, ConversationProviderSchema);
    if ('response' in body) return body.response;
    try {
        return NextResponse.json(await changeSchoolProvider(await samparkContext(), guard.orgId, guard.uid, body.data.provider), { headers: { 'cache-control': 'no-store' } });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_PROVIDER_PUT');
    }
}
