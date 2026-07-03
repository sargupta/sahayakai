/**
 * /api/lesson-plan/cache
 *
 * GET  ?topic=&grade=&language= — shared community-cache lookup
 *      (was getCachedLessonPlan action)
 * POST { plan, topic, grade, language } — save to the shared cache
 *      (was saveLessonPlanToCache action)
 *
 * Wave 1 gates preserved: both verbs require an authenticated caller —
 * GET to rate-limit anonymous cache scraping, POST to prevent anonymous
 * poisoning of the SHARED cache. PII detection + graceful-failure semantics
 * live in src/server/lesson-plan.ts.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCachedLessonPlan, saveLessonPlanToCache } from '@/server/lesson-plan';

const GetQuerySchema = z.object({
    topic: z.string().min(1),
    grade: z.string().min(1),
    language: z.string().min(1),
});

const SaveSchema = z.object({
    // The plan itself is AI-flow output; the action performed no runtime
    // validation of its shape, and the shared-cache trust model (authed
    // users only) is unchanged.
    plan: z.record(z.string(), z.unknown()),
    topic: z.string().min(1),
    grade: z.string().min(1),
    language: z.string().min(1),
});

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const parsed = GetQuerySchema.safeParse({
        topic: searchParams.get('topic'),
        grade: searchParams.get('grade'),
        language: searchParams.get('language'),
    });
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const plan = await getCachedLessonPlan(parsed.data.topic, parsed.data.grade, parsed.data.language);
    return NextResponse.json(plan); // null on miss/error — client falls back to AI
}

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = SaveSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    await saveLessonPlanToCache(
        parsed.data.plan as any,
        parsed.data.topic,
        parsed.data.grade,
        parsed.data.language,
    );
    return NextResponse.json({ success: true }); // best-effort, never throws
}
