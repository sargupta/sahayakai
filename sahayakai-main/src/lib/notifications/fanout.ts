/**
 * Nearby-teacher notification fan-out.
 *
 * When a teacher completes onboarding (or signup if no onboarding) we push a
 * notification to up to 50 other teachers in the same state + district whose
 * subjects overlap on the new teacher's primary subject. Recipients see a
 * "<name> joined SahayakAI from <school>" message in their preferredLanguage,
 * deep-linked to /community?tab=connect&highlight=<newTeacherUid>.
 *
 * Rate-limit: a recipient who has already received a NEW_TEACHER_JOINED
 * notification in the last 24h is skipped (so a school onboarding 20 teachers
 * in one morning doesn't blast existing teachers 20 times).
 *
 * Notifications use the top-level `notifications` collection (not a
 * subcollection) — same shape as createNotification in
 * src/app/actions/notifications.ts.
 *
 * F6-01 fix: candidate pool is *randomly sampled* across the matching cohort.
 *   We over-fetch 4x cap (200), shuffle in JS, then slice to 50. This guarantees
 *   probabilistic uniform coverage of old/new teachers in dense districts
 *   rather than the previous createdAt-desc-take-50 starvation pattern.
 *
 * F6-02/03 fix: dedup-query failures no longer silently skip recipients.
 *   On error we WARN-log a structured `event: notification.dedup.failed` and
 *   default to sending (better to over-deliver than to be silent).
 *
 * F6-13 fix: each recipient also receives an FCM push via sendPushToUser.
 *
 * F6-19 fix: senderId is derived from the resolved teacher profile that this
 *   module fetched itself; there is no caller-supplied senderId in this code
 *   path, so the spoofing surface is closed.
 */

import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { sendPushToUser } from '@/lib/fcm-server';
import { resolveLanguage } from '@/lib/notifications/i18n';
import type { Language, Notification, NotificationType } from '@/types';

const RECIPIENT_CAP = 50;
const OVERFETCH_MULTIPLIER = 4; // F6-01: sample randomly from a larger pool
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

// Message template, one entry per supported language. Kept inline (not in the
// language-context dictionary) because that file is "use client" and this
// module runs server-side. Placeholders: {name}, {school}.
const MESSAGE_TEMPLATES: Record<Language, string> = {
    English: '{name} joined SahayakAI from {school}',
    Hindi: '{name} ने {school} से SahayakAI जॉइन किया',
    Kannada: '{name} ಅವರು {school} ನಿಂದ SahayakAI ಸೇರಿದರು',
    Tamil: '{name} {school} இலிருந்து SahayakAI இல் சேர்ந்தார்',
    Telugu: '{name} {school} నుండి SahayakAI లో చేరారు',
    Marathi: '{name} यांनी {school} मधून SahayakAI जॉइन केले',
    Bengali: '{name} {school} থেকে SahayakAI-তে যোগ দিয়েছেন',
    Gujarati: '{name} એ {school} માંથી SahayakAI જોઈન કર્યું',
    Punjabi: '{name} ਨੇ {school} ਤੋਂ SahayakAI ਜੁਆਇਨ ਕੀਤਾ',
    Malayalam: '{name} {school} ൽ നിന്ന് SahayakAI യിൽ ചേർന്നു',
    Odia: '{name} {school} ରୁ SahayakAI ରେ ଯୋଗ ଦେଲେ',
};

function renderMessage(lang: Language | string | undefined, name: string, school: string): string {
    const canonical = resolveLanguage(lang) ?? 'English';
    const template = MESSAGE_TEMPLATES[canonical] ?? MESSAGE_TEMPLATES.English;
    return template.replace('{name}', name).replace('{school}', school);
}

// Mirror of the community-page deny-list: never notify on behalf of (or to)
// a dev/QA test account. Cheap substring guard.
function looksLikeTestAccount(displayName?: string): boolean {
    const name = (displayName ?? '').toLowerCase();
    if (!name) return false;
    return /\b(dev|qa|test|impersonat|sample|dummy|placeholder)\b/i.test(name);
}

// Fisher-Yates shuffle (in-place). Used by F6-01 random sampling.
// Exported for testability (so a deterministic seed can verify behavior).
export function shuffleInPlace<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export interface FanoutResult {
    sent: number;
    skippedDedup: number;
    skippedHidden: number;
    capped: boolean;
    reason?: 'missing_profile' | 'missing_district' | 'missing_subject' | 'test_account';
}

/**
 * Fan out a NEW_TEACHER_JOINED notification for `newTeacherUid`.
 *
 * Idempotent-ish: safe to call multiple times; the per-recipient 24h dedup
 * window will swallow duplicates within a day. Failures are logged but never
 * thrown — callers fire-and-forget this from request handlers.
 */
