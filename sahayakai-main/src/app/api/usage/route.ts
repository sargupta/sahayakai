import { NextResponse } from 'next/server';
import { getUserUsageSummary } from '@/lib/usage-counters';
import { normalizePlan } from '@/lib/plan-utils';
import { PLAN_CONFIG } from '@/lib/plan-config';

/**
 * GET /api/usage — returns the current user's usage summary for the month.
 * Used by the client-side useSubscription() hook to display progress bars.
 */
export async function GET(request: Request) {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const plan = normalizePlan(request.headers.get('x-user-plan'));
    const config = PLAN_CONFIG[plan];

    const usage = await getUserUsageSummary(userId, plan);

    return NextResponse.json({
        plan,
        canExport: config.canExport,
        canViewDetailedAnalytics: config.canViewDetailedAnalytics,
        canAccessAbsenceRecords: config.canAccessAbsenceRecords,
        canUseParentMessaging: config.canUseParentMessaging,
        model: config.model,
        usage,
    });
}
