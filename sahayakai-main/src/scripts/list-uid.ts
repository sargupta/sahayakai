import { getDb } from '@/lib/firebase-admin';

async function listUsers() {
    try {
        const db = await getDb();
        const snapshot = await db.collection('users').get();
        console.log('--- RECENT USERS ---');
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`- ${data.displayName || 'N/A'}: ${doc.id} (${data.email || 'N/A'})`);
        });
    } catch (error) {
        console.error('Error:', error);
    }
}

listUsers();
