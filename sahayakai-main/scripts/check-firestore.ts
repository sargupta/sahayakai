
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Manual env loading since we are running standalone
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

async function verifyData() {
    console.log("Verifying Firestore Data for user-123 (Standalone Mode)...");

    // Manual Init
    if (!admin.apps.length) {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY");
        }
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
    }

    const db = admin.firestore();
    const snapshot = await db.collection('users').doc('user-123').collection('content').orderBy('createdAt', 'desc').get();

    if (snapshot.empty) {
        console.log("No content found for user-123.");
        return;
    }

    let visualAidCount = 0;
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.type === 'visual-aid') visualAidCount++;

        console.log(`\nID: ${doc.id}`);
        console.log(`Type: ${data.type}`);
        console.log(`Title: ${data.title}`);
        console.log(`Has Data Field? ${!!data.data}`);
        if (data.data) {
            // Preview data (truncate if long)
            const json = JSON.stringify(data.data).substring(0, 100);
            console.log(`Data Preview: ${json}...`);
        } else {
            console.error("❌ DATA FIELD MISSING!");
        }
    });
    console.log(`\nTotal Visual Aids found: ${visualAidCount}`);
}

verifyData().catch(console.error);
