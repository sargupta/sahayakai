const admin = require('firebase-admin');
const fs = require('fs');

// 1. Manually extract the service account from .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY='(\{.*?\})'/s);

if (!match || !match[1]) {
    console.error("Could not extract FIREBASE_SERVICE_ACCOUNT_KEY from .env.local");
    process.exit(1);
}

let serviceAccount;
try {
    serviceAccount = JSON.parse(match[1]);
} catch (e) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:", e.message);
    process.exit(1);
}

// 2. Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// 3. Delete all documents in video_cache collection
async function flushCache() {
    console.log('Connecting to production Firestore to flush corrupted video_cache...');

    const cacheRef = db.collection('video_cache');
    const snapshot = await cacheRef.get();

    if (snapshot.empty) {
        console.log('No cached videos found. Cache is already empty.');
        process.exit(0);
    }

    console.log(`Found ${snapshot.size} corrupted cache entries. Nuking them...`);

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        console.log(`  -> Deleting doc ID: ${doc.id}`);
        batch.delete(doc.ref);
    });

    await batch.commit();
    console.log('🔥 Cache successfully flushed! Application will now pull verified videos from the new RSS engine.');
    process.exit(0);
}

flushCache().catch(e => {
    console.error(e);
    process.exit(1);
});
