import { getDb } from "../src/lib/firebase-admin";

async function debugRecommendations() {
    try {
        const db = await getDb();
        console.log("Analyzing Teacher Profiles for Recommendations...");

        const snapshot = await db.collection('users').limit(10).get();

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log(`--- User: ${data.displayName || 'Unnamed'} (${doc.id}) ---`);
            console.log(`School: ${data.schoolName || 'MISSING'}`);
            console.log(`Subjects: ${data.subjects ? data.subjects.join(', ') : 'MISSING'}`);
            console.log(`Grades: ${data.gradeLevels ? data.gradeLevels.join(', ') : 'MISSING'}`);
            console.log(`Impact Score: ${data.impactScore || 0}`);
        });

        process.exit(0);
    } catch (error: any) {
        console.error("Debug failed:", error.message);
        process.exit(1);
    }
}

debugRecommendations();
