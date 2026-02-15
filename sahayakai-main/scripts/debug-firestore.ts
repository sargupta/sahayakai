import { getDb } from "../src/lib/firebase-admin";

async function checkCollections() {
    try {
        console.log("Checking Firestore collections...");
        const db = await getDb();
        const collections = ['users', 'library_resources', 'posts', 'connections'];

        for (const col of collections) {
            try {
                const snapshot = await db.collection(col).limit(1).get();
                console.log(`Collection: ${col} - Count in sample: ${snapshot.size}`);
            } catch (e: any) {
                console.warn(`Collection: ${col} - Error: ${e.message}`);
            }
        }
        console.log("Check complete.");
        process.exit(0);
    } catch (error: any) {
        console.error("Check failed:", error.message);
        process.exit(1);
    }
}

checkCollections();
