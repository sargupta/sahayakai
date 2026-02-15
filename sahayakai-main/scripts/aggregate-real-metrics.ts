
import { getDb } from "../src/lib/firebase-admin";
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function aggregateRealMetrics() {
    console.log("--- Aggregating REAL Metrics (Universal across all Teachers) ---");
    const db = await getDb();

    // 1. Fetch ALL users who have been active
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} total users.`);

    for (const userDoc of usersSnapshot.docs) {
        const uid = userDoc.id;
        const userData = userDoc.data();

        // Skip purely anonymous or incomplete profiles if needed, 
        // but for impact, any user with content counts.
        console.log(`Aggregating for ${userData.displayName || uid}...`);

        // 1. Fetch User Metadata (for Streak)
        let streakDays = userData.streakDays || (userData.lastLogin ? 1 : 0);

        // 2. Fetch PRIVATE content from subcollection
        const privateSnapshot = await db.collection('users').doc(uid).collection('content').get();
        const privateResources = privateSnapshot.docs.map(doc => doc.data());

        // 3. Fetch PUBLIC content from global library_resources
        // Note: Field name verified as 'authorId' or 'author.uid' depending on seeder.
        // We check 'authorId' as per community.ts
        const publicSnapshot = await db.collection('library_resources').where('authorId', '==', uid).get();
        const publicResources = publicSnapshot.docs.map(doc => doc.data());

        // Merge and deduplicate if necessary, but usually they are distinct records
        const allResources = [...privateResources];

        // Add public resources only if they aren't already represented in the private list (by ID)
        const privateIds = new Set(privateResources.map(r => r.id));
        publicResources.forEach(pr => {
            if (!privateIds.has(pr.id)) allResources.push(pr);
        });

        const realResourceCount = allResources.length;

        // 4. Count QUIZZES specifically
        const quizCount = allResources.filter(r => r.type === 'quiz').length;

        // 5. Count REAL Community Shares
        const realSharedCount = publicResources.length;

        // 6. Calculate Score (Truthful)
        // Logic: 10 points per resource, 5 bonus for quizzes, 20 for sharing
        const calculatedScore = Math.min((realResourceCount * 10) + (quizCount * 5) + (realSharedCount * 20), 100);

        const activityScore = Math.min(realResourceCount * 5, 40);
        const engagementScore = Math.min(realSharedCount * 15, 60);

        if (realResourceCount > 0) {
            console.log(`-> User ${uid}: Resources=${realResourceCount}, Shared=${realSharedCount}, Score=${calculatedScore}`);

            // 7. Update Teacher Analytics with TRUTH
            await db.collection('teacher_analytics').doc(uid).set({
                userId: uid,
                score: calculatedScore,
                level: calculatedScore > 50 ? 'expert' : 'novice',
                risk_level: 'healthy',

                // Sub-scores
                activity_score: activityScore,
                engagement_score: engagementScore,
                success_score: 10, // Default for real users
                growth_score: 5,   // Default for real users

                // Raw Metrics
                resources_created: realResourceCount,
                shared_resources: realSharedCount,
                quiz_attempts: 0,

                last_active: new Date().toISOString(),
                streak_days: streakDays,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            // Also update the user document with the impact score for quick access
            await db.collection('users').doc(uid).update({
                impactScore: calculatedScore
            });
        }
    }

    console.log("Real metrics aggregation complete.");
}

aggregateRealMetrics().catch(console.error);
