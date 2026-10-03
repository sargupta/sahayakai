/**
 * POST /api/sampark/[orgId]/pages/[id]/acknowledge — a page has been seen and acted on.
 *
 * Input:  none.
 * Output: the acknowledged Page.
 * Auth:   x-user-id (401) + the class's teacher or the principal / org admin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   3 reads, 1 write.
 * Done:   404 PAGE_NOT_FOUND.
 */

import type { NextRequest } from 'next/server';

import { DocIdSchema } from '@/server/sampark/http';
import { acknowledgePage } from '@/server/sampark/proposals';
import { runStaff } from '@/server/sampark/proposals-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
    const p = await params;
    return runStaff(req, p.orgId, 'SAMPARK_PAGE_ACK', ({ ctx, orgId, uid, isOrgAdmin }) =>
        acknowledgePage(ctx, orgId, DocIdSchema.parse(p.id), { uid, isOrgAdmin }),
    );
}
