import { NextResponse } from 'next/server';
import { removeTeacher } from '@/lib/organization';

/** POST /api/organizations/remove — Remove a teacher from the org */
export async function POST(request: Request) {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { orgId, teacherId } = await request.json();
        if (!orgId || !teacherId) {
            return NextResponse.json({ error: 'Missing orgId or teacherId' }, { status: 400 });
        }

        // Verify caller is admin
        const { getDb } = await import('@/lib/firebase-admin');
        const db = await getDb();
        const memberDoc = await db.collection('organizations').doc(orgId).collection('members').doc(userId).get();
        if (!memberDoc.exists || memberDoc.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Only org admins can remove members' }, { status: 403 });
        }

        await removeTeacher(orgId, teacherId);
        return NextResponse.json({ status: 'removed' });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Remove failed' },
            { status: 500 }
        );
    }
}
