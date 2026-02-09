
import * as fs from 'fs';
import * as path from 'path';
import * as admin from 'firebase-admin';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// 1. Manually Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    console.log(`Loading env from ${envPath}`);
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)='?(.+?)'?$/);
        if (match) {
            const key = match[1];
            let value = match[2];
            // Handle multiline JSON if meaningful
            if (value.startsWith('{') && !value.endsWith('}')) {
                // naive handling, but for single line JSON string in env it works
            }
            process.env[key] = value;
        }
    });

    // Quick fix for the multiline key if it was split
    // Actually, .env.local usually has the key as a single line string
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.startsWith("'")) {
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.slice(1, -1);
    }
}

async function verifyDownloadFix() {
    console.log('🔍 Starting Standalone End-to-End Download Verification...');

    try {
        // 2. Initialize Firebase Admin
        if (!admin.apps.length) {
            let serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

            // If checking from .env reading above failed to capture the full JSON
            // We might need a better parser or just hardcode for this test if feasible 
            // BUT: The .env.local view showed it spanning multiple lines. My simple parser is weak.
            // Let's rely on the file content directly for the key.

            const fileContent = fs.readFileSync(envPath, 'utf8');
            const keyMatch = fileContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY='([\s\S]+?)'\n/);
            if (keyMatch) {
                serviceAccount = keyMatch[1];
            }

            if (!serviceAccount) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY");

            admin.initializeApp({
                credential: admin.credential.cert(JSON.parse(serviceAccount)),
                storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
            });
            console.log('✅ Firebase Admin Initialized');
        }

        const db = getFirestore();
        const storage = getStorage();

        // 3. Get a Real User
        console.log('1️⃣  Fetching a user context...');
        const usersSnap = await db.collection('users').limit(1).get();
        if (usersSnap.empty) {
            console.error('❌ No users found in DB. Cannot verify.');
            return;
        }
        const userId = usersSnap.docs[0].id;
        console.log(`✅ Found User: ${userId}`);

        // 4. Get Real Content (Replicating logic)
        console.log('2️⃣  Fetching latest content item...');
        const contentSnap = await db
            .collection('users')
            .doc(userId)
            .collection('content')
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        const contentList = contentSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const validContent = contentList.find(c => c.storagePath);

        if (!validContent) {
            console.warn('⚠️ User has content, but none with "storagePath".');
            console.log('   (The fix works for NEW content. Checking if any content exists...)');
            // List titles
            const titles = contentList.map(c => c.title || c.topic).join(', ');
            console.log(`   Found items: ${titles}`);
            return;
        }
        console.log(`✅ Found Content: "${validContent.title}" (ID: ${validContent.id})`);
        console.log(`   Storage Path: ${validContent.storagePath}`);

        // 5. Verify Storage File
        console.log('3️⃣  Verifying file in Firebase Storage...');
        const bucket = storage.bucket();
        const file = bucket.file(validContent.storagePath!);
        const [exists] = await file.exists();

        if (!exists) {
            console.error('❌ CRITICAL: File missing from storage bucket!');
            console.error(`   Expected at: ${validContent.storagePath}`);
            return;
        }
        console.log('✅ File exists in Storage bucket.');

        // 6. Generate Signed URL (Mimicking API Logic)
        console.log('4️⃣  Generating Signed URL...');
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000,
        });
        console.log('✅ Generated Signed URL.'); // Do not print full URL to keep logs clean

        // 7. Test Fetch
        console.log('5️⃣  Testing URL Reachability...');
        const response = await fetch(url);

        if (response.ok) {
            const size = response.headers.get('content-length');
            const type = response.headers.get('content-type');
            console.log(`✅ SUCCESS! Download Verified.`);
            console.log(`   - Status: ${response.status}`);
            console.log(`   - Content-Type: ${type}`);
            console.log(`   - Size: ${size ? (parseInt(size) / 1024).toFixed(2) + ' KB' : 'Unknown'}`);

        } else {
            console.error(`❌ Fetch Failed: ${response.status} ${response.statusText}`);
        }

    } catch (error: any) {
        console.error('🔥 Verification Script Failed:', error.message);
        if (error.stack) console.error(error.stack);
    }
}

verifyDownloadFix();
