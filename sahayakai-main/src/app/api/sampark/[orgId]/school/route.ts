/**
 * GET /api/sampark/[orgId]/school — the school's Sampark settings.
 * PUT /api/sampark/[orgId]/school — update them.
 *
 * Input (PUT): { displayName?, spokenName?, callingWindow?, holidays?, venues?,
 *         defaultLanguage?, crm?, testPhone? } — strict; callingWindow start >= 10,
 *         end <= 20, start < end; every venue named in all four languages;
 *         crm = { kind:'rest', baseUrl, apiKeySecretName } | { kind:'csv' } | null,
 *         baseUrl SSRF-checked (https only, no private addresses after DNS),
 *         apiKeySecretName must be SAMPARK_CRM_<NAME> (or MOCK_CRM_API_KEY) —
 *         the key itself never touches Firestore.
 *         testPhone = string (normalised; must be an Indian MOBILE, else 400
 *         TEST_PHONE_INVALID) | null (removes it). Changing or removing it while
 *         in Test mode returns the school to Practice (audited).
 * Output: SamparkSchoolView — the school without the test phone's ciphertext
 *         or hash, plus testPhoneLast4, liveDialAvailable and liveDialBlocker.
 *         The full test phone number is never returned.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   1 read (+1 DNS lookup when crm changes) + 1 write + 1–2 audit writes.
 * Done:   a PTM can reference a saved venue; a private CRM URL is refused 400;
 *         a landline or demo number is refused as a test phone.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, guardOrgRoute, parseBody, samparkContext } from '@/server/sampark/http';
import { getSchoolOrThrow, schoolView, updateSchool, UpdateSchoolSchema } from '@/server/sampark/school';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    try {
        return NextResponse.json(schoolView(await getSchoolOrThrow(await samparkContext(), guard.orgId)));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_SCHOOL');
    }
}

export async function PUT(req: NextRequest, { params }: Params) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const body = await parseBody(req, UpdateSchoolSchema);
    if ('response' in body) return body.response;
    try {
        return NextResponse.json(schoolView(await updateSchool(await samparkContext(), guard.orgId, guard.uid, body.data)));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_SCHOOL');
    }
}
