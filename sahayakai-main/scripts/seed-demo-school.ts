/**
 * Seed the demo school "Vidyashilp Demo School, Mysuru" so the principal
 * dashboard has realistic data for live founder demos.
 *
 * Creates:
 *   - 1 demo principal user (demo-principal@sahayakai.test)
 *   - 25 synthetic teacher users (demo-teacher-1..25@sahayakai.test)
 *   - 1 organization doc with `isDemoData: true`
 *   - Org member records for principal + teachers
 *   - User profile docs for each
 *   - Realistic `teacher_analytics/{uid}` docs spanning three activity
 *     profiles (active, regular, at-risk) so the dashboard's health
 *     distribution chart looks real in a demo.
 *
 * All seeded docs carry `isDemoData: true` so the dashboard can render a
 * "DEMO DATA, Vidyashilp Demo School" banner and the founder cannot
 * accidentally ship demo numbers as real.
 *
 * Runs idempotently: re-execute safely; existing records are updated, not
 * duplicated. Pass `--force` to replace teacher_analytics values with fresh
 * randomised numbers.
 *
 * Prerequisites:
 *   - Firebase Admin SDK ADC: `gcloud auth application-default login` OR
 *     GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON
 *   - `.env.local` (or env) with DEMO_PRINCIPAL_PASSWORD set
 *
 * Run:
 *   npx tsx scripts/seed-demo-school.ts
 *   npx tsx scripts/seed-demo-school.ts --force
 */

import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

// ---------- Config ----------
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'sahayakai-b4248';
const DEMO_ORG_ID = 'demoschool-karnataka';
const DEMO_ORG_NAME = 'Vidyashilp Demo School, Mysuru';
const DEMO_DOMAIN = 'sahayakai.test';
const DEMO_PRINCIPAL_EMAIL = `demo-principal@${DEMO_DOMAIN}`;
const TEACHER_EMAIL = (i: number) => `demo-teacher-${i + 1}@${DEMO_DOMAIN}`;

// ---------- Types ----------
type ActivityProfile = 'active' | 'regular' | 'at-risk';

interface TeacherSeed {
    name: string;
    subjects: string[];
    gradeLevels: string[];
    language: string;
    role: 'none' | 'hod' | 'coordinator' | 'vice_principal' | 'principal' | 'exam_controller';
    profile: ActivityProfile;
}

interface NamesFile {
    principal: { name: string; language: string };
    teachers: TeacherSeed[];
}

// ---------- Setup ----------
const FORCE = process.argv.includes('--force');

const thisFile = fileURLToPath(import.meta.url);
const thisDir = dirname(thisFile);
const repoRoot = dirname(thisDir);

// Load .env.local if present
loadDotenv({ path: join(repoRoot, '.env.local') });
loadDotenv({ path: join(repoRoot, '.env') });

const DEMO_PASSWORD = process.env.DEMO_PRINCIPAL_PASSWORD;
if (!DEMO_PASSWORD) {
    console.error(
        'ERROR: DEMO_PRINCIPAL_PASSWORD is not set.\n' +
        'Add it to .env.local:\n' +
        '    DEMO_PRINCIPAL_PASSWORD=<strong-demo-password>\n',
    );
    process.exit(1);
}
if (DEMO_PASSWORD.length < 8) {
    console.error('ERROR: DEMO_PRINCIPAL_PASSWORD must be at least 8 characters.');
    process.exit(1);
}

const namesPath = join(thisDir, 'seed-demo-names.json');
const names: NamesFile = JSON.parse(readFileSync(namesPath, 'utf-8'));

if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}

const db = getFirestore();
const auth = getAuth();

// ---------- Helpers ----------
function daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2): number {
    const f = Math.random() * (max - min) + min;
    return Number(f.toFixed(decimals));
}

const ALL_FEATURES = [
    'lesson-plan', 'quiz', 'worksheet', 'visual-aid', 'rubric',
    'instant-answer', 'video-storyteller', 'teacher-training',
    'exam-paper', 'field-trip', 'content-creator', 'avatar', 'community',
] as const;

function sampleFeatures(count: number): string[] {
    const shuffled = [...ALL_FEATURES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, ALL_FEATURES.length));
}

/**
 * Generate realistic teacher_analytics values for the three activity profiles.
 * Targets the health-score ranges the principal dashboard wants to demo:
 *   - active  : score 70-95 (green), 6-8 features used, weekly active
 *   - regular : score 45-70 (amber), 3-5 features, mostly weekly active
 *   - at-risk : score 15-45 (red), 1-3 features, 5-15 days since last use
 */
