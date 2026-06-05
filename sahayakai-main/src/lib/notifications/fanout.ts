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
 */

import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import type { Language, Notification, NotificationType } from '@/types';

const RECIPIENT_CAP = 50;
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

function renderMessage(lang: Language | undefined, name: string, school: string): string {
    const template = MESSAGE_TEMPLATES[(lang as Language) ?? 'English'] ?? MESSAGE_TEMPLATES.English;
    return template.replace('{name}', name).replace('{school}', school);
}

// Mirror of the community-page deny-list: never notify on behalf of (or to)
// a dev/QA test account. Cheap substring guard.
function looksLikeTestAccount(displayName?: string): boolean {
    const name = (displayName ?? '').toLowerCase();
    if (!name) return false;
    return /\b(dev|qa|test|impersonat|sample|dummy|placeholder)\b/i.test(name);
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
        const newTeacherSnap = await db.collection('users').doc(newTeacherUid).get();
        if (!newTeacherSnap.exists) {
            return { ...result, reason: 'missing_profile' };
        }
        const teacher = newTeacherSnap.data() as {
            displayName?: string;
            schoolName?: string;
            state?: string;
            district?: string;
            subjects?: string[];
        };

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

        // Query candidates: same state + district + subject overlap.
        // Ordered by createdAt desc → "most recently joined" gets the news.
        // We over-fetch a bit to leave room for dedup/hidden filtering.
        let query = db.collection('users')
            .where('district', '==', district)
            .where('subjects', 'array-contains', primarySubject);
        if (state) {
            query = query.where('state', '==', state);
        }
        const candidatesSnap = await query
            .orderBy('createdAt', 'desc')
            .limit(RECIPIENT_CAP * 2)
            .get();

        const candidates = candidatesSnap.docs
            .map(d => ({ uid: d.id, data: d.data() as { displayName?: string; preferredLanguage?: Language } }))
            .filter(c => c.uid !== newTeacherUid)
            .filter(c => !looksLikeTestAccount(c.data.displayName));

        if (candidates.length > RECIPIENT_CAP) {
            result.capped = true;
        }
        const trimmed = candidates.slice(0, RECIPIENT_CAP);

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
                // If the dedup query fails (e.g. missing composite index) we
                // err on the side of NOT notifying — better silent than spam.
                logger.warn('fanoutNewTeacherJoined dedup query failed', 'NOTIFICATIONS', { uid: c.uid, err: String(err) });
                return { candidate: c, hasRecent: true };
            }
        }));

        const recipients = checks.filter(c => !c.hasRecent).map(c => c.candidate);
        result.skippedDedup = checks.length - recipients.length;

        if (recipients.length === 0) return result;

        // Batch-write notification docs (500/batch is Firestore limit; we cap
        // at 50 so a single batch is always enough).
        const batch = db.batch();
        const now = new Date().toISOString();
        for (const r of recipients) {
            const ref = db.collection('notifications').doc();
            const doc: Omit<Notification, 'id'> = {
                recipientId: r.uid,
                type: newType,
                title: 'A nearby teacher just joined',
                message: renderMessage(r.data.preferredLanguage, name, school),
                senderId: newTeacherUid,
                senderName: name,
                link,
                metadata,
                isRead: false,
                createdAt: now,
            };
            batch.set(ref, doc);
        }
        await batch.commit();
        result.sent = recipients.length;
        return result;
    } catch (err) {
        logger.error('fanoutNewTeacherJoined failed', err, 'NOTIFICATIONS', { newTeacherUid });
        return result;
    }
}
