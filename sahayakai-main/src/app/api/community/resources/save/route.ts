/**
 * POST /api/community/resources/save — save a community resource into the
 * caller's personal library. Body: { resource: {...} }. Saver is ALWAYS the
 * authenticated uid; idempotent under concurrency (F5-003, enforced in
 * src/server/community.ts). Returns { alreadySaved }.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { saveResourceToLibrary } from '@/server/community';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
    resource: z.object({
        id: z.string().min(1).max(128),
        title: z.string().min(1).max(512),
        type: z.string().min(1).max(64),
        authorId: z.string().max(128),
        language: z.string().max(64),
        gradeLevel: z.string().max(64).optional(),
        subject: z.string().max(128).optional(),
    }),
});

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        const result = await saveResourceToLibrary(userId, parsed.data.resource);
        return NextResponse.json(result);
    } catch (err) {
        return errorResponse(err);
    }
}
