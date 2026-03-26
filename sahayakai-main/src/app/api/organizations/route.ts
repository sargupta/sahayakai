import { NextResponse } from 'next/server';
import { createOrganization, getOrganizationWithMembers } from '@/lib/organization';

/**
 * POST /api/organizations — Create a new organization (school admin)
 * GET /api/organizations — Get the user's organization details
 */
export async function POST(request: Request) {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { name, type, plan, totalSeats } = await request.json();

        if (!name || !type || !plan || !totalSeats) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate plan and type against allowed values (prevent privilege escalation)
        const ALLOWED_TYPES = ['school', 'chain', 'government'];
        const ALLOWED_PLANS = ['gold', 'premium'];
        if (!ALLOWED_TYPES.includes(type)) {
            return NextResponse.json({ error: 'Invalid organization type' }, { status: 400 });
        }
        if (!ALLOWED_PLANS.includes(plan)) {
            return NextResponse.json({ error: 'Invalid plan. Contact sales for organization plans.' }, { status: 400 });
        }
        if (typeof totalSeats !== 'number' || totalSeats < 1 || totalSeats > 500) {
            return NextResponse.json({ error: 'Seats must be between 1 and 500' }, { status: 400 });
        }

        const orgId = await createOrganization({
            name,
            type,
            adminUserId: userId,
            plan,
            totalSeats,
        });

        return NextResponse.json({ orgId });
    } catch (error) {
        console.error('[Org] Create failed:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create organization' },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // Get user's org ID from profile
        const { getDb } = await import('@/lib/firebase-admin');
        const db = await getDb();
        const userDoc = await db.collection('users').doc(userId).get();
        const orgId = userDoc.data()?.organizationId;

        if (!orgId) {
            return NextResponse.json({ organization: null });
        }

        const org = await getOrganizationWithMembers(orgId);
        return NextResponse.json({ organization: org });
    } catch (error) {
        console.error('[Org] Get failed:', error);
        return NextResponse.json({ error: 'Failed to get organization' }, { status: 500 });
    }
}
