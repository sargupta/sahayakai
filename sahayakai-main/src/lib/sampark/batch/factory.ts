/**
 * The BatchCampaignRepo the app uses: Firestore, on the same (safety-checked) database as the
 * rest of Sampark. Tests inject the in-memory repo.
 */

import { getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { initializeFirebase } from '@/lib/firebase-admin';
import { assertSamparkEnvironmentSafe } from '@/lib/sampark/repo/factory';

import { FirestoreBatchRepo } from './firestore-repo';
import type { BatchCampaignRepo } from './repo';

let override: BatchCampaignRepo | null = null;
let promise: Promise<BatchCampaignRepo> | null = null;

export async function getBatchRepo(): Promise<BatchCampaignRepo> {
    if (override) return override;
    assertSamparkEnvironmentSafe();
    if (!promise) {
        promise = (async () => {
            await initializeFirebase();
            const databaseId = process.env.SAMPARK_FIRESTORE_DATABASE?.trim();
            const db = databaseId ? getFirestore(getApp(), databaseId) : getFirestore(getApp());
            return new FirestoreBatchRepo(db);
        })().catch((err) => {
            promise = null;
            throw err;
        });
    }
    return promise;
}

export function setBatchRepoForTests(repo: BatchCampaignRepo | null): void {
    override = repo;
    promise = null;
}
