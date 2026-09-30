/**
 * PATCH /api/sampark/[orgId]/guardians/[guardianId]/preferences — the office
 * records a family's language or consent (plan §4④, §6).
 *
 * Input:  { language?: ParentLanguage | null, consent?: Partial<Record<ConsentGroup,
 *         'granted'|'denied'|'unknown'>> } — at least one field.
 * Output: GuardianPreferences. Changed consent groups are stamped source
 *         'office' with the time; a later CRM import never overwrites them.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   2 reads + 1 write + 1 audit write.
 * Done:   the guardian's row shows the new language/consent; the audit log names the editor.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { PreferencesPatchSchema, updateGuardianPreferences } from '@/server/sampark/guardians';
import { DocIdSchema, errorResponse, guardOrgRoute, invalidRequest, parseBody, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string; guardianId: string }> }) {
    const p = await params;
    const guard = await guardOrgRoute(req, p.orgId);
    if ('response' in guard) return guard.response;
    const guardianId = DocIdSchema.safeParse(p.guardianId);
    if (!guardianId.success) return invalidRequest(guardianId.error);
    const body = await parseBody(req, PreferencesPatchSchema);
    if ('response' in body) return body.response;
    try {
        const prefs = await updateGuardianPreferences(await samparkContext(), guard.orgId, guardianId.data, guard.uid, body.data);
        return NextResponse.json(prefs);
    } catch (err) {
        return errorResponse(err, 'SAMPARK_PREFERENCES');
    }
}
