
import { getDb } from "@/lib/firebase-admin";

export async function aggregateUserMetrics(uid: string) {
    const db = await getDb();
    console.log(`[Aggregator] Refreshing metrics for user: ${uid}`);

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
    const activityScore = Math.min(resourceCount * 5, 40);
    const engagementScore = Math.min((sharedCount * 15) + (postCount * 5), 60);

    // Update Analytics
    await db.collection('teacher_analytics').doc(uid).set({
        userId: uid,
        score: calculatedScore,
        level: calculatedScore > 50 ? 'expert' : 'novice',
        resources_created: resourceCount,
        shared_resources: sharedCount,
        last_active: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }, { merge: true });

    // Update User Profile cache
    await db.collection('users').doc(uid).update({
        impactScore: calculatedScore
    });

    return { score: calculatedScore, count: resourceCount };
}
