import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * POST /api/sarkar/verify
 *
 * Verify a government school teacher via UDISE code.
 * UDISE (Unified District Information System for Education) codes are
 * 11-digit school identification numbers assigned by MHRD.
 *
 * Phase 1: Basic format validation + store for manual verification.
 * Phase 2: Cross-reference with UDISE+ database API (when available).
 *
 * F3-003 fix: added max-length bounds on schoolName/district/state and
 * tightened UDISE handling via Zod. The existing 11-digit format check
 * is preserved.
 */

const VerifySchema = z.object({
    udiseCode: z.string().min(11).max(20),
    schoolName: z.string().min(1).max(120),
    district: z.string().max(80).optional().default(''),
    state: z.string().max(80).optional().default(''),
});

export async function POST(request: Request) {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        let raw: unknown;
        try {
            raw = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const parsed = VerifySchema.safeParse(raw);
        if (!parsed.success) {
            // Preserve the original 400 message when the basic required-field
            // problem is the issue, so callers/tests stay happy.
            const flat = parsed.error.flatten();
            const missing =
                flat.fieldErrors.udiseCode?.length || flat.fieldErrors.schoolName?.length;
            if (missing) {
                return NextResponse.json(
                    { error: 'UDISE code and school name required', issues: flat },
                    { status: 400 },
                );
            }
            return NextResponse.json(
                { error: 'Invalid verification payload', issues: flat },
                { status: 400 },
            );
        }

        const { udiseCode, schoolName, district, state } = parsed.data;

        // Validate UDISE format: 11 digits (whitespace allowed in input)
        const cleaned = udiseCode.replace(/\s/g, '');
        if (!/^\d{11}$/.test(cleaned)) {
            return NextResponse.json({
                error: 'Invalid UDISE code. Must be 11 digits.',
            }, { status: 400 });
        }

        const { getDb } = await import('@/lib/firebase-admin');
        const db = await getDb();

        // Check if already verified
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.data()?.sarkarVerified) {
            return NextResponse.json({ status: 'already_verified' });
        }

        // Store verification request
        await db.collection('sarkar_verifications').doc(userId).set({
            userId,
            udiseCode: cleaned,
            schoolName,
            district,
            state,
            status: 'pending', // pending → verified | rejected
            submittedAt: new Date(),
        });

        // Update user profile with pending status
        await db.collection('users').doc(userId).update({
            sarkarUdiseCode: cleaned,
            verifiedStatus: 'pending',
            updatedAt: new Date(),
        });

        return NextResponse.json({
            status: 'pending',
            message: 'Your verification is being processed. You will be notified once verified.',
        });
    } catch (error) {
        console.error('[Sarkar] Verification failed:', error);
        return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
    }
}
