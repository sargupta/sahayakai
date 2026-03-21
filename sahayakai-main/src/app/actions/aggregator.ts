import { getDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { calculateHealthScore, TeacherAnalytics } from "@/lib/analytics/impact-score";

export async function aggregateUserMetrics(uid: string) {
    const db = await getDb();
    logger.info(`Refreshing metrics for user`, 'AGGREGATOR', { userId: uid });

    // 1. Fetch User Data
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return;
    const userData = userDoc.data() || {};

    // 2. Fetch Content (Private)
    const privateSnapshot = await db.collection('users').doc(uid).collection('content').limit(500).get();
    const privateResources = privateSnapshot.docs.map(doc => doc.data());

    // 3. Fetch Content (Public)
    const publicSnapshot = await db.collection('library_resources').where('authorId', '==', uid).limit(500).get();
    const publicResources = publicSnapshot.docs.map(doc => doc.data());

    // Deduplicate
    const privateIds = new Set(privateResources.map(r => r.id));
    const allResources = [...privateResources];
    publicResources.forEach(pr => {
        if (!privateIds.has(pr.id)) allResources.push(pr);
    });

    const resourceCount = allResources.length;
    const sharedCount = publicResources.length;

    // 4. Fetch Activity Logs for Last 7 days to fix content_created_last_7_days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentContentCount = allResources.filter(r => {
        const created = r.createdAt?.toDate?.() || new Date(r.createdAt);
        return created >= sevenDaysAgo;
    }).length;

    // 5. Fetch Existing Analytics for stateful metrics (sessions, etc.)
    const analyticsDoc = await db.collection('teacher_analytics').doc(uid).get();
    const existingAnalytics = analyticsDoc.data() || {};

    // Prepare TeacherAnalytics Input
    const analyticsInput: any = {
        ...existingAnalytics,
        user_id: uid,
        content_created_total: resourceCount,
        content_created_last_7_days: recentContentCount,
        shared_to_community_count: sharedCount,
        // Keep other fields like sessions_last_7_days from existing analytics
    };

    // Calculate standardized score
    const healthResult = calculateHealthScore(analyticsInput);
    const finalScore = healthResult.score;

    // Persist Harmonized Data
    await db.collection('teacher_analytics').doc(uid).set({
        ...analyticsInput,
        score: finalScore,
        lastUpdated: new Date().toISOString(),
    }, { merge: true });

    // Update User Profile cache (North Star metric)
    await db.collection('users').doc(uid).update({
        impactScore: finalScore
    });

    logger.info(`Metrics updated: score ${finalScore}, count ${resourceCount}`, 'AGGREGATOR', { userId: uid });

    return { score: finalScore, count: resourceCount };
}
