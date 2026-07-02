/**
 * Analytics Consent System
 * 
 * Manages user consent for detailed activity tracking
 */

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
    } catch (error) {
        console.error('Error revoking analytics consent:', error);
        throw error;
    }
}

/**
 * The 1-year analytics retention promise is enforced server-side by the daily
 * cron job at `POST /api/jobs/analytics-retention`, which deletes per-day
 * analytics aggregate docs older than the window and writes an audit-log entry
 * per deletion. There is no per-user client-side scheduling to do here.
 */
