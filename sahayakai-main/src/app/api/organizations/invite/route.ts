import { NextResponse } from 'next/server';
import { inviteTeacher } from '@/lib/organization';

/** POST /api/organizations/invite — Invite a teacher by phone number */
export async function POST(request: Request) {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { orgId, phone } = await request.json();
        if (!orgId || !phone) {
            return NextResponse.json({ error: 'Missing orgId or phone' }, { status: 400 });
        }

        // Verify caller is admin of this org
        const { getDb } = await import('@/lib/firebase-admin');
        const db = await getDb();
        const memberDoc = await db.collection('organizations').doc(orgId).collection('members').doc(userId).get();
        if (!memberDoc.exists || memberDoc.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Only org admins can invite' }, { status: 403 });
        }

        const inviteId = await inviteTeacher(orgId, phone, userId);
        return NextResponse.json({ inviteId });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Invite failed' },
            { status: 500 }
        );
    }
}
