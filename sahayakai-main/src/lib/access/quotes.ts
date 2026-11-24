import 'server-only';
import { z } from 'zod';
import type { Firestore } from 'firebase-admin/firestore';
import { getDb } from '@/lib/firebase-admin';
import { hashIdentifier } from '@/lib/demo-call/gates';
import { estimateSchoolCost } from '@/lib/school-pricing';
import { AccessHttpError, toIso } from './route-helpers';

/**
 * School quote requests from the public pricing estimator. This replaces the
 * pre-filled mailto: the form requires the school's identity, so a quote can
 * no longer be extracted anonymously, and every request lands in a reviewable
 * queue (`quote_requests`) instead of an inbox.
 *
 * The endpoint is unauthenticated. Abuse gates, in order: Turnstile (route),
 * strict validation + consistency checks (here), then a transactional global
 * daily cap and per-IP daily limit (here). IPs are stored only as a salted
 * SHA-256, sharing the pepper used by the demo-call gates.
 *
 * Design: docs/ACCESS_GATE_DESIGN.md
 */

export const QUOTE_REQUESTS_COLLECTION = 'quote_requests';
const QUOTE_META_COLLECTION = 'quote_request_meta';

export const QUOTE_STATUSES = ['new', 'contacted', 'qualified', 'closed'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** Defaults; override with QUOTE_DAILY_CAP / QUOTE_IP_DAILY_LIMIT. */
const DEFAULT_DAILY_CAP = 200;
const DEFAULT_IP_DAILY_LIMIT = 5;

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
    z.preprocess(
        (v) => (typeof v === 'string' && v.trim().length === 0 ? undefined : v),
        z.string().trim().max(max).optional(),
    );

const estimateSchema = z.object({
    teachers: z.number().int().min(1).max(20_000),
    billing: z.enum(['annual', 'monthly']),
    includeParentCalls: z.boolean(),
    students: z.number().int().min(0).max(1_000_000),
    callsPerStudentPerYear: z.number().int().min(0).max(365),
    avgMinutesPerCall: z.number().min(0).max(60),
    // Accepted for contract compatibility but never trusted: the stored total
    // is recomputed server-side from the inputs above.
    totalPerYearInclGst: z.number().optional(),
});

export const quoteInputSchema = z.object({
    schoolName: text(160),
    contactName: text(120),
    role: text(80),
    email: z.string().trim().toLowerCase().email().max(254),
    phone: z
        .string()
        .trim()
        .min(7)
        .max(20)
        .regex(/^\+?[0-9][0-9\s()-]{5,18}[0-9]$/, 'Enter a valid phone number'),
    board: optionalText(60),
    affiliationNumber: optionalText(40),
    city: text(80),
    state: text(80),
    estimate: estimateSchema,
});
export type QuoteInput = z.infer<typeof quoteInputSchema>;

export interface QuoteView {
    id: string;
    schoolName: string;
    contactName: string;
    role: string;
    email: string;
    phone: string;
    board: string | null;
    affiliationNumber: string | null;
    city: string;
    state: string;
    estimate: {
        teachers: number;
        billing: 'annual' | 'monthly';
        includeParentCalls: boolean;
        students: number;
        callsPerStudentPerYear: number;
        avgMinutesPerCall: number;
        totalPerYearInclGst: number;
    };
    status: QuoteStatus;
    createdAt: string | null;
}

/**
 * Validate a quote body. Beyond field shape, reject estimates no real school
 * would send: fewer students than teachers, or parent calls requested with
 * no students or no calls.
 */
export function parseQuoteInput(body: unknown): QuoteInput {
    const parsed = quoteInputSchema.safeParse(body);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = issue?.path.join('.') || 'body';
        throw new AccessHttpError(400, `Invalid ${field}: ${issue?.message ?? 'invalid value'}`, 'VALIDATION_FAILED');
    }
    const { estimate } = parsed.data;
    // Student numbers only matter when parent calls are part of the estimate;
    // the calculator leaves a default in that field otherwise.
    if (estimate.includeParentCalls && estimate.students > 0 && estimate.students < estimate.teachers) {
        throw new AccessHttpError(
            400,
            'The number of students cannot be lower than the number of teachers',
            'INCONSISTENT_ESTIMATE',
        );
    }
    if (
        estimate.includeParentCalls &&
        (estimate.students < 1 || estimate.callsPerStudentPerYear < 1 || estimate.avgMinutesPerCall <= 0)
    ) {
        throw new AccessHttpError(
            400,
            'Parent calls need a student count, calls per student, and a call length',
            'INCONSISTENT_ESTIMATE',
        );
    }
    return parsed.data;
}

