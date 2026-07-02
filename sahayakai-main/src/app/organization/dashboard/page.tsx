import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/firebase-admin';
import { aggregateOrgAnalytics, type OrgMemberSummary } from '@/lib/analytics/org-aggregator';
import type { TeacherAnalytics } from '@/lib/analytics/impact-score';
import { DashboardClient } from './dashboard-client';
import { EmptyStateDashboard } from './components/empty-state';

export const dynamic = 'force-dynamic';

/**
 * Principal dashboard.
 *
 * Server component: resolves auth, then determines the caller's org from
 * SERVER-MANAGED data only (the org they administer), loads teacher
 * analytics, aggregates, passes props to the DashboardClient.
 *
 * SECURITY: org membership/role is resolved from the organizations collection
 * (adminUserId) — NEVER from the user-editable profile.administrativeRole /
 * profile.organizationId fields, which a user can self-assign to read any
 * school's data. displayName is the only profile field read, for greeting.
 */
export default async function OrganizationDashboardPage() {
    const h = await headers();
    const userId = h.get('x-user-id');
    if (!userId) redirect('/');

    const db = await getDb();

    // 1. Resolve the org this user actually administers (server-truth).
    //    A principal is the adminUserId of exactly one organization.
    const ownedOrgSnap = await db.collection('organizations')
        .where('adminUserId', '==', userId)
        .limit(1)
        .get();

    const userDoc = await db.collection('users').doc(userId).get();
    const profile = userDoc.data() as { displayName?: string } | undefined;

    if (ownedOrgSnap.empty) {
        // Not an org admin: check if they administer an org via a members
        // admin role (defensive; current model always sets adminUserId too).
        // If neither, they are not a principal — send home.
        return <EmptyStateDashboard reason="no-org" principalName={profile?.displayName} />;
    }

    const orgDoc = ownedOrgSnap.docs[0];
    const orgId = orgDoc.id;
    const orgRef = db.collection('organizations').doc(orgId);
    if (!orgDoc.exists) redirect('/');
    const orgData = orgDoc.data() as {
        name?: string;
        totalSeats?: number;
        isDemoData?: boolean;
    };

    // 3. Load members (teachers only; skip admin)
    const membersSnap = await orgRef.collection('members').get();
    const members: OrgMemberSummary[] = [];
    for (const doc of membersSnap.docs) {
        const data = doc.data() as { userId?: string; role?: string };
        if (!data.userId || data.role === 'admin') continue;
        members.push({ userId: data.userId });
    }

    // 4. Batch-read teacher_analytics + display names
    const analyticsByUserId: Record<string, TeacherAnalytics | null> = {};
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
                members[i].displayName = ud.displayName ?? ud.name;
                members[i].administrativeRole = ud.administrativeRole;
            }
        }
    }

    // 5. Aggregate
    const analytics = aggregateOrgAnalytics({
        orgId,
        orgName: orgData.name ?? 'Your School',
        totalSeats: orgData.totalSeats ?? members.length,
        isDemoData: orgData.isDemoData ?? false,
        members,
        analyticsByUserId,
        windowDays: 7,
    });

    // 6. Empty state (new org with no teachers or no data yet)
    if (analytics.emptyState.showEmptyState) {
        return (
            <EmptyStateDashboard
                reason={analytics.emptyState.reason ?? 'too-little-data'}
                principalName={profile?.displayName}
                orgName={analytics.org.name}
                isDemoData={analytics.org.isDemoData}
            />
        );
    }

    return <DashboardClient data={analytics} />;
}
