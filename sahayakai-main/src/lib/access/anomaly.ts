import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAuthInstance, getDb } from '@/lib/firebase-admin';
import { PLAN_CONFIG, type GatedFeature } from '@/lib/plan-config';
import { normalizePlan } from '@/lib/plan-utils';
import { toIso } from './route-helpers';

/**
 * Anomaly flags: surface accounts whose first two days look like a product
 * teardown rather than teaching. A teacher starts with one or two tools; an
 * account that walks through most of the product, or runs several tools to
 * their monthly limit, within 48 hours of being created is worth a look.
 *
 * FLAGS ONLY. Nothing here blocks or changes access: a keen new teacher can
 * trip these thresholds too, so a person decides (admin review screen reads
 * `access_flags`).
 *
 * Data source: `usageCounters/{uid}`, written by src/lib/usage-counters.ts.
 * Fields are `${feature}_${YYYY-MM}` (monthly) and
 * `${feature}_daily_${YYYY-MM-DD}` (daily), keyed in IST, plus `lastUpdated`.
 *
 * Design: docs/ACCESS_GATE_DESIGN.md
 */

export const ACCESS_FLAGS_COLLECTION = 'access_flags';

/** Activity window examined, in hours. */
export const ANOMALY_WINDOW_HOURS = 48;
/**
 * Only accounts created within this many hours are evaluated. Wider than the
 * window so a nightly run still sees an account's whole first 48 hours.
 */
export const ANOMALY_NEW_ACCOUNT_HOURS = 72;
/** Distinct gated features used in the window that counts as a sweep (of 15). */
export const ANOMALY_BREADTH_THRESHOLD = 8;
/** Features run to their plan's monthly limit that counts as volume abuse. */
export const ANOMALY_LIMITS_HIT_THRESHOLD = 3;
/** Upper bound on counters scanned per run. */
const SCAN_LIMIT = 500;

export type AnomalyReason = 'broad_feature_sweep' | 'volume_limits_hit';

const GATED_FEATURES = Object.keys(PLAN_CONFIG.free.limits) as GatedFeature[];

