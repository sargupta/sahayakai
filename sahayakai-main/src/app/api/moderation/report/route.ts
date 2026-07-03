/**
 * POST /api/moderation/report — report content or a profile (moderation v1).
 *
 * Body: { targetType: message|post|profile|resource, targetId,
 *         reason: harassment|inappropriate|spam|other, freeText? (≤500) }
 *
 * Rate-limited to 10 reports/day per user (calendar-day IST, same
 * `rate_limits` pattern as image generation). Reports land in the
 * `reports` collection with status 'open'; clients can never read them
 * (admin review via Admin SDK only — see firestore.rules).
 *
 * Uses the community errorResponse mapper because it already carries the
 * 429 mapping for 'Rate limit exceeded…' messages.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
    reportContent,
    REPORT_TARGET_TYPES,
    REPORT_REASONS,
    REPORT_FREETEXT_MAX,
} from '@/server/moderation';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
    targetType: z.enum(REPORT_TARGET_TYPES),
    targetId: z.string().min(1).max(256),
    reason: z.enum(REPORT_REASONS),
    freeText: z.string().max(REPORT_FREETEXT_MAX).optional(),
});

export async function POST(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        const result = await reportContent(userId, parsed.data);
        return NextResponse.json(result);
    } catch (err) {
        return errorResponse(err);
    }
}
