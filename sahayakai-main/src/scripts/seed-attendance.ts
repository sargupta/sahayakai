/**
 * Seed script: creates a demo class with students + attendance for sarguptaw@gmail.com
 * Run: npx tsx --env-file=.env.local src/scripts/seed-attendance.ts
 */

import { getDb } from '@/lib/firebase-admin';

const TEACHER_UID = 'nYqFxBohXrSaL3EBF1f3M2xOpLf2'; // sarguptaw@gmail.com

// ── Students ──────────────────────────────────────────────────────────────────
const STUDENTS = [
    // All demo students use the same test number (verified in Twilio trial account)
    { roll: 1, name: 'Aarav Sharma',    phone: '+916363740720', lang: 'Hindi' },
    { roll: 2, name: 'Priya Nair',      phone: '+916363740720', lang: 'Malayalam' },
    { roll: 3, name: 'Rohit Verma',     phone: '+916363740720', lang: 'Hindi' },   // ← will have 3 consecutive absences
    { roll: 4, name: 'Sneha Patel',     phone: '+916363740720', lang: 'Gujarati' },
    { roll: 5, name: 'Kiran Kumar',     phone: '+916363740720', lang: 'Kannada' },
    { roll: 6, name: 'Lakshmi Devi',    phone: '+916363740720', lang: 'Telugu' },
    { roll: 7, name: 'Arjun Singh',     phone: '+916363740720', lang: 'Hindi' },
    { roll: 8, name: 'Meena Krishnan',  phone: '+916363740720', lang: 'Tamil' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function dateStr(daysAgo: number): string {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toLocaleDateString('sv'); // YYYY-MM-DD in local tz
}

async function main() {
    const db = await getDb();
    const now = new Date().toISOString();

    // 1. Ensure teacher has pro plan
    console.log('Upgrading sarguptaw@gmail.com to pro plan...');
    await db.collection('users').doc(TEACHER_UID).update({ planType: 'gold' });

    // 2. Create class
    console.log('Creating class...');
    const classRef = db.collection('classes').doc();
    const classId = classRef.id;
    await classRef.set({
        teacherUid: TEACHER_UID,
        name: 'Class 6A',
        subject: 'Mathematics',
        gradeLevel: 'Grade 6',
        section: 'A',
        academicYear: '2025-26',
        studentCount: STUDENTS.length,
        createdAt: now,
        updatedAt: now,
    });
    console.log(`  Class ID: ${classId}`);

    // 3. Add students
    console.log('Adding students...');
    const studentIds: string[] = [];
    const batch1 = db.batch();
    for (const s of STUDENTS) {
        const ref = db.collection('classes').doc(classId).collection('students').doc();
        studentIds.push(ref.id);
        batch1.set(ref, {
            classId,
            name: s.name,
            rollNumber: s.roll,
            parentPhone: s.phone,
            parentLanguage: s.lang,
            createdAt: now,
            updatedAt: now,
        });
    }
    await batch1.commit();
    console.log(`  Added ${STUDENTS.length} students`);

    // 4. Build attendance records for the past 14 school days
    // Rohit Verma (index 2) gets absent on last 3 days → consecutive absences = 3
    // Sneha Patel (index 3) gets late a few times
    // All others mostly present
    console.log('Creating attendance records...');

    const attendanceDays = Array.from({ length: 14 }, (_, i) => i + 1); // 14 days ago → 1 day ago
    // Plus today (0 days ago)
    attendanceDays.unshift(0);

    for (const daysAgo of attendanceDays) {
        const date = dateStr(daysAgo);
        const records: Record<string, string> = {};

        for (let i = 0; i < STUDENTS.length; i++) {
            const sid = studentIds[i];

            if (i === 2) {
                // Rohit Verma — absent last 3 days (days 0, 1, 2), present before
                records[sid] = daysAgo <= 2 ? 'absent' : 'present';
            } else if (i === 3) {
                // Sneha Patel — late on days 3, 7, 10
                records[sid] = [3, 7, 10].includes(daysAgo) ? 'late' : 'present';
            } else if (i === 6) {
                // Arjun Singh — absent day 5 and 6 (not consecutive with today)
                records[sid] = [5, 6].includes(daysAgo) ? 'absent' : 'present';
            } else {
                records[sid] = 'present';
            }
        }

        await db.collection('attendance').doc(classId)
            .collection('records').doc(date).set({
                classId,
                date,
                teacherUid: TEACHER_UID,
                records,
                submittedAt: now,
                isFinalized: false,
            });
    }
    console.log(`  Created ${attendanceDays.length} daily records`);

    console.log('\n✓ Seed complete!');
    console.log(`  Class ID:     ${classId}`);
    console.log(`  Students:     ${STUDENTS.length}`);
    console.log(`  At-risk:      Rohit Verma (3 consecutive absences)`);
    console.log(`  Late pattern: Sneha Patel (3 late days)`);
    console.log('\nOpen: /attendance/' + classId);
}

main().catch((e) => { console.error(e); process.exit(1); });
