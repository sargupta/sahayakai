/**
 * POST /api/profile/checklist — mark one onboarding checklist item complete
 * (tranche 5 migration of
 * src/app/actions/profile.ts::markChecklistItemAction). Best-effort UX
 * tracking; Firestore failures are swallowed by the service (warn only).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { markChecklistItemAction } from '@/server/profile';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

const ChecklistSchema = z.object({
    // Compat: legacy positional `_userId` — service rejects on mismatch.
    uid: z.string().min(1),
    itemId: z.string().min(1).max(64),
});

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    const parsed = ChecklistSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid checklist item id' }, { status: 400 });
    }

    try {
        await markChecklistItemAction(parsed.data.uid, parsed.data.itemId);
        return NextResponse.json({ success: true });
    } catch (error) {
        return errorResponse(error, 'PROFILE');
    }
}
