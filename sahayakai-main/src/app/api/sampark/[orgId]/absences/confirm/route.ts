/**
 * POST /api/sampark/[orgId]/absences/confirm — A2: the class teacher confirms, once for the class for today, that no
 * message about today's unexplained absences came through the diary or class group. The tap IS the approval: the
 * same-day absence proposals for that class are created approved and their intents set up. Without it, nothing is
 * proposed. A parent's keypress later never writes attendance or leave; key 2 or no answer pages the class teacher
 * and the principal.
 *
 * Input:  { grade, section }.
 * Output: { confirmed: boolean (false on a second tap), summary: RunSummary }.
 * Auth:   x-user-id (401) + that class's teacher, or the principal / org admin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   one CRM signals pull plus the writes of a rules run.
 * Done:   409 RULE_NOT_ADOPTED until the school adopts the same-day absence rule.
 */

import type { NextRequest } from 'next/server';

import { confirmClassAbsences } from '@/server/sampark/proposals';
import { SectionSchema, runStaff } from '@/server/sampark/proposals-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const p = await params;
    return runStaff(req, p.orgId, 'SAMPARK_ABSENCE_CONFIRM', async ({ ctx, orgId, uid, isOrgAdmin }) => {
        const body = SectionSchema.parse(await req.json().catch(() => undefined));
        return confirmClassAbsences(ctx, orgId, body, { uid, isOrgAdmin });
    });
}
