import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/firebase-admin';
import { aggregateOrgAnalytics, type OrgMemberSummary } from '@/lib/analytics/org-aggregator';
import type { TeacherAnalytics } from '@/lib/analytics/impact-score';
import { DashboardClient } from './dashboard-client';
import { EmptyStateDashboard } from './components/empty-state';

export const dynamic = 'force-dynamic';

const PRINCIPAL_ROLES = ['principal', 'vice_principal'] as const;

/**
 * Principal dashboard.
 *
 * Server component: resolves auth + role, loads organisation + teacher
 * analytics, aggregates, passes props to the DashboardClient. Role guard
 * redirects non-principals to `/`.
 */
export default async function OrganizationDashboardPage() {
    const h = await headers();
    const userId = h.get('x-user-id');
    if (!userId) redirect('/');

    const db = await getDb();

    // 1. Resolve user profile, confirm principal role + get orgId
    const userDoc = await db.collection('users').doc(userId).get();
    const profile = userDoc.data() as {
        organizationId?: string;
        administrativeRole?: string;
        displayName?: string;
    } | undefined;

    const role = profile?.administrativeRole;
    const isPrincipal = !!role && PRINCIPAL_ROLES.includes(role as typeof PRINCIPAL_ROLES[number]);
    if (!isPrincipal) redirect('/');

    const orgId = profile?.organizationId;
    if (!orgId) {
        // Principal without an org: render an empty state with an invite-first CTA.
        return <EmptyStateDashboard reason="no-org" principalName={profile?.displayName} />;
    }

    // 2. Load org doc
    const orgRef = db.collection('organizations').doc(orgId);
    const orgDoc = await orgRef.get();
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
