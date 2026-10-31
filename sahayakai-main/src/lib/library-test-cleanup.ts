/**
 * Reset ONE teacher's VIDYA test data (scripts/cleanup-library-test-data.ts).
 *
 * Scope is exactly one uid, by path — `users/{uid}/...` — so another teacher's
 * data is unreachable by construction:
 *
 *   Conversations  users/{uid}/vidya_sessions/*            → DELETED (chat history,
 *                                                            saved or not)
 *   Generations    users/{uid}/content where the row is an  → HIDDEN, reversibly, with
 *                  AUTO-saved instant answer (chat that       the same marker the
 *                  leaked into Generations before 2026-10)    library migration uses,
 *                                                            so its --revert undoes it
 *
 * Never touched: real generated resources (quiz, lesson plan, …), instant
 * answers the teacher saved with the Save button, ambiguous rows, and rows
 * other records point at (first generation, community shares).
 */
import { classifyInstantAnswerRow, LIBRARY_MIGRATION_ID } from '@/lib/library-migration';

const BATCH_LIMIT = 400;

/** The subset of the Firestore admin API this module uses (keeps it testable). */
export interface CleanupDb {
    collection(name: string): any;
    batch(): { delete(ref: any): void; update(ref: any, data: Record<string, unknown>): void; commit(): Promise<unknown> };
}

export interface CleanupPlan {
    uid: string;
    sessionIds: string[];
    savedSessionIds: string[];
    hideContentIds: string[];
    keptInstantAnswers: { saved: number; ambiguous: number; protectedRefs: number; alreadyHidden: number };
    otherContentByType: Record<string, number>;
}

/** Firebase uids are opaque; refuse anything that could widen the path. */
export function assertSingleUid(uid: unknown): asserts uid is string {
    if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(uid)) {
        throw new Error('A single, exact --uid is required (no wildcards, paths or lists).');
    }
}

export async function planLibraryTestCleanup(db: CleanupDb, uid: string): Promise<CleanupPlan> {
    assertSingleUid(uid);
    const user = db.collection('users').doc(uid);
    const [sessions, content, userDoc, shared] = await Promise.all([
        user.collection('vidya_sessions').get(),
        user.collection('content').get(),
        user.get(),
        db.collection('library_resources').where('authorId', '==', uid).get(),
    ]);

    const protectedIds = new Set<string>();
    const firstGen = userDoc.data?.()?.firstGenerationContentId;
    if (typeof firstGen === 'string') protectedIds.add(firstGen);
    for (const r of shared.docs) {
        const src = r.data()?.sourceContentId;
        if (typeof src === 'string') protectedIds.add(src);
    }

    const plan: CleanupPlan = {
        uid,
        sessionIds: sessions.docs.map((d: any) => d.id),
        savedSessionIds: sessions.docs.filter((d: any) => d.data()?.saved === true).map((d: any) => d.id),
        hideContentIds: [],
        keptInstantAnswers: { saved: 0, ambiguous: 0, protectedRefs: 0, alreadyHidden: 0 },
        otherContentByType: {},
    };
    for (const doc of content.docs) {
        const row = doc.data() ?? {};
        if (row.type !== 'instant-answer') {
            const t = String(row.type ?? 'unknown');
            plan.otherContentByType[t] = (plan.otherContentByType[t] ?? 0) + 1;
            continue;
        }
        const { rowClass } = classifyInstantAnswerRow(row);
        if (rowClass === 'saved') plan.keptInstantAnswers.saved++;
        else if (rowClass !== 'auto') plan.keptInstantAnswers.ambiguous++;
        else if (protectedIds.has(doc.id)) plan.keptInstantAnswers.protectedRefs++;
        else if (row.hiddenFromLibrary === true) plan.keptInstantAnswers.alreadyHidden++;
        else plan.hideContentIds.push(doc.id);
    }
    return plan;
}

export async function applyLibraryTestCleanup(db: CleanupDb, plan: CleanupPlan, now = new Date()) {
    assertSingleUid(plan.uid);
    const user = db.collection('users').doc(plan.uid);
    let batch = db.batch();
    let pending = 0;
    const flush = async () => {
        if (pending > 0) await batch.commit();
        batch = db.batch();
        pending = 0;
    };
    for (const id of plan.sessionIds) {
        batch.delete(user.collection('vidya_sessions').doc(id));
        if (++pending >= BATCH_LIMIT) await flush();
    }
    for (const id of plan.hideContentIds) {
        batch.update(user.collection('content').doc(id), {
            hiddenFromLibrary: true,
            libraryMigration: { id: LIBRARY_MIGRATION_ID, reason: 'auto-saved chat (test-data cleanup)', at: now.toISOString() },
        });
        if (++pending >= BATCH_LIMIT) await flush();
    }
    await flush();
    return { sessionsDeleted: plan.sessionIds.length, generationsHidden: plan.hideContentIds.length };
}
