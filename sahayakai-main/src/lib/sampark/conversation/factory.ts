/**
 * The ConversationCallRepo the app uses: Firestore, on the same (safety-checked)
 * database as the rest of Sampark. Tests inject the in-memory repo.
 */

import { getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { initializeFirebase } from '@/lib/firebase-admin';
import { assertSamparkEnvironmentSafe, samparkRepoOverrideForTests } from '@/lib/sampark/repo/factory';

import { FirestoreConversationRepo } from './firestore-repo';
import { createMemoryConversationRepo, type ConversationCallRepo } from './repo';

let override: ConversationCallRepo | null = null;
let promise: Promise<ConversationCallRepo> | null = null;

/** One in-memory conversation repo per injected Sampark test repo (test seam only). */
const pairedForTests = new WeakMap<object, ConversationCallRepo>();

export async function getConversationRepo(): Promise<ConversationCallRepo> {
    if (override) return override;
    // A test that injected a Sampark repo is in-memory end to end: pair it with an (empty) in-memory
    // conversation repo rather than reaching for Firestore. Production never sets a test override.
    const samparkTestRepo = samparkRepoOverrideForTests();
    if (samparkTestRepo) {
        let paired = pairedForTests.get(samparkTestRepo);
        if (!paired) {
            paired = createMemoryConversationRepo();
            pairedForTests.set(samparkTestRepo, paired);
        }
        return paired;
    }
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

/** The conversation-call repo for this context: the one it carries, else the app's (never "none"). */
export async function conversationCallsOf(ctx: { conversationCalls?: ConversationCallRepo }): Promise<ConversationCallRepo> {
    return ctx.conversationCalls ?? getConversationRepo();
}

export function setConversationRepoForTests(repo: ConversationCallRepo | null): void {
    override = repo;
    promise = null;
}
