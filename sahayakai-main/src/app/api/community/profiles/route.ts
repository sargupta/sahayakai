/**
 * POST /api/community/profiles — batch public-profile lookup.
 * Body: { uids: string[] }. Returns the PII-stripped public allowlist only
 * (F2-01 / H6 — stripping happens in src/server/community.ts).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getProfiles } from '@/server/community';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
    uids: z.array(z.string().min(1).max(128)).max(50),
});

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        const profiles = await getProfiles(userId, parsed.data.uids);
        return NextResponse.json(profiles);
    } catch (err) {
        return errorResponse(err);
    }
}