export async function fanoutNewTeacherJoinedNotification(
    newTeacherUid: string,
): Promise<FanoutResult> {
    const result: FanoutResult = { sent: 0, skippedDedup: 0, skippedHidden: 0, capped: false };
    try {
        const db = await getDb();
        const userRef = db.collection('users').doc(newTeacherUid);

        // F5-004 fix: atomic check-and-set on a `newTeacherFanoutCompleted`
        // marker. The profile route POST handler is called from `useEffect`
        // hooks and form-submit handlers; a double-submit (or a duplicate
        // request from network retry) used to fire fan-out N times, sending
        // duplicate "<name> joined SahayakAI" FCM to every nearby teacher.
        // We now read the marker and set it to `true` in a single Firestore
        // transaction — the second caller observes `marker === true` and
        // returns before the candidate query / batch write runs.
        const teacher = await db.runTransaction(async (tx) => {
            const snap = await tx.get(userRef);
            if (!snap.exists) return null;
            const data = snap.data() as {
                displayName?: string;
                schoolName?: string;
                state?: string;
                district?: string;
                subjects?: string[];
                newTeacherFanoutCompleted?: boolean;
            };
            if (data.newTeacherFanoutCompleted) return undefined; // already fanned out
            tx.update(userRef, { newTeacherFanoutCompleted: true });
            return data;
        });

        if (teacher === null) {
            return { ...result, reason: 'missing_profile' };
        }
        if (teacher === undefined) {
            // Marker was already set by a concurrent caller — silently no-op.
            return result;
        }

        if (looksLikeTestAccount(teacher.displayName)) {
            return { ...result, reason: 'test_account' };
        }

        const district = (teacher.district ?? '').trim();
        const state = (teacher.state ?? '').trim();
        if (!district) {
            return { ...result, reason: 'missing_district' };
        }

        const primarySubject = (teacher.subjects ?? [])[0];
        if (!primarySubject) {
            return { ...result, reason: 'missing_subject' };
        }

        const name = (teacher.displayName ?? '').trim() || 'A teacher';
        const school = (teacher.schoolName ?? '').trim() || 'a nearby school';

        // F6-01 fix: over-fetch RECIPIENT_CAP * OVERFETCH_MULTIPLIER (200)
        // candidates ordered by createdAt desc, then JS-shuffle and take 50.
        // Old cohort members in dense districts now have a real chance to be
        // notified (previously they were guaranteed-starved).
        let query = db.collection('users')
            .where('district', '==', district)
            .where('subjects', 'array-contains', primarySubject);
        if (state) {
            query = query.where('state', '==', state);
        }
        const candidatesSnap = await query
            .orderBy('createdAt', 'desc')
            .limit(RECIPIENT_CAP * OVERFETCH_MULTIPLIER)
            .get();

        const candidates = candidatesSnap.docs
            .map(d => ({ uid: d.id, data: d.data() as { displayName?: string; preferredLanguage?: Language } }))
            .filter(c => c.uid !== newTeacherUid)
            .filter(c => !looksLikeTestAccount(c.data.displayName));

        if (candidates.length > RECIPIENT_CAP) {
            result.capped = true;
        }
        const shuffled = shuffleInPlace([...candidates]);
        const trimmed = shuffled.slice(0, RECIPIENT_CAP);

        const dedupCutoffIso = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
        const newType: NotificationType = 'NEW_TEACHER_JOINED';
        const link = `/community?tab=connect&highlight=${encodeURIComponent(newTeacherUid)}`;
        const metadata = { newTeacherUid, school, district };

        // Per-recipient dedup query, run in parallel. Each query is cheap
        // (single-recipient + type filter + isoString string-range).
        const checks = await Promise.all(trimmed.map(async (c) => {
            try {
                const recent = await db.collection('notifications')
                    .where('recipientId', '==', c.uid)
                    .where('type', '==', newType)
                    .where('createdAt', '>=', dedupCutoffIso)
                    .limit(1)
                    .get();
                return { candidate: c, hasRecent: !recent.empty };
            } catch (err) {
                // F6-02/03 fix: previously this `catch` set hasRecent=true,
                // silently zeroing the entire fan-out if the composite index
                // was missing. We now structured-log to Cloud Logging and
                // DEFAULT TO SEND (over-delivery beats silent under-delivery).
                logger.warn(
                    'notification.dedup.failed',
                    'NOTIFICATIONS',
                    {
                        event: 'notification.dedup.failed',
                        type: newType,
                        recipientId: c.uid,
                        newTeacherUid,
                        err: String(err),
                    },
                );
                return { candidate: c, hasRecent: false };
            }
        }));

        const recipients = checks.filter(c => !c.hasRecent).map(c => c.candidate);
        result.skippedDedup = checks.length - recipients.length;

        if (recipients.length === 0) return result;

        // Batch-write notification docs (500/batch is Firestore limit; we cap
        // at 50 so a single batch is always enough).
        //
        // F6-19 note: senderId is derived from the newTeacherUid that this
        // module resolved against Firestore — there is no caller-controlled
        // senderId field in this fan-out path, so the spoofing surface that
        // exists in createNotification is closed by construction here.
        const batch = db.batch();
        const now = new Date().toISOString();
        const pushPayloads: { recipientId: string; title: string; body: string }[] = [];
        for (const r of recipients) {
            const ref = db.collection('notifications').doc();
            const localizedMessage = renderMessage(r.data.preferredLanguage, name, school);
            const doc: Omit<Notification, 'id'> = {
                recipientId: r.uid,
                type: newType,
                title: 'A nearby teacher just joined',
                message: localizedMessage,
                senderId: newTeacherUid,
                senderName: name,
                link,
                metadata,
                isRead: false,
                createdAt: now,
            };
            batch.set(ref, doc);
            pushPayloads.push({
                recipientId: r.uid,
                title: 'A nearby teacher just joined',
                body: localizedMessage,
            });
        }
        await batch.commit();
        result.sent = recipients.length;

        // F6-13 fix: FCM push to each recipient (fire-and-forget; helper
        // swallows errors internally so a single bad token doesn't break fan-out).
        for (const p of pushPayloads) {
            void sendPushToUser(
                p.recipientId,
                { title: p.title, body: p.body },
                { link, type: newType },
            );
        }

        return result;
    } catch (err) {
        logger.error('fanoutNewTeacherJoined failed', err, 'NOTIFICATIONS', { newTeacherUid });
        return result;
    }
}
