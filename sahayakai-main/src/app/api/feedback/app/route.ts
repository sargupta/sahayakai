/**
 * POST /api/feedback/app — app/page-level thumbs feedback (tranche 5
 * migration of src/app/actions/feedback.ts::submitFeedback).
 *
 * NOTE: distinct from POST /api/feedback (pre-existing per-content feedback
 * endpoint with a different schema).
 *
 * Auth parity with the action: the action was anonymous-friendly (uid stamped
 * only when present), so this route does NOT hard-require x-user-id itself.
 * In production the middleware already rejects tokenless /api/* calls with
 * 401 — same effective gate the action had via the page-mutation rule.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { submitFeedback } from '@/server/feedback';
import { logger } from '@/lib/logger';

const AppFeedbackSchema = z.object({
    page: z.string().max(300),
    feature: z.string().max(300),
    rating: z.enum(['thumbs-up', 'thumbs-down']),
    comment: z.string().max(2000).optional(),
    context: z.record(z.any()).optional(),
});

export async function POST(req: NextRequest) {
    const parsed = AppFeedbackSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ success: false, error: 'Invalid feedback payload' }, { status: 400 });
    }

    try {
        // Service validates the thumbs-down-needs-comment rule and stamps the
        // caller uid from the middleware headers when present.
        const result = await submitFeedback(parsed.data);
        return NextResponse.json(result);
    } catch (error) {
        logger.error('app-feedback route failed', error, 'FEEDBACK');
        return NextResponse.json({ success: false, error: 'Could not submit feedback.' }, { status: 500 });
    }
}
