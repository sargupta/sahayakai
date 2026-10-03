/**
 * GET /api/sampark/[orgId]/pages?status= — pages to the class teacher and principal from a same-day absence call
 * (the parent pressed 2, or nobody answered). A page is a task for a person, not a call.
 *
 * Input:  optional ?status=open|acknowledged.
 * Output: { pages: Page[] }.
 * Auth:   x-user-id (401) + org admin or any Sampark role holder (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   1 read.
 * Done:   —
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { listPages } from '@/server/sampark/proposals';
import { runStaff } from '@/server/sampark/proposals-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const p = await params;
    return runStaff(req, p.orgId, 'SAMPARK_PAGES', async ({ ctx, orgId }) => {
        const raw = new URL(req.url).searchParams.get('status');
        const status = raw ? z.enum(['open', 'acknowledged']).parse(raw) : undefined;
        return { pages: await listPages(ctx, orgId, status) };
    });
}
