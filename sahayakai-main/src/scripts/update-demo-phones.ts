/**
 * Updates all demo students' parent phone numbers to the test number.
 * Run: npx tsx --env-file=.env.local src/scripts/update-demo-phones.ts
 */

import { getDb } from '@/lib/firebase-admin';

const TEACHER_UID = 'nYqFxBohXrSaL3EBF1f3M2xOpLf2'; // sarguptaw@gmail.com
const TEST_PHONE = '+916363740720';

async function main() {
    const db = await getDb();

    const classesSnap = await db.collection('classes')
        .where('teacherUid', '==', TEACHER_UID)
        .get();

    if (classesSnap.empty) {
        console.log('No classes found for this teacher.');
        return;
    }

    let total = 0;
    for (const classDoc of classesSnap.docs) {
        const studentsSnap = await classDoc.ref.collection('students').get();
        const batch = db.batch();
        studentsSnap.docs.forEach((s) => {
            batch.update(s.ref, { parentPhone: TEST_PHONE, updatedAt: new Date().toISOString() });
        });
        await batch.commit();
        total += studentsSnap.size;
        console.log(`  Class "${classDoc.data().name}": updated ${studentsSnap.size} students`);
    }

    console.log(`\n✓ Updated ${total} students → parentPhone = ${TEST_PHONE}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
