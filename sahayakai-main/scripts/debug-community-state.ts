
import { getDb } from "../src/lib/firebase-admin";
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function debugCommunityState() {
    console.log("--- Debugging Community State ---");
    const db = await getDb();

    // 1. Check Users (Auth Context)
    console.log("\n[1] Checking Users...");
    const usersSnap = await db.collection('users').get();
    if (usersSnap.empty) {
        console.log("No users found.");
    } else {
        usersSnap.docs.forEach(doc => {
            console.log(`User: ${doc.id} - ${doc.data().displayName} (${doc.data().email})`);
        });
    }

    // 2. Check Connections (Following Logic)
    console.log("\n[2] Checking Connections...");
    const connectionsSnap = await db.collection('connections').get();
    if (connectionsSnap.empty) {
        console.log("No connections found.");
    } else {
        connectionsSnap.docs.forEach(doc => {
            const data = doc.data();
            console.log(`Connection: ${doc.id} | Follower: ${data.followerId} -> Following: ${data.followingId}`);

            // Validate Logic for non-existent users
            const followerExists = usersSnap.docs.some(u => u.id === data.followerId);
            if (!followerExists) console.warn(`  Warning: Follower ID ${data.followerId} not found in users!`);

            const followingExists = usersSnap.docs.some(u => u.id === data.followingId);
            if (!followingExists) console.warn(`  Warning: Following ID ${data.followingId} not found in users!`);
        });
    }

    // 3. Check Library Resources (Trending Logic)
    console.log("\n[3] Checking Library Resources (Trending)...");
    const resourcesSnap = await db.collection('library_resources').get();
    if (resourcesSnap.empty) {
        console.log("No library resources found.");
    } else {
        console.log(`Found ${resourcesSnap.size} total resources.`);
        let documentCount = 0;

        resourcesSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.type === 'document') documentCount++;

            // Sample Log
            if (resourcesSnap.size < 20 || Math.random() < 0.1) {
                console.log(`Resource: ${doc.id} | Title: "${data.title}" | Author: ${data.authorId} | Type: ${data.type}`);
            }
        });
        console.log(`Summary: ${documentCount} 'document' types (should be hidden in public feeds).`);
    }
}

debugCommunityState().catch(console.error);
