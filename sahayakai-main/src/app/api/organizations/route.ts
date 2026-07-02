import { NextResponse } from 'next/server';
import { createOrganization, getOrganizationWithMembers } from '@/lib/organization';
import { isAdmin } from '@/lib/auth-utils';

/**
 * POST /api/organizations — Create a new organization (admin-only).
 *
 * SECURITY: ADMIN-ONLY (F7-001). A self-service path would let any signed-in
 * free user mint themselves premium with 500 seats by picking plan=premium
 * — `createOrganization` flips `users.planType` + Firebase custom claim, so
 * the caller would be silently upgraded without payment. Real customers
 * upgrade through the Razorpay flow; the webhook (HMAC-verified) does the
 * plan flip. Sales-touched orgs are provisioned here by SahayakAI admins.
 *
 * GET /api/organizations — Get the user's organization details (any signed-in user).
 */
export async function POST(request: Request) {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Admin-only gate — prevents free-user privilege escalation (F7-001).
    const callerIsAdmin = await isAdmin(userId);
    if (!callerIsAdmin) {
        return NextResponse.json(
            { error: 'Forbidden. Organization plans must be provisioned by SahayakAI sales. Contact contact@sargvision.com.' },
            { status: 403 }
        );
    }

    try {
        const { name, type, plan, totalSeats, adminUserId, razorpayPaymentId } = await request.json();

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

        // Admin may provision an org for another user (sales-assisted). Default to self.
        const adminUid = (typeof adminUserId === 'string' && adminUserId.length > 0) ? adminUserId : userId;

        const orgId = await createOrganization({
            name,
            type,
            adminUserId: adminUid,
            plan,
            totalSeats,
            // Only flip the user's planType + custom claim if a payment
            // reference is provided AND createOrganization verifies it as
            // 'captured' against Razorpay (H21). Otherwise the org doc is
            // created but the plan is flipped by the webhook on payment.captured.
            grantPlanToAdmin: typeof razorpayPaymentId === 'string' && razorpayPaymentId.length > 0,
            razorpayPaymentId: typeof razorpayPaymentId === 'string' ? razorpayPaymentId : undefined,
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
