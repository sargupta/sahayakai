/**
 * API Route: GET /api/analytics/teacher-health/[userId]
 *
 * Returns teacher's health score and engagement metrics.
 *
 * SCORING MODEL v3 (2026-05-20) — transparent sum composite.
 *   H = activity (0-30) + engagement (0-30) + success (0-20) + growth (0-20)
 *
 * Behavior:
 *   - Cold-start (no doc OR is_cold_start flag): runs the SAME calculator
 *     on the (possibly empty) input so the breakdown is structurally
 *     identical to the warm path — no second formula, no inconsistency.
 *   - Stale data (lastUpdated > 1 hour OR ?refresh=1): triggers
 *     aggregateUserMetrics inline so the user sees fresh numbers.
 *   - Defensive reads: all numeric fields are coerced through `safeNumber`
 *     inside `calculateHealthScore`; the API does NOT trust persisted
 *     sub-scores. They are always recomputed from raw fields.
 *
 * Fail-soft: a backend error returns a cold-start neutral payload so the
 * dashboard renders SOMETHING instead of erroring out. The dashboard
 * component still surfaces an inline "Showing last good values" hint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { calculateHealthScore, type TeacherAnalytics } from '@/lib/analytics/impact-score';
import { aggregateUserMetrics } from '@/lib/aggregator';
import { isAdmin } from '@/lib/auth-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ONE_HOUR_MS = 60 * 60 * 1000;

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    let resolvedUserId: string | undefined;
    try {
        // Auth gate: must be signed in; must be the same user OR an admin.
        const callerUid = req.headers.get('x-user-id');
        if (!callerUid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { userId } = await params;
        resolvedUserId = userId;

        if (!userId) {
            return NextResponse.json({ error: 'userId required' }, { status: 400 });
        }

        if (callerUid !== userId) {
            const admin = await isAdmin(callerUid);
            if (!admin) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const explicitRefresh = req.nextUrl.searchParams.get('refresh') === '1';

        const db = await getDb();
        const analyticsRef = db.collection('teacher_analytics').doc(userId);
        let analyticsDoc = await analyticsRef.get();

        // Stale-check: auto-refresh if older than 1 hour OR forced
        let needsRefresh = explicitRefresh;
        if (!needsRefresh && analyticsDoc.exists) {
            const data = analyticsDoc.data() ?? {};
            const lastUpdatedStr = typeof data.lastUpdated === 'string' ? data.lastUpdated : null;
            if (!lastUpdatedStr) {
                needsRefresh = true;
            } else {
                const ts = new Date(lastUpdatedStr).getTime();
                if (!Number.isFinite(ts) || (Date.now() - ts) > ONE_HOUR_MS) {
                    needsRefresh = true;
                }
            }
        } else if (!analyticsDoc.exists) {
            // Trigger an initial aggregation for users who have a `users` doc
            // but no analytics yet — common right after first login.
            needsRefresh = true;
        }

        if (needsRefresh) {
            try {
                await aggregateUserMetrics(userId);
                analyticsDoc = await analyticsRef.get(); // re-fetch fresh
            } catch (refreshErr) {
                logger.warn(
                    'Aggregator failed during teacher-health fetch, falling back to stale data',
                    'ANALYTICS',
                    { userId, error: String(refreshErr) }
                );
            }
        }

        let analyticsInput: any = { user_id: userId };
        let lastUpdated: string | null = null;

        if (analyticsDoc.exists) {
            const data = analyticsDoc.data() ?? {};
            analyticsInput = { ...data, user_id: userId };
            lastUpdated = typeof data.lastUpdated === 'string' ? data.lastUpdated : null;
        }
        // else: cold start — calculator handles all defaults

        const healthScore = calculateHealthScore(analyticsInput);

        return NextResponse.json({
            ...healthScore,
            lastUpdated,
        });
    } catch (error) {
        logger.error(
            'Failed to fetch teacher health score',
            error,
            'ANALYTICS',
            { userId: resolvedUserId ?? 'unknown' }
        );
        // Fail-soft: return cold-start neutral payload
        const fallback = calculateHealthScore({ user_id: resolvedUserId ?? 'unknown' });
        return NextResponse.json({
            ...fallback,
            lastUpdated: null,
            error: 'temporary',
        });
    }
}
