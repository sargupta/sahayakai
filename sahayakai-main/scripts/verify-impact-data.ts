
import { getDb } from "../src/lib/firebase-admin";
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function verifyImpactData() {
    console.log("--- Verifying Impact Data ---");
    const db = await getDb();

    // Check dev-user specifically
    const userId = "dev-user";
    const ref = db.collection('teacher_analytics').doc(userId);
    const doc = await ref.get();

    if (!doc.exists) {
        console.error(`❌ FAILURE: Document 'teacher_analytics/${userId}' does NOT exist.`);
    } else {
        const data = doc.data();
        console.log(`✅ SUCCESS: Document found for '${userId}'.`);
        console.log("Data Snapshot:", JSON.stringify(data, null, 2));

        // Validate critical fields
        const required = ['score', 'activity_score', 'risk_level'];
        const missing = required.filter(f => data && data[f] === undefined);

        if (missing.length > 0) {
            console.error(`⚠️ WARNING: Missing fields: ${missing.join(', ')}`);
        } else {
            console.log("✅ Data Structure looks valid.");
        }
    }
}

verifyImpactData().catch(console.error);
