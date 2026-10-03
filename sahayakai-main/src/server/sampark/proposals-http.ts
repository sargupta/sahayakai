/**
 * Shell for the slice-2 routes (rules, roles, proposals, pages, backtest).
 *
 * Two kinds of caller, both behind SAMPARK_ENABLED (404 first) and x-user-id (401):
 *   admin routes  (adopt/withdraw rules, grant roles, backtest, dry runs)  → org admin only (403)
 *   staff routes  (proposal queue, approve/dismiss, A2 tap, pages)         → org admin OR anyone
 *                  holding a Sampark role; what each person may DECIDE is the
 *                  role module's call (canApprove), enforced again in the service.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { createRestSourceForSchool } from '@/lib/sampark/crm/rest-source';
import { getSamparkRepo, getSamparkClock } from '@/lib/sampark/repo/factory';
import { getSamparkRulesRepo } from '@/lib/sampark/rules/factory';
import { CrmSignalsSchema } from '@/lib/sampark/rules/signals';
import { createRestSignalsSource, createStaticSignalsSource, type SignalsLoad } from '@/lib/sampark/rules/signals-source';
import { RULE_IDS } from '@/lib/sampark/rules/types';
import type { SamparkSchool } from '@/types/sampark';
import { requireOrgAdmin } from '@/server/sampark/auth';
import { conflict } from '@/server/sampark/errors';
import { OrgIdSchema, errorResponse, guardOrgRoute, invalidRequest, samparkDisabledResponse } from '@/server/sampark/http';
import type { ProposalCtx } from '@/server/sampark/proposals';

export async function signalsForSchool(school: SamparkSchool): Promise<SignalsLoad> {
    // Development only: a CRM-less demo school can read a fixture file of signals (never in production).
    const fixture = process.env.SAMPARK_SIGNALS_FIXTURE;
    const hasRestCrm = !!school.crm && school.crm.kind === 'rest' && !!school.crm.baseUrl;
    if (fixture && process.env.NODE_ENV !== 'production' && !hasRestCrm) {
        const fs = await import('node:fs/promises');
        const parsed = CrmSignalsSchema.parse(JSON.parse(await fs.readFile(fixture, 'utf8')));
        return createStaticSignalsSource(parsed).load();
    }
    if (!hasRestCrm) {
        throw conflict('NO_REST_CRM', 'Connect a REST CRM in Settings first: the rules read attendance, the holistic card and assessments from it.');
    }
    return createRestSignalsSource(await createRestSourceForSchool(school)).load();
}

export async function proposalContext(): Promise<ProposalCtx> {
    return { repo: await getSamparkRepo(), rules: await getSamparkRulesRepo(), clock: getSamparkClock(), loadSignals: signalsForSchool };
}

export type StaffGuard = { uid: string; orgId: string; isOrgAdmin: boolean } | { response: NextResponse };

async function baseGuard(req: Request, rawOrgId: string | undefined): Promise<{ uid: string; orgId: string } | { response: NextResponse }> {
    const disabled = samparkDisabledResponse();
    if (disabled) return { response: disabled };
    const uid = req.headers.get('x-user-id');
    if (!uid) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    const org = OrgIdSchema.safeParse(rawOrgId);
    if (!org.success) return { response: invalidRequest(org.error) };
    return { uid, orgId: org.data };
}

/** Org admins and anyone holding a Sampark role. */
export async function guardStaffRoute(req: Request, rawOrgId: string | undefined): Promise<StaffGuard> {
    const base = await baseGuard(req, rawOrgId);
    if ('response' in base) return base;
    try {
        if (await requireOrgAdmin(base.orgId, base.uid)) return { ...base, isOrgAdmin: true };
        const rules = await getSamparkRulesRepo();
        const mine = (await rules.listRoleAssignments(base.orgId)).filter((a) => a.uid === base.uid);
        if (mine.length > 0) return { ...base, isOrgAdmin: false };
    } catch (err) {
        logger.error('Sampark staff check failed', err, 'SAMPARK_API', { orgId: base.orgId });
        return { response: NextResponse.json({ error: 'Internal server error' }, { status: 500 }) };
    }
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
}

// ── Bodies ──────────────────────────────────────────────────────────────────

export const SectionSchema = z.object({ grade: z.number().int().min(1).max(12), section: z.string().regex(/^[A-Za-z]$/) }).strict();

export const AdoptBodySchema = z
    .object({ thresholds: z.record(z.string(), z.unknown()), adopterName: z.string().trim().min(1).max(120), acknowledged: z.literal(true) })
    .strict();

export const RoleBodySchema = z
    .object({
        uid: z.string().trim().min(1).max(128),
        role: z.enum(['principal', 'coordinator', 'class_teacher', 'accounts', 'transport', 'office', 'counsellor']),
        sections: z.array(SectionSchema).max(40),
        displayName: z.string().trim().max(120).default(''),
    })
    .strict();

export const RevokeBodySchema = z.object({ uid: z.string().min(1).max(128), role: z.string().min(1).max(40) }).strict();

export const BacktestBodySchema = z
    .object({
        weeks: z.number().int().min(1).max(20).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        thresholds: z.record(z.enum(RULE_IDS), z.record(z.string(), z.unknown())).optional(),
    })
    .strict();

export const DecisionBodySchema = z.object({ note: z.string().trim().max(500).nullable().optional() }).strict();
export const ProposalStatusSchema = z.enum(['pending', 'approved', 'dismissed', 'handled_by_person', 'needs_attention', 'expired']);

// ── Route runners (order of checks identical everywhere, tested once) ───────

export interface AdminCall {
    uid: string;
    orgId: string;
    ctx: ProposalCtx;
}
export interface StaffCall extends AdminCall {
    isOrgAdmin: boolean;
}

/** Org-admin route: 404 → 401 → 400 → 403, then `fn`. */
export async function runAdmin(req: Request, rawOrgId: string | undefined, context: string, fn: (c: AdminCall) => Promise<unknown>): Promise<NextResponse> {
    const guard = await guardOrgRoute(req, rawOrgId);
    if ('response' in guard) return guard.response;
    try {
        return NextResponse.json(await fn({ uid: guard.uid, orgId: guard.orgId, ctx: await proposalContext() }));
    } catch (err) {
        return errorResponse(err, context);
    }
}

/** Staff route (org admin or any role holder). */
export async function runStaff(req: Request, rawOrgId: string | undefined, context: string, fn: (c: StaffCall) => Promise<unknown>): Promise<NextResponse> {
    const guard = await guardStaffRoute(req, rawOrgId);
    if ('response' in guard) return guard.response;
    try {
        return NextResponse.json(await fn({ uid: guard.uid, orgId: guard.orgId, isOrgAdmin: guard.isOrgAdmin, ctx: await proposalContext() }));
    } catch (err) {
        return errorResponse(err, context);
    }
}
