
import { getDb } from '../src/lib/firebase-admin';

async function verifyData() {
    console.log("Verifying Firestore Data for user-123...");
    const db = await getDb();
    const snapshot = await db.collection('users').doc('user-123').collection('content').orderBy('createdAt', 'desc').limit(5).get();

    if (snapshot.empty) {
        console.log("No content found for user-123.");
        return;
    }

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`\nID: ${doc.id}`);
        console.log(`Type: ${data.type}`);
        console.log(`Title: ${data.title}`);
        console.log(`Has Data Field? ${!!data.data}`);
        if (data.data) {
            console.log(`Data Keys: ${Object.keys(data.data).join(', ')}`);
            // Preview data (truncate if long)
            const json = JSON.stringify(data.data).substring(0, 200);
            console.log(`Data Preview: ${json}...`);
        } else {
            console.error("❌ DATA FIELD MISSING!");
        }
    });
}

verifyData().catch(console.error);
