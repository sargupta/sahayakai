#!/usr/bin/env tsx

/**
 * ONE-TIME REPAIR SCRIPT — Founder Impact Score Dashboard
 *
 * Background:
 *   The /impact-dashboard headline composite score was being computed
 *   via a sigmoid (95) while the sub-scores beneath summed to 61, with
 *   sub-scores never persisted on aggregator runs. v3 of the formula
 *   (2026-05-20) makes the composite a transparent raw sum of the four
 *   dimensions, and the aggregator now persists ALL sub-scores plus
 *   the `level` field. This script re-runs the aggregator for the
 *   founder's account and verifies sub-scores land in Firestore.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/Users/sargupta/Downloads/sahayakai-b4248-firebase-adminsdk-fbsvc-5e4f90a578.json \
 *   npx tsx scripts/refresh-founder-impact-with-subscores.ts
 *
 *   Or with FIREBASE_SERVICE_ACCOUNT_KEY env var (JSON content inline):
 *   FIREBASE_SERVICE_ACCOUNT_KEY="$(cat ~/Downloads/sahayakai-b4248-firebase-adminsdk-fbsvc-5e4f90a578.json)" \
 *   npx tsx scripts/refresh-founder-impact-with-subscores.ts
 *
 * Safe to re-run — it's idempotent. Aggregator does a `merge: true` set.
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env BEFORE importing anything that touches firebase-admin
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Translate GOOGLE_APPLICATION_CREDENTIALS (standard) into
// FIREBASE_SERVICE_ACCOUNT_KEY (what src/lib/firebase-admin.ts reads).
if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (fs.existsSync(keyPath)) {
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY = fs.readFileSync(keyPath, 'utf8');
        console.log(`[init] Loaded service account from ${keyPath}`);
    } else {
        console.error(`[init] GOOGLE_APPLICATION_CREDENTIALS path does not exist: ${keyPath}`);
        process.exit(1);
    }
}

// Default credentials fallback for local dev convenience
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const defaultKey = '/Users/sargupta/Downloads/sahayakai-b4248-firebase-adminsdk-fbsvc-5e4f90a578.json';
    if (fs.existsSync(defaultKey)) {
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY = fs.readFileSync(defaultKey, 'utf8');
        console.log(`[init] Loaded service account from default path ${defaultKey}`);
    }
}

const FOUNDER_UID = 'mcyD4zJGqZXiy3tt0vZJtoinVyE3';

async function main() {
    // Import lazily, after env is configured
    const { getDb } = await import('../src/lib/firebase-admin');
    const { aggregateUserMetrics } = await import('../src/app/actions/aggregator');

    const db = await getDb();

    console.log(`\n=== Founder Impact Repair :: ${FOUNDER_UID} ===\n`);

    // --- BEFORE ---
    const beforeSnap = await db.collection('teacher_analytics').doc(FOUNDER_UID).get();
    const before = beforeSnap.exists ? beforeSnap.data() : null;
    console.log('--- BEFORE (current teacher_analytics doc) ---');
    if (before) {
        console.log(JSON.stringify({
            score: before.score,
            level: before.level,
            risk_level: before.risk_level,
            activity_score: before.activity_score,
            engagement_score: before.engagement_score,
            success_score: before.success_score,
            growth_score: before.growth_score,
            community_score: before.community_score,
            content_created_total: before.content_created_total,
            content_created_last_7_days: before.content_created_last_7_days,
            content_created_days_8_to_14: before.content_created_days_8_to_14,
            shared_to_community_count: before.shared_to_community_count,
            total_attempts: before.total_attempts,
            successful_generations: before.successful_generations,
            is_cold_start: before.is_cold_start,
            lastUpdated: before.lastUpdated,
        }, null, 2));
        const subSumBefore =
            Number(before.activity_score ?? 0) +
            Number(before.engagement_score ?? 0) +
            Number(before.success_score ?? 0) +
            Number(before.growth_score ?? 0);
        console.log(`Sum of 4 user-facing sub-scores: ${subSumBefore} / 100 vs headline composite ${before.score}/100`);
    } else {
        console.log('(no teacher_analytics doc exists yet)');
    }

    // --- RUN AGGREGATOR ---
    console.log('\n--- Running aggregateUserMetrics(FOUNDER_UID) ---');
    const result = await aggregateUserMetrics(FOUNDER_UID);
    console.log('Aggregator returned:', result);

    // --- AFTER ---
    const afterSnap = await db.collection('teacher_analytics').doc(FOUNDER_UID).get();
    const after = afterSnap.data();
    console.log('\n--- AFTER (refreshed teacher_analytics doc) ---');
    console.log(JSON.stringify({
        score: after?.score,
        level: after?.level,
        risk_level: after?.risk_level,
        activity_score: after?.activity_score,
        engagement_score: after?.engagement_score,
        success_score: after?.success_score,
        growth_score: after?.growth_score,
        community_score: after?.community_score,
        content_created_total: after?.content_created_total,
        content_created_last_7_days: after?.content_created_last_7_days,
        content_created_days_8_to_14: after?.content_created_days_8_to_14,
        shared_to_community_count: after?.shared_to_community_count,
        total_attempts: after?.total_attempts,
        successful_generations: after?.successful_generations,
        is_cold_start: after?.is_cold_start,
        lastUpdated: after?.lastUpdated,
    }, null, 2));

    const subSumAfter =
        Number(after?.activity_score ?? 0) +
        Number(after?.engagement_score ?? 0) +
        Number(after?.success_score ?? 0) +
        Number(after?.growth_score ?? 0);

    console.log(`\nSum of 4 user-facing sub-scores: ${subSumAfter} / 100`);
    console.log(`Headline composite: ${after?.score} / 100`);
    console.log(`INVARIANT |sum - composite|: ${Math.abs(subSumAfter - Number(after?.score ?? 0))} (must be <= 1)`);

    // Acceptance check
    const allSubScoresPresent =
        typeof after?.activity_score === 'number' &&
        typeof after?.engagement_score === 'number' &&
        typeof after?.success_score === 'number' &&
        typeof after?.growth_score === 'number' &&
        typeof after?.community_score === 'number';

    if (!allSubScoresPresent) {
        console.error('\n[FAIL] Not all sub-scores were persisted. Check aggregator.ts.');
        process.exit(2);
    }

    const invariantOK = Math.abs(subSumAfter - Number(after?.score ?? 0)) <= 1;
    if (!invariantOK) {
        console.error(`\n[FAIL] Composite (${after?.score}) does NOT match sub-score sum (${subSumAfter}). Diff > 1.`);
        process.exit(3);
    }

    if (Number(after?.success_score ?? 0) < 10) {
        console.warn(`\n[WARN] success_score=${after?.success_score} is below the 10/20 expected floor.`);
    }

    console.log('\n[OK] All 4 sub-scores persisted + headline composite matches the sum.');
}

main().catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
});
