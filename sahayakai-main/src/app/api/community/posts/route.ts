/**
 * /api/community/posts
 *   GET  — list public posts (filters: limit, gradeLevels, subjects, language)
 *   POST — create a post. Author is ALWAYS the authenticated uid (x-user-id);
 *          the body carries no identity. Content/imageUrl caps (Wave 3)
 *          enforced in src/server/community.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createPost, getPosts } from '@/server/community';
import { errorResponse } from '@/server/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = req.nextUrl.searchParams;
    const QuerySchema = z.object({
        limit: z.coerce.number().int().min(1).max(100).optional(),
        language: z.string().max(64).optional(),
        gradeLevels: z.array(z.string().max(64)).max(10).optional(),
        subjects: z.array(z.string().max(64)).max(10).optional(),
    });
    const parsed = QuerySchema.safeParse({
        limit: sp.get('limit') ?? undefined,
        language: sp.get('language') ?? undefined,
        gradeLevels: sp.getAll('gradeLevels').length ? sp.getAll('gradeLevels') : undefined,
        subjects: sp.getAll('subjects').length ? sp.getAll('subjects') : undefined,
    });
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    try {
        const posts = await getPosts(userId, parsed.data);
        return NextResponse.json(posts);
    } catch (err) {
        return errorResponse(err);
    }
}

const CreatePostSchema = z.object({
    content: z.string(),
    visibility: z.string().optional(),
    imageUrl: z.string().optional(),
    gradeLevel: z.string().max(64).optional(),
    subject: z.string().max(128).optional(),
});

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = CreatePostSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    try {
        const { content, visibility, imageUrl, gradeLevel, subject } = parsed.data;
        const id = await createPost(userId, content, visibility ?? 'public', imageUrl, gradeLevel, subject);
        return NextResponse.json({ id });
    } catch (err) {
        return errorResponse(err);
    }
}
