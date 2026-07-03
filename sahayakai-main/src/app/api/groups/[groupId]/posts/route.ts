/**
 * /api/groups/[groupId]/posts
 *   GET  — group posts (members only; Phase-1 membership gate via
 *          requireGroupMember in src/server/groups.ts → 403 for non-members).
 *   POST — create a post (members only, rate-limited; author identity/name
 *          derive from the authenticated uid server-side).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createGroupPost, getGroupPosts } from '@/server/groups';
import { errorResponse } from '@/server/api-response';
import type { PostType } from '@/types/community';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx { params: Promise<{ groupId: string }> }

const QuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    startAfter: z.string().max(128).optional(),
});

export async function GET(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { groupId } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    const parsed = QuerySchema.safeParse({
        limit: sp.get('limit') ?? undefined,
        startAfter: sp.get('startAfter') ?? undefined,
    });
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    try {
        const posts = await getGroupPosts(userId, groupId, parsed.data.limit ?? 20, parsed.data.startAfter);
        return NextResponse.json(posts);
    } catch (err) {
        return errorResponse(err);
    }
}

const CreateSchema = z.object({
    content: z.string(),
    postType: z.enum(['share', 'ask_help', 'celebrate', 'resource']),
    attachments: z.array(z.object({
        type: z.string().max(64),
        url: z.string().max(2048).optional(),
        title: z.string().max(512).optional(),
        resourceId: z.string().max(128).optional(),
    }).passthrough()).max(5).optional(),
});

export async function POST(req: NextRequest, ctx: Ctx) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { groupId } = await ctx.params;
    const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        const id = await createGroupPost(
            userId,
            groupId,
            parsed.data.content,
            parsed.data.postType as PostType,
            (parsed.data.attachments ?? []) as any,
        );
        return NextResponse.json({ id });
    } catch (err) {
        return errorResponse(err);
    }
}
