import crypto from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';

/**
 * Abuse / cost gates for the public "Hear the Call" demo endpoint.
 *
 * The endpoint is unauthenticated and places real outbound phone calls, so
 * every request must pass ALL of these server-side gates atomically:
 *
 *   1. global daily cap   — hard spend ceiling (DEMO_CALL_DAILY_CAP, default 500)
 *   2. per-IP daily limit — scraper/loop protection (default 3/day)
 *   3. per-phone cooldown — one demo per number per 30 days (harassment +
 *                           repeat-cost protection)
 *
 * All three are enforced inside ONE Firestore transaction so concurrent
 * requests cannot slip past a cap (spec section 5; load test in section 10).
 *
 * Identifiers are stored only as SHA-256(value + pepper) — the collections
 * never hold raw phone numbers or IPs. The lead document stores the phone
 * AES-encrypted separately (see encryptPhone below).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Twilio call statuses the demo status callback accepts. */
export const DEMO_STATUSES = [
    'queued', 'initiated', 'ringing', 'in-progress', 'completed',
    'busy', 'failed', 'no-answer', 'canceled',
] as const;

export type GateRejection = 'daily_cap' | 'ip_limit' | 'phone_repeat';

export interface GateResult {
    ok: boolean;
    reason?: GateRejection;
    phoneHash: string;
    ipHash: string;
}

function pepper(): string {
    // Dev fallback keeps local runs working; production MUST set the env
    // (checked in the route, which 503s when unset in prod).
    return process.env.DEMO_CALL_PEPPER || 'dev-pepper-not-for-prod';
}

export function hashIdentifier(value: string): string {
    return crypto.createHash('sha256').update(`${value}${pepper()}`).digest('hex');
}

/** UTC day stamp — cap windows reset at 05:30 IST, acceptable for a spend ceiling. */
function dayStamp(now: Date): string {
    return now.toISOString().slice(0, 10).replace(/-/g, '');
}

function intEnv(name: string, fallback: number): number {
    const raw = Number.parseInt(process.env[name] ?? '', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/**
 * Atomically check all gates and, if they pass, reserve a call slot
 * (increment counters + stamp the phone cooldown). Reserving BEFORE the
 * Twilio API call means a provider failure "wastes" one slot for that
 * phone/IP/day — acceptable; the alternative (reserve after) lets a
 * request storm place unbounded calls while all of them see stale counts.
 */
export async function reserveDemoCallSlot(
    db: Firestore,
    phone: string,
    ip: string,
    now: Date = new Date(),
): Promise<GateResult> {
    const phoneHash = hashIdentifier(phone);
    const ipHash = hashIdentifier(ip);
    const day = dayStamp(now);

    const dailyCap = intEnv('DEMO_CALL_DAILY_CAP', 500);
    const ipLimit = intEnv('DEMO_CALL_IP_DAILY_LIMIT', 3);
    const cooldownMs = intEnv('DEMO_CALL_PHONE_COOLDOWN_DAYS', 30) * DAY_MS;

    const dailyRef = db.collection('demo_call_meta').doc(`daily-${day}`);
    const ipRef = db.collection('demo_call_meta').doc(`ip-${day}-${ipHash}`);
    const phoneRef = db.collection('demo_call_phones').doc(phoneHash);

    const reason = await db.runTransaction<GateRejection | null>(async (tx) => {
        const [dailySnap, ipSnap, phoneSnap] = await Promise.all([
            tx.get(dailyRef),
            tx.get(ipRef),
            tx.get(phoneRef),
        ]);

        const dailyCount = (dailySnap.data()?.count as number | undefined) ?? 0;
        if (dailyCount >= dailyCap) return 'daily_cap';

        const ipCount = (ipSnap.data()?.count as number | undefined) ?? 0;
        if (ipCount >= ipLimit) return 'ip_limit';

        const lastCalledAt = phoneSnap.data()?.lastCalledAt as string | undefined;
        if (lastCalledAt && now.getTime() - Date.parse(lastCalledAt) < cooldownMs) {
            return 'phone_repeat';
        }

        const nowIso = now.toISOString();
        tx.set(dailyRef, { count: dailyCount + 1, updatedAt: nowIso }, { merge: true });
        tx.set(ipRef, { count: ipCount + 1, updatedAt: nowIso }, { merge: true });
        tx.set(phoneRef, { lastCalledAt: nowIso }, { merge: true });
        return null;
    });

    return reason ? { ok: false, reason, phoneHash, ipHash } : { ok: true, phoneHash, ipHash };
}

// ── Phone-at-rest encryption ─────────────────────────────────────────────────
// AES-256-GCM with DEMO_CALL_ENC_KEY (base64, 32 bytes). Without the key we
// store only the last 4 digits — the lead is still useful for funnel counts,
// just not for WhatsApp follow-up. Never store plaintext.

export function encryptPhone(phone: string): { phoneEnc: string | null; phoneLast4: string } {
    const phoneLast4 = phone.slice(-4);
    const keyB64 = process.env.DEMO_CALL_ENC_KEY;
    if (!keyB64) return { phoneEnc: null, phoneLast4 };
    try {
        const key = Buffer.from(keyB64, 'base64');
        if (key.length !== 32) return { phoneEnc: null, phoneLast4 };
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const ct = Buffer.concat([cipher.update(phone, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return {
            phoneEnc: `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`,
            phoneLast4,
        };
    } catch {
        return { phoneEnc: null, phoneLast4 };
    }
}

/** Indian mobile only: +91 followed by a 6-9 leading 10-digit number. */
export function isValidIndianMobile(phone: string): boolean {
    return /^\+91[6-9]\d{9}$/.test(phone);
}

/**
 * Verify a Cloudflare Turnstile token. Fails CLOSED in production when the
 * secret is configured; when TURNSTILE_SECRET_KEY is unset the gate is
 * skipped (pre-provisioning soft launch, still covered by the other gates).
 */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) return true;
    if (!token) return false;
    try {
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ secret, response: token, remoteip: ip }).toString(),
        });
        if (!res.ok) return false;
        const data = (await res.json().catch(() => ({}))) as { success?: boolean };
        return data.success === true;
    } catch {
        return false;
    }
}
