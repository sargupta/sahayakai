/**
 * The ConversationCallRepo the app uses: Firestore, on the same (safety-checked)
 * database as the rest of Sampark. Tests inject the in-memory repo.
 */

import { getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { initializeFirebase } from '@/lib/firebase-admin';
import { assertSamparkEnvironmentSafe } from '@/lib/sampark/repo/factory';

import { FirestoreConversationRepo } from './firestore-repo';
import type { ConversationCallRepo } from './repo';

let override: ConversationCallRepo | null = null;
let promise: Promise<ConversationCallRepo> | null = null;

export async function getConversationRepo(): Promise<ConversationCallRepo> {
    if (override) return override;
    // Same rule as getSamparkRepo: outside production only the emulator or the non-prod database.
    assertSamparkEnvironmentSafe();
    if (!promise) {
        promise = (async () => {
            await initializeFirebase();
            const databaseId = process.env.SAMPARK_FIRESTORE_DATABASE?.trim();
            const db = databaseId ? getFirestore(getApp(), databaseId) : getFirestore(getApp());
            return new FirestoreConversationRepo(db);
        })().catch((err) => {
            promise = null;
            throw err;
        });
    }
    return promise;
}

export function setConversationRepoForTests(repo: ConversationCallRepo | null): void {
    override = repo;
    promise = null;
}