function generateAnalytics(uid: string, teacher: TeacherSeed): Record<string, unknown> {
    const base = {
        user_id: uid,
        preferred_language: teacher.language,
        location_type: 'urban' as const,
        estimated_students: randomInt(30, 45),
        isDemoData: true,
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (teacher.profile === 'active') {
        const content7 = randomInt(12, 25);
        const content8to14 = randomInt(8, 18);
        const total = content7 + content8to14 + randomInt(40, 120);
        return {
            ...base,
            sessions_last_7_days: randomInt(8, 18),
            sessions_days_8_to_14: randomInt(6, 14),
            content_created_last_7_days: content7,
            content_created_days_8_to_14: content8to14,
            content_created_total: total,
            features_used_last_30_days: sampleFeatures(randomInt(6, 9)),
            avg_generation_time_sec: randomFloat(18, 32, 1),
            avg_regenerations_per_content: randomFloat(1, 1.3, 2),
            successful_generations: Math.floor(total * randomFloat(0.92, 0.99, 2)),
            total_attempts: total + randomInt(2, 8),
            days_since_last_use: randomInt(0, 2),
            consecutive_days_used: randomInt(5, 14),
            days_since_signup: randomInt(45, 180),
            exported_content_count: Math.floor(total * randomFloat(0.3, 0.6, 2)),
            shared_to_community_count: Math.floor(total * randomFloat(0.08, 0.2, 2)),
            community_library_visits: randomInt(8, 25),
        };
    }

    if (teacher.profile === 'regular') {
        const content7 = randomInt(3, 10);
        const content8to14 = randomInt(3, 10);
        const total = content7 + content8to14 + randomInt(10, 40);
        return {
            ...base,
            sessions_last_7_days: randomInt(3, 7),
            sessions_days_8_to_14: randomInt(3, 7),
            content_created_last_7_days: content7,
            content_created_days_8_to_14: content8to14,
            content_created_total: total,
            features_used_last_30_days: sampleFeatures(randomInt(3, 5)),
            avg_generation_time_sec: randomFloat(22, 45, 1),
            avg_regenerations_per_content: randomFloat(1.1, 1.8, 2),
            successful_generations: Math.floor(total * randomFloat(0.8, 0.92, 2)),
            total_attempts: total + randomInt(4, 12),
            days_since_last_use: randomInt(0, 5),
            consecutive_days_used: randomInt(2, 6),
            days_since_signup: randomInt(25, 150),
            exported_content_count: Math.floor(total * randomFloat(0.15, 0.4, 2)),
            shared_to_community_count: Math.floor(total * randomFloat(0.03, 0.1, 2)),
            community_library_visits: randomInt(2, 10),
        };
    }

    // at-risk
    const content7 = randomInt(0, 2);
    const content8to14 = randomInt(1, 4);
    const total = content7 + content8to14 + randomInt(4, 15);
    return {
        ...base,
        sessions_last_7_days: randomInt(0, 2),
        sessions_days_8_to_14: randomInt(1, 4),
        content_created_last_7_days: content7,
        content_created_days_8_to_14: content8to14,
        content_created_total: total,
        features_used_last_30_days: sampleFeatures(randomInt(1, 3)),
        avg_generation_time_sec: randomFloat(30, 60, 1),
        avg_regenerations_per_content: randomFloat(1.5, 2.4, 2),
        successful_generations: Math.floor(total * randomFloat(0.65, 0.85, 2)),
        total_attempts: total + randomInt(3, 10),
        days_since_last_use: randomInt(7, 18),
        consecutive_days_used: 0,
        days_since_signup: randomInt(20, 120),
        exported_content_count: Math.floor(total * randomFloat(0.05, 0.2, 2)),
        shared_to_community_count: 0,
        community_library_visits: randomInt(0, 3),
    };
}

async function upsertAuthUser(email: string, displayName: string, password: string): Promise<UserRecord> {
    try {
        const existing = await auth.getUserByEmail(email);
        await auth.updateUser(existing.uid, { displayName });
        return existing;
    } catch (err: any) {
        if (err.code !== 'auth/user-not-found') throw err;
        return auth.createUser({
            email,
            password,
            displayName,
            emailVerified: true,
        });
    }
}

// ---------- Main ----------
async function main() {
    console.log(`\n=== Seeding demo school: ${DEMO_ORG_NAME} ===`);
    console.log(`Project: ${PROJECT_ID}`);
    console.log(`Org ID: ${DEMO_ORG_ID}`);
    console.log(`Force mode: ${FORCE ? 'ON (will overwrite analytics)' : 'off (idempotent)'}\n`);

    // 1. Principal
    console.log('1/6  Creating principal auth user...');
    const principalUser = await upsertAuthUser(
        DEMO_PRINCIPAL_EMAIL,
        names.principal.name,
        DEMO_PASSWORD!,
    );
    console.log(`     ✓ ${DEMO_PRINCIPAL_EMAIL} (uid=${principalUser.uid})`);

    // 2. Teachers
    console.log(`2/6  Creating ${names.teachers.length} teacher auth users...`);
    const teacherUids: string[] = [];
    for (let i = 0; i < names.teachers.length; i++) {
        const t = names.teachers[i];
        const u = await upsertAuthUser(TEACHER_EMAIL(i), t.name, DEMO_PASSWORD!);
        teacherUids.push(u.uid);
        process.stdout.write(`     ${i + 1}/${names.teachers.length} ${t.name}\r`);
    }
    console.log(`\n     ✓ ${teacherUids.length} teachers ready`);

    // 3. Organization doc
    console.log('3/6  Upserting organization...');
    const orgRef = db.collection('organizations').doc(DEMO_ORG_ID);
    const orgExists = (await orgRef.get()).exists;
    await orgRef.set({
        name: DEMO_ORG_NAME,
        type: 'school',
        adminUserId: principalUser.uid,
        plan: 'gold',
        totalSeats: 30,
        usedSeats: 1 + teacherUids.length,
        createdAt: orgExists ? FieldValue.serverTimestamp() : Timestamp.fromDate(daysAgo(180)),
        updatedAt: FieldValue.serverTimestamp(),
        isDemoData: true,
    }, { merge: true });
    console.log(`     ✓ ${DEMO_ORG_NAME}`);

    // 4. Members subcollection
    console.log('4/6  Writing organization members...');
    const membersBatch = db.batch();
    membersBatch.set(orgRef.collection('members').doc(principalUser.uid), {
        userId: principalUser.uid,
        role: 'admin',
        joinedAt: Timestamp.fromDate(daysAgo(180)),
        invitedBy: principalUser.uid,
        isDemoData: true,
    });
    for (let i = 0; i < teacherUids.length; i++) {
        const uid = teacherUids[i];
        membersBatch.set(orgRef.collection('members').doc(uid), {
            userId: uid,
            role: 'teacher',
            joinedAt: Timestamp.fromDate(daysAgo(randomInt(20, 150))),
            invitedBy: principalUser.uid,
            isDemoData: true,
        });
    }
    await membersBatch.commit();
    console.log(`     ✓ 1 admin + ${teacherUids.length} teachers`);

    // 5. User profiles + teacher_analytics
    console.log('5/6  Writing user profiles + analytics...');
    // Principal profile
    await db.collection('users').doc(principalUser.uid).set({
        organizationId: DEMO_ORG_ID,
        planType: 'gold',
        planSource: 'organization',
        administrativeRole: 'principal',
        displayName: names.principal.name,
        schoolName: DEMO_ORG_NAME,
        schoolNormalized: DEMO_ORG_NAME.toUpperCase().trim(),
        state: 'Karnataka',
        preferredLanguage: names.principal.language,
        isDemoData: true,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: Timestamp.fromDate(daysAgo(180)),
    }, { merge: true });

    // Teacher profiles + analytics (parallel in chunks)
    const CHUNK = 5;
    for (let start = 0; start < teacherUids.length; start += CHUNK) {
        const chunk = teacherUids.slice(start, start + CHUNK).map((uid, idx) => {
            const teacher = names.teachers[start + idx];
            return Promise.all([
                db.collection('users').doc(uid).set({
                    organizationId: DEMO_ORG_ID,
                    planType: 'gold',
                    planSource: 'organization',
                    administrativeRole: teacher.role,
                    displayName: teacher.name,
                    schoolName: DEMO_ORG_NAME,
                    schoolNormalized: DEMO_ORG_NAME.toUpperCase().trim(),
                    state: 'Karnataka',
                    subjects: teacher.subjects,
                    gradeLevels: teacher.gradeLevels,
                    preferredLanguage: teacher.language,
                    isDemoData: true,
                    updatedAt: FieldValue.serverTimestamp(),
                    createdAt: Timestamp.fromDate(daysAgo(randomInt(30, 150))),
                }, { merge: true }),
                (async () => {
                    const existing = await db.collection('teacher_analytics').doc(uid).get();
                    if (existing.exists && !FORCE) return;
                    await db.collection('teacher_analytics').doc(uid).set(generateAnalytics(uid, teacher));
                })(),
            ]);
        });
        await Promise.all(chunk);
        process.stdout.write(`     ${Math.min(start + CHUNK, teacherUids.length)}/${teacherUids.length}\r`);
    }
    console.log(`\n     ✓ profiles + analytics seeded`);

    // 6. Custom claims
    console.log('6/6  Setting custom claims (orgRole)...');
    await auth.setCustomUserClaims(principalUser.uid, {
        planType: 'gold',
        orgId: DEMO_ORG_ID,
        orgRole: 'admin',
    });
    for (const uid of teacherUids) {
        await auth.setCustomUserClaims(uid, {
            planType: 'gold',
            orgId: DEMO_ORG_ID,
            orgRole: 'teacher',
        });
    }
    console.log('     ✓ claims set on all users');

    console.log('\n=== Done ===');
    console.log(`Sign in as the principal to see the demo dashboard:`);
    console.log(`   Email:    ${DEMO_PRINCIPAL_EMAIL}`);
    console.log(`   Password: (value of DEMO_PRINCIPAL_PASSWORD)`);
    console.log(`\nSign in as any teacher:`);
    console.log(`   Email: demo-teacher-N@${DEMO_DOMAIN}  (N = 1..${teacherUids.length})`);
    console.log(`   Password: (value of DEMO_PRINCIPAL_PASSWORD)\n`);
}

main().catch((err) => {
    console.error('\nSEED FAILED:', err);
    process.exit(1);
});
