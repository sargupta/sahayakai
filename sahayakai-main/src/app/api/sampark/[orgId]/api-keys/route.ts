/**
 * GET  /api/sampark/[orgId]/api-keys — the school's MCP API keys.
 * POST /api/sampark/[orgId]/api-keys — mint one.
 *
 * Input:  POST { label: string (1–80), scopes: ('lesson-planner'|'exam-paper'|'quiz')[] } (strict).
 * Output: GET  { keys: IntegrationApiKey[] } newest first — never the key itself.
 *         POST { key: IntegrationApiKey, apiKey: string } — the ONLY response that carries the
 *         full key; shown once, `cache-control: no-store`.
 * Auth:   x-user-id (401) + requireOrgAdmin (403). Any school admin (brief decision 3).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Audit:  api_key.created with key id and label.
 * Done:   a key minted here authenticates against /api/mcp/* for its scopes only.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, guardOrgRoute, parseBody, samparkContext } from '@/server/sampark/http';
import { createApiKey, CreateApiKeySchema, listApiKeys } from '@/server/sampark/api-keys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    try {
        return NextResponse.json({ keys: await listApiKeys(guard.orgId) }, { headers: NO_STORE });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_API_KEYS');
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const body = await parseBody(req, CreateApiKeySchema);
    if ('response' in body) return body.response;
    try {
        const created = await createApiKey(await samparkContext(), guard.orgId, guard.uid, body.data);
        return NextResponse.json(created, { status: 201, headers: NO_STORE });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_API_KEYS');
    }
}