function istDay(date: Date): string {
    return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** IST day keys covering the window ending at `now` (today and the days before). */
export function windowDayKeys(now: Date): string[] {
    const days = Math.ceil(ANOMALY_WINDOW_HOURS / 24) + 1;
    const keys: string[] = [];
    for (let i = 0; i < days; i++) {
        keys.push(istDay(new Date(now.getTime() - i * 24 * 60 * 60 * 1000)));
    }
    return keys;
}

export interface UsageAssessment {
    featuresTouched: GatedFeature[];
    limitsHit: GatedFeature[];
    reasons: AnomalyReason[];
}

/**
 * Pure assessment of one usageCounters document. `plan` selects which
 * monthly limits apply (a pilot teacher on a school plan has higher limits
 * than a free account). Exported for tests.
 */
export function assessUsage(
    counters: Record<string, unknown>,
    plan: string,
    now: Date,
): UsageAssessment {
    const dayKeys = windowDayKeys(now);
    const monthKey = istDay(now).slice(0, 7);
    const limits = PLAN_CONFIG[normalizePlan(plan)].limits;

    const featuresTouched: GatedFeature[] = [];
    const limitsHit: GatedFeature[] = [];
    for (const feature of GATED_FEATURES) {
        const usedInWindow = dayKeys.some((day) => {
            const v = counters[`${feature}_daily_${day}`];
            return typeof v === 'number' && v > 0;
        });
        if (usedInWindow) featuresTouched.push(feature);

        const limit = limits[feature];
        const monthly = counters[`${feature}_${monthKey}`];
        if (limit > 0 && typeof monthly === 'number' && monthly >= limit) limitsHit.push(feature);
    }

    const reasons: AnomalyReason[] = [];
    if (featuresTouched.length >= ANOMALY_BREADTH_THRESHOLD) reasons.push('broad_feature_sweep');
    if (limitsHit.length >= ANOMALY_LIMITS_HIT_THRESHOLD) reasons.push('volume_limits_hit');
    return { featuresTouched, limitsHit, reasons };
}

export interface AnomalyRunResult {
    scanned: number;
    flagged: number;
    failed: number;
}

/**
 * Scan recently active accounts and raise flags. Idempotent: re-flagging an
 * account merges reasons and bumps `lastSeenAt`; it never resets a flag an
 * administrator has already reviewed.
 */
export async function detectAccessAnomalies(now: Date = new Date()): Promise<AnomalyRunResult> {
    const db = await getDb();
    const since = new Date(now.getTime() - ANOMALY_WINDOW_HOURS * 60 * 60 * 1000);
    const snap = await db
        .collection('usageCounters')
        .where('lastUpdated', '>=', since)
        .orderBy('lastUpdated', 'desc')
        .limit(SCAN_LIMIT)
        .get();

    const result: AnomalyRunResult = { scanned: snap.size, flagged: 0, failed: 0 };
    const newAccountMs = ANOMALY_NEW_ACCOUNT_HOURS * 60 * 60 * 1000;

    for (const doc of snap.docs) {
        const uid = doc.id;
        try {
            const counters = doc.data() as Record<string, unknown>;
            // Cheap pre-filter on the most permissive reading (free limits)
            // before spending a users read and an Auth lookup.
            if (assessUsage(counters, 'free', now).reasons.length === 0) continue;

            const userSnap = await db.collection('users').doc(uid).get();
            const user = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {};
            if (user.role === 'admin') continue;

            const auth = await getAuthInstance();
            const created = new Date((await auth.getUser(uid)).metadata.creationTime);
            if (Number.isNaN(created.getTime()) || now.getTime() - created.getTime() > newAccountMs) continue;

            const plan = typeof user.planType === 'string' ? user.planType : 'free';
            const assessment = assessUsage(counters, plan, now);
            if (assessment.reasons.length === 0) continue;

            const flagRef = db.collection(ACCESS_FLAGS_COLLECTION).doc(uid);
            const existing = await flagRef.get();
            await flagRef.set(
                {
                    uid,
                    reasons: FieldValue.arrayUnion(...assessment.reasons),
                    featuresTouched: assessment.featuresTouched,
                    limitsHit: assessment.limitsHit,
                    accountCreatedAt: created,
                    lastSeenAt: now,
                    ...(existing.exists ? {} : { firstSeenAt: now, reviewed: false }),
                },
                { merge: true },
            );
            result.flagged++;
            // Structured line for a Cloud Logging alert. uid only, no PII.
            console.warn(JSON.stringify({
                severity: 'WARNING',
                message: 'access_anomaly_flagged',
                uid,
                reasons: assessment.reasons,
                featuresTouched: assessment.featuresTouched.length,
                limitsHit: assessment.limitsHit.length,
            }));
        } catch (err) {
            result.failed++;
            console.error('[access-anomaly] assessment failed', uid, err instanceof Error ? err.message : err);
        }
    }
    return result;
}

export interface AccessFlagView {
    uid: string;
    reasons: string[];
    featuresTouched: string[];
    limitsHit: string[];
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    reviewed: boolean;
}

/** Most recent first, unreviewed and reviewed alike. */
export async function listAccessFlags(limit = 100): Promise<AccessFlagView[]> {
    const db = await getDb();
    const snap = await db
        .collection(ACCESS_FLAGS_COLLECTION)
        .orderBy('lastSeenAt', 'desc')
        .limit(Math.min(Math.max(limit, 1), 200))
        .get();
    const strings = (v: unknown): string[] =>
        Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    return snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
            uid: d.id,
            reasons: strings(data.reasons),
            featuresTouched: strings(data.featuresTouched),
            limitsHit: strings(data.limitsHit),
            firstSeenAt: toIso(data.firstSeenAt),
            lastSeenAt: toIso(data.lastSeenAt),
            reviewed: data.reviewed === true,
        };
    });
}