function intEnv(name: string, fallback: number): number {
    const raw = Number.parseInt(process.env[name] ?? '', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function dayStamp(now: Date): string {
    return now.toISOString().slice(0, 10).replace(/-/g, '');
}

export type QuoteGateRejection = 'daily_cap' | 'ip_limit';

/**
 * Atomically check the global daily cap and the per-IP daily limit and, if
 * both pass, count this submission. One transaction, so concurrent requests
 * cannot slip past either limit.
 */
export async function reserveQuoteSlot(
    db: Firestore,
    ip: string,
    now: Date = new Date(),
): Promise<{ ok: true; ipHash: string } | { ok: false; reason: QuoteGateRejection; ipHash: string }> {
    const ipHash = hashIdentifier(ip);
    const day = dayStamp(now);
    const dailyCap = intEnv('QUOTE_DAILY_CAP', DEFAULT_DAILY_CAP);
    const ipLimit = intEnv('QUOTE_IP_DAILY_LIMIT', DEFAULT_IP_DAILY_LIMIT);

    const dailyRef = db.collection(QUOTE_META_COLLECTION).doc(`daily-${day}`);
    const ipRef = db.collection(QUOTE_META_COLLECTION).doc(`ip-${day}-${ipHash}`);

    const reason = await db.runTransaction<QuoteGateRejection | null>(async (tx) => {
        const [dailySnap, ipSnap] = await Promise.all([tx.get(dailyRef), tx.get(ipRef)]);
        const dailyCount = (dailySnap.data()?.count as number | undefined) ?? 0;
        if (dailyCount >= dailyCap) return 'daily_cap';
        const ipCount = (ipSnap.data()?.count as number | undefined) ?? 0;
        if (ipCount >= ipLimit) return 'ip_limit';

        const nowIso = now.toISOString();
        tx.set(dailyRef, { count: dailyCount + 1, updatedAt: nowIso }, { merge: true });
        tx.set(ipRef, { count: ipCount + 1, updatedAt: nowIso }, { merge: true });
        return null;
    });

    return reason ? { ok: false, reason, ipHash } : { ok: true, ipHash };
}

/** Persist a validated quote request. The total is recomputed, never trusted. */
export async function createQuoteRequest(
    db: Firestore,
    input: QuoteInput,
    ipHash: string,
    now: Date = new Date(),
): Promise<string> {
    const e = input.estimate;
    const computed = estimateSchoolCost({
        teachers: e.teachers,
        billing: e.billing,
        includeParentCalls: e.includeParentCalls,
        students: e.students,
        callsPerStudentPerYear: e.callsPerStudentPerYear,
        avgMinutesPerCall: e.avgMinutesPerCall,
    });
    const ref = db.collection(QUOTE_REQUESTS_COLLECTION).doc();
    await ref.set({
        schoolName: input.schoolName,
        contactName: input.contactName,
        role: input.role,
        email: input.email,
        phone: input.phone,
        board: input.board ?? null,
        affiliationNumber: input.affiliationNumber ?? null,
        city: input.city,
        state: input.state,
        estimate: {
            teachers: e.teachers,
            billing: e.billing,
            includeParentCalls: e.includeParentCalls,
            students: e.students,
            callsPerStudentPerYear: e.callsPerStudentPerYear,
            avgMinutesPerCall: e.avgMinutesPerCall,
            totalPerYearInclGst: computed.totalPerYearInclGst,
        },
        status: 'new',
        createdAt: now,
        updatedAt: now,
        ipHash,
    });
    return ref.id;
}

export function isQuoteStatus(value: unknown): value is QuoteStatus {
    return typeof value === 'string' && (QUOTE_STATUSES as readonly string[]).includes(value);
}

function toView(id: string, data: Record<string, unknown>): QuoteView {
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const est = (data.estimate ?? {}) as Record<string, unknown>;
    return {
        id,
        schoolName: str(data.schoolName),
        contactName: str(data.contactName),
        role: str(data.role),
        email: str(data.email),
        phone: str(data.phone),
        board: strOrNull(data.board),
        affiliationNumber: strOrNull(data.affiliationNumber),
        city: str(data.city),
        state: str(data.state),
        estimate: {
            teachers: num(est.teachers),
            billing: est.billing === 'monthly' ? 'monthly' : 'annual',
            includeParentCalls: est.includeParentCalls === true,
            students: num(est.students),
            callsPerStudentPerYear: num(est.callsPerStudentPerYear),
            avgMinutesPerCall: num(est.avgMinutesPerCall),
            totalPerYearInclGst: num(est.totalPerYearInclGst),
        },
        status: isQuoteStatus(data.status) ? data.status : 'new',
        createdAt: toIso(data.createdAt),
    };
}

/**
 * Newest first. With a status filter this needs the (status ASC, createdAt
 * DESC) composite index. The IP hash is never returned.
 */
export async function listQuoteRequests(status: QuoteStatus | null, limit = 100): Promise<QuoteView[]> {
    const db = await getDb();
    const base = db.collection(QUOTE_REQUESTS_COLLECTION);
    const query = status ? base.where('status', '==', status) : base;
    const snap = await query.orderBy('createdAt', 'desc').limit(Math.min(Math.max(limit, 1), 200)).get();
    return snap.docs.map((d) => toView(d.id, d.data() as Record<string, unknown>));
}

export async function updateQuoteStatus(id: string, status: QuoteStatus, actor: string): Promise<void> {
    const db = await getDb();
    const ref = db.collection(QUOTE_REQUESTS_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new AccessHttpError(404, 'Quote request not found');
    await ref.update({ status, updatedAt: new Date(), updatedBy: actor });
}
