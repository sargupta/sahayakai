
import { getDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";

export async function aggregateUserMetrics(uid: string) {
    const db = await getDb();
    logger.info(`Refreshing metrics for user`, 'AGGREGATOR', { userId: uid });

    // 1. Fetch User Data
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return;
    const userData = userDoc.data() || {};

    // 2. Fetch Content (Private)
    const privateSnapshot = await db.collection('users').doc(uid).collection('content').get();
    const privateResources = privateSnapshot.docs.map(doc => doc.data());

    // 3. Fetch Content (Public)
    const publicSnapshot = await db.collection('library_resources').where('authorId', '==', uid).get();
    const publicResources = publicSnapshot.docs.map(doc => doc.data());

    // Deduplicate
    const privateIds = new Set(privateResources.map(r => r.id));
    const allResources = [...privateResources];
    publicResources.forEach(pr => {
        if (!privateIds.has(pr.id)) allResources.push(pr);
    });

    const resourceCount = allResources.length;
    const quizCount = allResources.filter(r => r.type === 'quiz').length;
    const sharedCount = publicResources.length;

    // 4. Fetch Posts (Engagement)
    const postSnapshot = await db.collection('posts').where('authorId', '==', uid).get();
    const postCount = postSnapshot.size;

    // Truthful Scoring Logic
    // Logic: 10 pts/resource, 5 pts/quiz, 20 pts/share, 5 pts/post
    const calculatedScore = Math.min((resourceCount * 10) + (quizCount * 5) + (sharedCount * 20) + (postCount * 5), 100);

    // FIX (Bug #3): Write field names that match the TeacherAnalytics interface
    // consumed by GET /api/analytics/teacher-health/[userId]
    await db.collection('teacher_analytics').doc(uid).set({
        userId: uid,
        // Engagement fields (matched to TeacherAnalytics interface)
        content_created_total: resourceCount,
        shared_to_community_count: sharedCount,
        content_created_last_7_days: resourceCount, // Approximation; real-time route maintains exact 7-day window
        // Session/activity will be kept from real-time updates via /api/teacher-activity
        exported_content_count: postCount, // posts used as a proxy for export engagement
        last_active: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Legacy fields kept for compatibility
        score: calculatedScore,
        level: calculatedScore > 50 ? 'expert' : 'novice',
    }, { merge: true });

    // Update User Profile cache
    await db.collection('users').doc(uid).update({
        impactScore: calculatedScore
    });

    return { score: calculatedScore, count: resourceCount };
}
