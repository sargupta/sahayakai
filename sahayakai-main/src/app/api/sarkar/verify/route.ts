import { NextResponse } from 'next/server';

/**
 * POST /api/sarkar/verify
 *
 * Verify a government school teacher via UDISE code.
 * UDISE (Unified District Information System for Education) codes are
 * 11-digit school identification numbers assigned by MHRD.
 *
 * Phase 1: Basic format validation + store for manual verification.
 * Phase 2: Cross-reference with UDISE+ database API (when available).
 */
export async function POST(request: Request) {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { udiseCode, schoolName, district, state } = await request.json();

        if (!udiseCode || !schoolName) {
            return NextResponse.json({ error: 'UDISE code and school name required' }, { status: 400 });
        }

        // Validate UDISE format: 11 digits
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
            district: district || '',
            state: state || '',
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
