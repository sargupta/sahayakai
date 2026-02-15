
import { getDb } from "../src/lib/firebase-admin";
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function fixUserConnections() {
    console.log("--- Fixing User Connections ---");
    const db = await getDb();

    // 1. Get Target Teachers (Content Creators)
    const teachers = ['teacher-srujana', 'teacher-ravi'];

    // 2. Get Test Users (Potential Viewers)
    const usersSnap = await db.collection('users').get();
    const viewers = usersSnap.docs
        .map(doc => doc.id)
        .filter(uid => !teachers.includes(uid) && !uid.startsWith('test-'));

    console.log(`Found ${viewers.length} potential viewers:`, viewers);

    // 3. Create Connections
    for (const viewerId of viewers) {
        for (const teacherId of teachers) {
            const connectionId = `${viewerId}_${teacherId}`;
            const ref = db.collection('connections').doc(connectionId);
            const doc = await ref.get();

            if (!doc.exists) {
                console.log(`Connecting ${viewerId} -> ${teacherId}`);
                await ref.set({
                    followerId: viewerId,
                    followingId: teacherId,
                    createdAt: new Date().toISOString(),
                    isSeeded: true
                });
            } else {
                console.log(`Connection exists: ${viewerId} -> ${teacherId}`);
            }
        }
    }
    console.log("Connections updated.");
}

fixUserConnections().catch(console.error);
