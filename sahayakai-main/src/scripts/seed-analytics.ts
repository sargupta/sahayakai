
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (adjust path to service account if needed, or rely on env)
if (!admin.apps.length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
        : require('../../service-account.json'); // Fallback for local run if env not set

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = getFirestore();

async function seedAnalytics(userId: string) {
    console.log(`Seeding analytics for user: ${userId}...`);

    const healthRef = db.collection('teacher_analytics').doc(userId);

    // Create meaningful demo data
    const demoData = {
        last_active: admin.firestore.FieldValue.serverTimestamp(),
        days_since_last_use: 0,
        total_attempts: 42,
        sessions_last_7_days: 5,
        content_created_last_7_days: 12,
        content_created_total: 85,
        successful_generations: 82,
        features_used_last_30_days: ['lesson-plan', 'quiz-generator', 'visual-aid', 'doubt-solver'],

        // These fields might be calculated by the API on read, but setting them here ensures data exists
        // The API route logic:
        // score = activity + engagement + success + growth
        // Let's rely on the API to calculate the score if the raw stats are there, 
        // BUT the dashboard might be reading raw stats OR headers. 
        // Let's look at the component... 
        // The component fetches from /api/analytics/teacher-health/[userId]
        // That API calculates the score dynamically based on these fields.
        // So we just need to seed the raw counters.
    };

    await healthRef.set(demoData, { merge: true });

    // Also seed some daily history for the graph if we ever add one
    const today = new Date().toISOString().split('T')[0];
    await db.doc(`users/${userId}/analytics/${today}`).set({
        events: {
            session_start: 2,
            content_created: 3,
            feature_use: 15
        },
        totalEvents: 20
    }, { merge: true });

    console.log('✅ Analytics seeded successfully!');
}

// Default to 'dev-user' if no argument provided
const targetUser = process.argv[2] || 'dev-user';
seedAnalytics(targetUser).catch(console.error);
