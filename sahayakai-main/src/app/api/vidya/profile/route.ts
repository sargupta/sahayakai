import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

/**
 * VIDYA Teacher Profile Sync
 *
 * GET  /api/vidya/profile  — read the jarvis sub-object from the user's Firestore doc
 * POST /api/vidya/profile  — upsert the jarvis sub-object (merge, never overwrites other fields)
 *
 * Auth: middleware verifies the Firebase ID token and injects x-user-id.
 *
 * F3-002 fix: the previous version persisted an arbitrary `profile` object,
 * which let a caller smuggle unrelated fields under `users/{uid}.jarvis`.
 * We now validate with an explicit Zod schema and reject unknown keys.
 */

const JarvisProfileSchema = z.object({
    // Mirrors `TeacherProfile` in src/store/jarvisStore.ts.
    preferredGrade: z.string().max(40).nullable().optional(),
    preferredSubject: z.string().max(80).nullable().optional(),
    preferredLanguage: z.string().max(40).nullable().optional(),
    preferredBoard: z.string().max(40).nullable().optional(),
    schoolContext: z.string().max(500).nullable().optional(),
    lastActiveAt: z.number().int().nonnegative().nullable().optional(),
}).strict();

export async function GET(request: NextRequest) {
    const uid = request.headers.get('x-user-id');
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const db = await getDb();
        const doc = await db.collection('users').doc(uid).get();
        if (!doc.exists) return NextResponse.json({ profile: null });

        const data = doc.data()!;
        return NextResponse.json({ profile: data.jarvis ?? null });
    } catch (error) {
        logger.error('Failed to fetch VIDYA profile', error, 'VIDYA');
        return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const uid = request.headers.get('x-user-id');
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'profile object required' }, { status: 400 });
        }

        const profileRaw = (body as { profile?: unknown }).profile;
        if (!profileRaw || typeof profileRaw !== 'object' || Array.isArray(profileRaw)) {
            return NextResponse.json({ error: 'profile object required' }, { status: 400 });
        }

        const parsed = JarvisProfileSchema.safeParse(profileRaw);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid profile payload', issues: parsed.error.flatten() },
                { status: 400 },
            );
        }

        // Drop undefined/null — Firestore rejects undefined and we treat
        // null the same way to keep the merge semantics intuitive.
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(parsed.data)) {
            if (v !== undefined && v !== null) clean[k] = v;
        }

        const db = await getDb();
        // merge: true ensures we never overwrite unrelated user profile fields
        await db.collection('users').doc(uid).set({ jarvis: clean }, { merge: true });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Failed to save VIDYA profile', error, 'VIDYA');
        return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
    }
}
