/**
 * The shared shell every Sampark route runs through, so the order of checks
 * is identical everywhere and tested once:
 *
 *   1. SAMPARK_ENABLED !== 'true'  → 404  (FIRST, before auth: a disabled
 *                                          deployment reveals nothing)
 *   2. no x-user-id                 → 401  (middleware sets it after verifying
 *                                          the Firebase token; /api/sampark is
 *                                          not a public prefix)
 *   3. orgId param malformed        → 400
 *   4. not an org admin             → 403  (requireOrgAdmin)
 *
 * Job routes use samparkDisabledResponse() + requireCronAuth instead of 2–4.
 */

import { NextResponse } from 'next/server';
import { z, type ZodTypeAny } from 'zod';

import { logger } from '@/lib/logger';
import type { Clock, SamparkRepo } from '@/lib/sampark/ports';
import { getSamparkClock, getSamparkRepo } from '@/lib/sampark/repo/factory';
import { requireOrgAdmin } from '@/server/sampark/auth';
import { SamparkServiceError } from '@/server/sampark/errors';

export interface SamparkCtx {
    repo: SamparkRepo;
    clock: Clock;
}

export async function samparkContext(): Promise<SamparkCtx> {
    return { repo: await getSamparkRepo(), clock: getSamparkClock() };
}

/** 404 unless Sampark is switched on for this deployment. */
export function samparkDisabledResponse(): NextResponse | null {
    if (process.env.SAMPARK_ENABLED === 'true') return null;
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export const OrgIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, 'invalid orgId');
export const DocIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, 'invalid id');

function firstIssue(err: z.ZodError): string {
    const issue = err.issues[0];
    if (!issue) return 'invalid request';
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
}

export function invalidRequest(err: z.ZodError): NextResponse {
    return NextResponse.json({ error: 'INVALID_REQUEST', message: firstIssue(err) }, { status: 400 });
}

/** Parse a JSON body with a schema; returns the data or a 400 response. */
export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<{ data: z.infer<S> } | { response: NextResponse }> {
    const raw = await req.json().catch(() => undefined);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return { response: invalidRequest(parsed.error) };
    return { data: parsed.data };
}

export type OrgGuard = { uid: string; orgId: string } | { response: NextResponse };

/** Steps 1–4 for every /api/sampark/[orgId]/… route. */
export async function guardOrgRoute(req: Request, rawOrgId: string | undefined): Promise<OrgGuard> {
    const disabled = samparkDisabledResponse();
    if (disabled) return { response: disabled };
    const uid = req.headers.get('x-user-id');
    if (!uid) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    const org = OrgIdSchema.safeParse(rawOrgId);
    if (!org.success) return { response: invalidRequest(org.error) };
    let allowed = false;
    try {
        allowed = await requireOrgAdmin(org.data, uid);
    } catch (err) {
        logger.error('Sampark org-admin check failed', err, 'SAMPARK_API', { orgId: org.data });
        return { response: NextResponse.json({ error: 'Internal server error' }, { status: 500 }) };
    }
    if (!allowed) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    return { uid, orgId: org.data };
}

/** Map a thrown error to a response. Known service errors keep their status. */
export function errorResponse(err: unknown, context: string): NextResponse {
    if (err instanceof SamparkServiceError) {
        return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
    }
    if (err instanceof z.ZodError) return invalidRequest(err);
    logger.error('Sampark route failed', err, context);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
