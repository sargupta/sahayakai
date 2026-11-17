/**
 * GET /api/sampark/[orgId]/guardians?language=&q=&limit= — guardians for the console.
 *
 * Input:  language ∈ English|Hindi|Bengali|Nepali|unknown (optional),
 *         q (name / child name / last-4 search, optional), limit 1–500 (default 100).
 * Output: { guardians: GuardianRow[] } — { id, displayName, relation,
 *         phoneLast4, phoneClass, language, consent, suppressed, students }.
 *         Last-4 only; the full number never leaves phoneEnc.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   3 collection reads + preferences getAll.
 * Done:   the language filter and search narrow the list; consent reflects the registry.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { listGuardianRows, GuardianQuerySchema } from '@/server/sampark/guardians';
import { errorResponse, guardOrgRoute, invalidRequest, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const sp = req.nextUrl.searchParams;
    const query = GuardianQuerySchema.safeParse({
        language: sp.get('language') || undefined,
        q: sp.get('q') || undefined,
        limit: sp.get('limit') || undefined,
    });
    if (!query.success) return invalidRequest(query.error);
    try {
        return NextResponse.json({ guardians: await listGuardianRows(await samparkContext(), guard.orgId, query.data) });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_GUARDIANS');
    }
}
