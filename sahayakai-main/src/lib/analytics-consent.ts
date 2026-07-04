/**
 * Analytics Consent System
 * 
 * Manages user consent for detailed activity tracking
 */

import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Matches the consent copy ("data kept for 1 year") and the daily sweep in
// /api/jobs/analytics-retention. Keep the three in sync.
const RETENTION_DAYS = 365;

export interface AnalyticsConsent {
    user_id: string;
    consent_given: boolean;
    consent_date: Date;
    consent_version: string; // Track which privacy policy version they agreed to
    data_retention_acknowledged: boolean; // User knows data kept for 1 year
}

const CURRENT_CONSENT_VERSION = '1.0'; // Update when privacy policy changes

/**
 * Check if user has given analytics consent
 */
export async function hasAnalyticsConsent(userId: string): Promise<boolean> {
    try {
        const consentRef = doc(db, 'analytics_consent', userId);
        const consentDoc = await getDoc(consentRef);

        if (!consentDoc.exists()) return false;

        const data = consentDoc.data() as AnalyticsConsent;
        return data.consent_given && data.consent_version === CURRENT_CONSENT_VERSION;
    } catch (error) {
        console.error('Error checking analytics consent:', error);
        return false;
    }
}

/**
 * Save user's analytics consent
 */
export async function saveAnalyticsConsent(
    userId: string,
    consentGiven: boolean
): Promise<void> {
    try {
        const consentRef = doc(db, 'analytics_consent', userId);
        const consentData: AnalyticsConsent = {
            user_id: userId,
            consent_given: consentGiven,
            consent_date: new Date(),
            consent_version: CURRENT_CONSENT_VERSION,
            data_retention_acknowledged: true,
        };

        await setDoc(consentRef, consentData);
    } catch (error) {
        console.error('Error saving analytics consent:', error);
        throw error;
    }
}

/**
 * Revoke analytics consent
 */
export async function revokeAnalyticsConsent(userId: string): Promise<void> {
    try {
        const consentRef = doc(db, 'analytics_consent', userId);
        await updateDoc(consentRef, {
            consent_given: false,
            consent_date: new Date(),
        });
        // Revoking consent immediately purges already-expired detail rather
        // than leaving it for the nightly sweep. (Fresh data within the
        // retention window is kept for in-flight aggregates the user still
        // sees; a full erase-on-revoke is a separate product decision.)
        await purgeExpiredAnalytics(userId).catch((e) =>
            console.error('purgeExpiredAnalytics after revoke failed:', e),
        );
    } catch (error) {
        console.error('Error revoking analytics consent:', error);
        throw error;
    }
}

/**
 * Purge this user's own activity-analytics docs older than the retention
 * window (`users/{uid}/analytics/{YYYY-MM-DD}`). Returns the number deleted.
 *
 * The fleet-wide daily enforcement is the /api/jobs/analytics-retention cron
 * (a collection-group sweep across all users). This per-user function backs
 * on-demand purges — e.g. when a teacher revokes analytics consent we can
 * immediately clear their historical detail rather than waiting for the
 * nightly job. It used to be an empty TODO while the consent screen already
 * promised 1-year retention — that gap is now closed.
 */
export async function purgeExpiredAnalytics(userId: string): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const q = query(
        collection(db, 'users', userId, 'analytics'),
        where('lastUpdated', '<', Timestamp.fromDate(cutoff)),
    );
    const snap = await getDocs(q);
    if (snap.empty) return 0;

    // Client SDK batch cap is 500 writes; chunk to stay under it.
    let deleted = 0;
    for (let i = 0; i < snap.docs.length; i += 500) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
        await batch.commit();
        deleted += Math.min(500, snap.docs.length - i);
    }
    return deleted;
}

/**
 * @deprecated Renamed to purgeExpiredAnalytics (which is now implemented, not
 * a stub). Kept as a thin alias so any external caller keeps working.
 */
export const scheduleDataDeletion = purgeExpiredAnalytics;
