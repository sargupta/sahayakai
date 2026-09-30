/**
 * POST /api/sampark/[orgId]/imports — import the school's students and
 * guardians from its CRM.
 *
 * Input:  { source: 'rest' } — pull from the saved CRM (school.crm.baseUrl,
 *         key via getSecret(school.crm.apiKeySecretName));
 *         { source: 'csv', studentsCsv, guardiansCsv } — the two exports (≤5 MB each).
 * Output: ImportRun — status 'succeeded' with counts and quarantined rows
 *         (each with a reason), or 'failed' with a safe error message.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   REST: 1 + ceil(n/200) CRM requests per entity (15 s timeout each);
 *         Firestore: batched writes (≤400 per batch) for students, guardians,
 *         new preferences. Phones are encrypted; plaintext is never stored or logged.
 * Done:   malformed records appear in `rejected` with reasons; valid ones import.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, guardOrgRoute, parseBody, samparkContext } from '@/server/sampark/http';
import { startImport, StartImportSchema } from '@/server/sampark/imports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const body = await parseBody(req, StartImportSchema);
    if ('response' in body) return body.response;
    try {
        return NextResponse.json(await startImport(await samparkContext(), guard.orgId, guard.uid, body.data));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_IMPORT');
    }
}
