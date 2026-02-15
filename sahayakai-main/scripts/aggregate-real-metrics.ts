
import { getDb } from "../src/lib/firebase-admin";
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function aggregateRealMetrics() {
    console.log("--- Aggregating REAL Metrics (Quizzes + Streaks) ---");
    const db = await getDb();

    // Target User (dev-user & active user)
    const userIds = ["mcyD4zJGqZXiy3tt0vZJtoinVyE3", "dev-user", "me"];

    for (const uid of userIds) {
        console.log(`Aggregating for ${uid}...`);

        // 1. Fetch User Metadata (for Streak)
        const userDoc = await db.collection('users').doc(uid).get();
        let streakDays = 0;
        let lastActiveDate = new Date();

        if (userDoc.exists) {
            const userData = userDoc.data();
            const lastLogin = userData?.lastLogin; // Expected to be Timestamp or ISO string
            if (lastLogin) {
                // Simplified Streak Logic: If last login was within 24-48 hours, increment.
                // For MVP/Real Data compliance, we just check if active today.
                // A real streak system needs a dedicated 'streaks' collection or daily log.
                // We will default to 1 if active recently, 0 otherwise, unless a specific 'streak' field exists.
                streakDays = userData.streakDays || (userData.lastLogin ? 1 : 0);
            }
        }

        // 2. Count Real Resources (Total)
        const resourcesSnapshot = await db.collection('library_resources')
            .where('author.uid', '==', uid)
            .get(); // Fetching to filter in memory for 'quiz' type if simple count fails

        const realResourceCount = resourcesSnapshot.size;

        // 3. Count QUIZZES specifically
        const quizCount = resourcesSnapshot.docs.filter(doc => doc.data().type === 'quiz').length;

        // 4. Count Real Community Shares
        const realSharedCount = resourcesSnapshot.docs.filter(doc => doc.data().isPublic).length;

        // 5. Calculate Score based on REAL data
        // Logic: 10 points per resource, 5 bonus for quizzes
        const calculatedScore = Math.min((realResourceCount * 10) + (quizCount * 5), 100);

        // Logic: Activity Score (0-30)
        const activityScore = Math.min(realResourceCount * 5, 30);

        // Logic: Engagement Score (0-30) - based on sharing
        const engagementScore = Math.min(realSharedCount * 10, 30);

        console.log(`User ${uid}: Resources=${realResourceCount}, Quizzes=${quizCount}, Score=${calculatedScore}, Streak=${streakDays}`);

        // 6. Update Teacher Analytics with TRUTH
        await db.collection('teacher_analytics').doc(uid).set({
            userId: uid,
            score: calculatedScore,
            level: calculatedScore > 50 ? 'expert' : 'novice',
            risk_level: calculatedScore > 0 ? 'healthy' : 'at-risk',

            // Sub-scores
            activity_score: activityScore,
            engagement_score: engagementScore,
            success_score: 0, // Placeholder
            growth_score: 0,  // Placeholder

            // Raw Metrics
            total_students: 0,
            resources_created: realResourceCount,
            quiz_attempts: 0, // Pending: Need 'quiz_attempts' collection aggregation if it exists

            last_active: new Date().toISOString(),
            streak_days: streakDays,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }

    console.log("Real metrics aggregation complete.");
}

aggregateRealMetrics().catch(console.error);
