/**
 * GET /api/organizations/[orgId]/analytics?window=7d
 *
 * Returns aggregated school-level analytics for the principal dashboard.
 * Caller must be the org admin, verified against server-managed data only:
 * the org doc's adminUserId or an admin role in the org's members
 * subcollection. User-editable profile fields are never trusted for authz.
 *
 * Response shape: OrgAnalyticsOutput from src/lib/analytics/org-aggregator.ts
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { aggregateOrgAnalytics, type OrgMemberSummary } from '@/lib/analytics/org-aggregator';
import type { TeacherAnalytics } from '@/lib/analytics/impact-score';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ orgId: string }> },
) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { orgId } = await params;
        const windowParam = req.nextUrl.searchParams.get('window') ?? '7d';
        const windowDays = windowParam === '14d' ? 14 : windowParam === '30d' ? 30 : 7;

        const db = await getDb();

        // 1. Load org + verify user is the admin for this specific org
        const orgRef = db.collection('organizations').doc(orgId);
        const orgDoc = await orgRef.get();
        if (!orgDoc.exists) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }
        const orgData = orgDoc.data() as {
            name?: string;
            totalSeats?: number;
            isDemoData?: boolean;
            adminUserId?: string;
        };

        // Role gate — SERVER-TRUST ONLY. Authorize on data that a user cannot
        // self-assign: the org's adminUserId, or an admin membership doc in
        // THIS org's members subcollection (written exclusively by Admin-SDK
        // org code). We deliberately do NOT trust profile.administrativeRole /
        // profile.organizationId here — those are user-editable and previously
        // allowed any user to read any school's analytics by self-asserting
        // { administrativeRole:'principal', organizationId:<victimOrg> }.
        let isOrgAdmin = orgData.adminUserId === userId;
        if (!isOrgAdmin) {
            const memberDoc = await orgRef.collection('members').doc(userId).get();
            const memberRole = memberDoc.exists
                ? (memberDoc.data() as { role?: string }).role
                : undefined;
            isOrgAdmin = memberRole === 'admin';
        }
        if (!isOrgAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Load members subcollection
        const membersSnap = await orgRef.collection('members').get();
        const members: OrgMemberSummary[] = [];
        for (const doc of membersSnap.docs) {
            const data = doc.data() as { userId?: string; role?: string };
            if (!data.userId) continue;
            if (data.role === 'admin') continue; // analytics cover teachers only
            members.push({ userId: data.userId });
        }

        // 3. Batch-read teacher_analytics + user-profile display names
        // db.getAll() takes up to 500 DocumentRefs per call; schools are <500 teachers so one batch suffices.
        const analyticsByUserId: Record<string, TeacherAnalytics | null> = {};
        const memberDisplayNames: Record<string, string | undefined> = {};
        const memberRoles: Record<string, string | undefined> = {};

        if (members.length > 0) {
            const analyticsRefs = members.map(m => db.collection('teacher_analytics').doc(m.userId));
            const userRefs = members.map(m => db.collection('users').doc(m.userId));
            const [analyticsSnaps, userSnaps] = await Promise.all([
                db.getAll(...analyticsRefs),
                db.getAll(...userRefs),
            ]);
            for (let i = 0; i < members.length; i++) {
                const uid = members[i].userId;
                const a = analyticsSnaps[i];
                analyticsByUserId[uid] = a.exists ? (a.data() as TeacherAnalytics) : null;
                const u = userSnaps[i];
                if (u.exists) {
                    const ud = u.data() as { displayName?: string; name?: string; administrativeRole?: string };
                    memberDisplayNames[uid] = ud.displayName ?? ud.name;
                    memberRoles[uid] = ud.administrativeRole;
                }
            }
        }

        // Enrich members with displayName/role
        for (const m of members) {
            m.displayName = memberDisplayNames[m.userId];
            m.administrativeRole = memberRoles[m.userId];
        }

        // 4. Aggregate
        const output = aggregateOrgAnalytics({
            orgId,
            orgName: orgData.name ?? 'School',
            totalSeats: orgData.totalSeats ?? members.length,
            isDemoData: orgData.isDemoData ?? false,
            members,
            analyticsByUserId,
            windowDays,
        });

        return NextResponse.json(output);
    } catch (error) {
        logger.error('Failed to aggregate org analytics', error, 'ORG_ANALYTICS');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
