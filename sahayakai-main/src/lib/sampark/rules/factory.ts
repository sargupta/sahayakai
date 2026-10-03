/**
 * Where the slice-2 repository lives. Same fail-closed environment guard as
 * the slice-1 repo (class gate 5): outside production it refuses to start
 * unless pointed at the emulator or `sampark-nonprod`.
 */

import { getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { initializeFirebase } from '@/lib/firebase-admin';
import { assertSamparkEnvironmentSafe } from '@/lib/sampark/repo/factory';

import { FirestoreSamparkRulesRepo } from './firestore-repo';
import type { SamparkRulesRepo } from './ports';

let override: SamparkRulesRepo | null = null;
let repoPromise: Promise<SamparkRulesRepo> | null = null;

export async function getSamparkRulesRepo(): Promise<SamparkRulesRepo> {
    if (override) return override;
    assertSamparkEnvironmentSafe();
    if (!repoPromise) {
        repoPromise = (async () => {
            await initializeFirebase();
            const app = getApp();
            const databaseId = process.env.SAMPARK_FIRESTORE_DATABASE?.trim();
            const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
            return new FirestoreSamparkRulesRepo(db);
        })().catch((err) => {
            repoPromise = null;
            throw err;
        });
    }
    return repoPromise;
}

/** Test seam: inject createMemoryRulesRepo() or pass null to restore the real one. */
export function setSamparkRulesRepoForTests(repo: SamparkRulesRepo | null): void {
    override = repo;
    repoPromise = null;
}
