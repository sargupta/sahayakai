
import { getDb } from "../src/lib/firebase-admin";
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function purge() {
    console.log("🔥 STARTING DATABASE PURGE (ENFORCING REAL DATA COMPLIANCE) 🔥");
    const db = await getDb();
    const batchSize = 100;

    // 1. TARGETED COLLECTIONS
    const collections = ['library_resources', 'users', 'connections', 'posts', 'telemetry_events'];

    // Whitelisted User (Do NOT delete the main user)
    const whitelistedUids = [
        'mcyD4zJGqZXiy3tt0vZJtoinVyE3', // Abhishek Gupta (Owner)
        'dev-user'                      // Standard dev fallback
    ];

    for (const collectionName of collections) {
        console.log(`Checking ${collectionName}...`);
        const snapshot = await db.collection(collectionName).get();

        let deletedCount = 0;
        const batch = db.batch();

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const docId = doc.id;

            let shouldDelete = false;

            // Targeting logic
            if (collectionName === 'users') {
                if (!whitelistedUids.includes(docId) && !docId.startsWith('auth-')) {
                    // Delete fake teachers (Srujana, Ravi, Anjali etc)
                    shouldDelete = true;
                }
            } else if (collectionName === 'library_resources' || collectionName === 'posts') {
                const authorId = data.authorId || data.userId;
                if (!whitelistedUids.includes(authorId)) {
                    shouldDelete = true;
                }
            } else if (collectionName === 'connections') {
                // Connections involving fake users
                const { followerId, followingId } = data;
                if (!whitelistedUids.includes(followerId) || !whitelistedUids.includes(followingId)) {
                    shouldDelete = true;
                }
            } else {
                // General purge for telemetry/others to start fresh
                shouldDelete = true;
            }

            if (shouldDelete) {
                batch.delete(doc.ref);
                deletedCount++;
            }
        }

        if (deletedCount > 0) {
            await batch.commit();
            console.log(`✅ Deleted ${deletedCount} documents from ${collectionName}`);
        } else {
            console.log(`- No mock data found in ${collectionName}`);
        }
    }

    // 2. RESET ANALYTICS
    console.log("Resetting analytics scores...");
    const analyticsSnapshot = await db.collection('teacher_analytics').get();
    const analyticsBatch = db.batch();
    for (const doc of analyticsSnapshot.docs) {
        analyticsBatch.set(doc.ref, {
            total_resources: 0,
            quiz_attempts: 0,
            streak_days: 0,
            health_score: 0,
            updated_at: new Date().toISOString()
        }, { merge: true });
    }
    await analyticsBatch.commit();
    console.log("✅ Analytics reset to 0-state.");

    console.log("🎯 PURGE COMPLETE. PLATFORM IS NOW ORGANIC-ONLY.");
}

purge().catch(console.error);
