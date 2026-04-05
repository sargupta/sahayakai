/**
 * Seed AI teacher profiles into Firestore.
 *
 * Usage:
 *   npx tsx src/scripts/seed-ai-teachers.ts
 *
 * This creates user documents for all 8 AI teacher personas.
 * The cron job will handle auto-joining groups and posting content.
 * Run this once after deploying the feature.
 */

import { AI_TEACHER_PERSONAS, getPersonaUserDoc } from '../lib/ai-teacher-personas';

async function main() {
    // Dynamic import to avoid top-level firebase-admin issues
    const { getDb } = await import('../lib/firebase-admin');
    const db = await getDb();

    console.log('Seeding AI teacher profiles...\n');

    for (const persona of AI_TEACHER_PERSONAS) {
        const userRef = db.collection('users').doc(persona.uid);
        const existing = await userRef.get();

        if (existing.exists) {
            console.log(`  ✓ ${persona.displayName} (${persona.uid}) — already exists`);
            continue;
        }

        await userRef.set(getPersonaUserDoc(persona));
        console.log(`  + ${persona.displayName} (${persona.uid}) — created`);
        console.log(`    ${persona.subjects.join(', ')} | ${persona.school}, ${persona.city}`);
    }

    console.log(`\nDone. ${AI_TEACHER_PERSONAS.length} personas processed.`);
    console.log('Run the cron job to generate initial content:');
    console.log('  curl -X POST https://<your-app>/api/jobs/ai-community-agent');
}

main().catch(console.error);
