import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

/**
 * VIDYA Teacher Profile Sync
 *
 * GET  /api/vidya/profile  — read the jarvis sub-object from the user's Firestore doc
 * POST /api/vidya/profile  — upsert the jarvis sub-object (merge, never overwrites other fields)
 *
 * Auth: middleware verifies the Firebase ID token and injects x-user-id.
 */

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
        const body = await request.json();
        const { profile } = body;

        if (!profile || typeof profile !== 'object') {
            return NextResponse.json({ error: 'profile object required' }, { status: 400 });
        }

        // Strip undefined values — Firestore rejects them
        const clean: Record<string, any> = {};
        for (const [k, v] of Object.entries(profile)) {
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
