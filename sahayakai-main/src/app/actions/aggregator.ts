import { getDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { calculateHealthScore, TeacherAnalytics } from "@/lib/analytics/impact-score";

/**
 * Refresh the persisted impact score and all sub-scores for a single user.
 *
 * Persists EVERY sub-score so the dashboard breakdown matches the headline
 * composite (fixed 2026-05-20). Returns null if the user doc is missing.
 *
 * Idempotent: safe to call on every dashboard load. Uses `merge: true` so
 * unrelated fields on the teacher_analytics doc are never clobbered.
 */
export async function aggregateUserMetrics(uid: string) {
    if (!uid) {
        logger.warn('aggregateUserMetrics called with empty uid', 'AGGREGATOR');
        return null;
    }

    const db = await getDb();
    logger.info(`Refreshing metrics for user`, 'AGGREGATOR', { userId: uid });

    try {
        // 1. Fetch User Data — guard cold-start users with no doc
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            logger.info('User doc missing, skipping aggregation', 'AGGREGATOR', { userId: uid });
            return null;
        }
        const userData = userDoc.data() || {};

        // 2. Fetch Content (Private)
        const privateSnapshot = await db
            .collection('users').doc(uid).collection('content')
            .limit(500).get();
        const privateResources = privateSnapshot.docs.map(doc => doc.data());

        // 3. Fetch Content (Public)
        const publicSnapshot = await db
            .collection('library_resources').where('authorId', '==', uid)
            .limit(500).get();
        const publicResources = publicSnapshot.docs.map(doc => doc.data());

        // Deduplicate — a resource may exist in both private and public collections
        const privateIds = new Set(privateResources.map(r => r.id));
        const allResources = [...privateResources];
        publicResources.forEach(pr => {
            if (!privateIds.has(pr.id)) allResources.push(pr);
        });

        const resourceCount = allResources.length;
        const sharedCount = publicResources.length;

        // 4. Recent content (last 7 days) — defensive timestamp parsing
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        let recentContentCount = 0;
        let priorWindowContentCount = 0;
        for (const r of allResources) {
            try {
                const created = r.createdAt?.toDate?.() || (r.createdAt ? new Date(r.createdAt) : null);
                if (!created || isNaN(created.getTime())) continue;
                if (created >= sevenDaysAgo) recentContentCount++;
                else if (created >= fourteenDaysAgo) priorWindowContentCount++;
            } catch {
                // Bad createdAt — skip, don't crash the aggregator
                continue;
            }
        }

        // 5. Fetch Existing Analytics for stateful metrics (sessions, etc.)
        const analyticsDoc = await db.collection('teacher_analytics').doc(uid).get();
        const existingAnalytics = analyticsDoc.data() || {};

        // 6. days_since_signup from user createdAt (used for cold-start detection)
        let days_since_signup = Number(existingAnalytics.days_since_signup ?? 0);
        try {
            const createdAt = userData.createdAt?.toDate?.() || (userData.createdAt ? new Date(userData.createdAt) : null);
            if (createdAt && !isNaN(createdAt.getTime())) {
                const diffMs = Date.now() - createdAt.getTime();
                days_since_signup = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
            }
        } catch {
            // ignore
        }

        // Prepare TeacherAnalytics Input — merge fresh observations with stored
        const analyticsInput: any = {
            ...existingAnalytics,
            user_id: uid,
            content_created_total: resourceCount,
            content_created_last_7_days: recentContentCount,
            content_created_days_8_to_14: priorWindowContentCount,
            shared_to_community_count: sharedCount,
            days_since_signup,
        };

        // Calculate standardized score (uses the v3 transparent-sum formula)
        const healthResult = calculateHealthScore(analyticsInput);

        // Persist Harmonized Data — including all 4 user-facing sub-scores
        // PLUS community_score (org-only) and the new `level` field. This
        // keeps the dashboard breakdown consistent with the headline composite
        // (otherwise legacy sub-scores from earlier aggregation runs linger
        // and the math visibly fails to add up).
        // See: dashboard discrepancy fix 2026-05-20.
        await db.collection('teacher_analytics').doc(uid).set({
            ...analyticsInput,
            score: healthResult.score,
            level: healthResult.level,
            risk_level: healthResult.risk_level,
            activity_score: healthResult.activity_score,
            engagement_score: healthResult.engagement_score,
            success_score: healthResult.success_score,
            growth_score: healthResult.growth_score,
            community_score: healthResult.community_score,
            estimated_students_impacted: healthResult.estimated_students_impacted,
            is_cold_start: healthResult.is_cold_start,
            lastUpdated: new Date().toISOString(),
        }, { merge: true });

        // Update User Profile cache (North Star metric)
        await db.collection('users').doc(uid).update({
            impactScore: healthResult.score
        });

        logger.info(
            `Metrics updated: score ${healthResult.score}, count ${resourceCount}`,
            'AGGREGATOR',
            { userId: uid }
        );

        return { score: healthResult.score, count: resourceCount, level: healthResult.level };
    } catch (err) {
        logger.error('aggregateUserMetrics failed', err, 'AGGREGATOR', { userId: uid });
        return null;
    }
}
