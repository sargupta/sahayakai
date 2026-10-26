/**
 * POST /api/sampark/[orgId]/api-keys/[keyId]/revoke — revoke one of the school's MCP API keys.
 *
 * Input:  none.
 * Output: { key: IntegrationApiKey } with status 'revoked', revokedAt, revokedBy.
 *         Revoking twice is a no-op. Another school's key → 404.
 * Auth:   x-user-id (401) + requireOrgAdmin (403). Any school admin (brief decision 3).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Audit:  api_key.revoked with key id and label.
 * Done:   the key's next MCP request is refused (authenticateMcpRequest reads status on every request).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { DocIdSchema, errorResponse, guardOrgRoute, invalidRequest, samparkContext } from '@/server/sampark/http';
import { revokeApiKey } from '@/server/sampark/api-keys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; keyId: string }> }) {
    const p = await params;
    const guard = await guardOrgRoute(req, p.orgId);
    if ('response' in guard) return guard.response;
    const keyId = DocIdSchema.safeParse(p.keyId);
    if (!keyId.success) return invalidRequest(keyId.error);
    try {
        return NextResponse.json({ key: await revokeApiKey(await samparkContext(), guard.orgId, guard.uid, keyId.data) }, { headers: { 'cache-control': 'no-store' } });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_API_KEYS');
    }
}
