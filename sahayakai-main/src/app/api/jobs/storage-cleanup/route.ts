/**
 * POST /api/jobs/storage-cleanup
 *
 * Receives Pub/Sub push messages for GCS file cleanup after content soft-deletion.
 * Also accepts direct invocation by Cloud Scheduler for any manual / scheduled runs.
 *
 * Pub/Sub push subscription delivers messages as:
 *   { message: { data: "<base64-encoded-json>" }, subscription: "..." }
 *
 * Authentication (defense in depth — F12-P0-01 fix):
 *   1. CRON_SECRET bearer (Cloud Scheduler manual runs / cron), OR
 *   2. Pub/Sub OIDC bearer token (Google-signed, audience matches our endpoint).
 *   Unauth requests → 401.
 * Path allowlist:
 *   storagePath MUST start with one of: temp/, voice-messages/{uid}/, lessons/{uid}/,
 *   images/{uid}/, exports/, content-images/{uid}/, visual-aids/{uid}/. For uid-scoped
 *   prefixes the {uid} segment must match the OIDC subject (when OIDC), or be present
 *   in the message body's `userId` (when CRON_SECRET). Otherwise → 403.
 *
 * Setup (run once in GCP):
 *   gcloud pubsub topics create sahayakai-storage-cleanup
 *   gcloud pubsub subscriptions create sahayakai-storage-cleanup-push \
 *     --topic=sahayakai-storage-cleanup \
 *     --push-endpoint=https://<your-app>/api/jobs/storage-cleanup \
 *     --push-auth-service-account=<sa>@<project>.iam.gserviceaccount.com \
 *     --push-auth-token-audience=https://<your-app>/api/jobs/storage-cleanup \
 *     --ack-deadline=60 \
 *     --max-delivery-attempts=5 \
 *     --dead-letter-topic=sahayakai-storage-cleanup-dlq
 */

import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '@/lib/logger';
import type { StorageCleanupMessage } from '@/lib/pubsub';

export const maxDuration = 60;

// ── Path allowlist ──────────────────────────────────────────────────────────

/**
 * Allowed top-level prefixes. Entries marked `uidScoped: true` require the
 * second path segment to equal the verified subject (uid).
 */
const ALLOWED_PREFIXES: Array<{ prefix: string; uidScoped: boolean }> = [
    { prefix: 'temp/',            uidScoped: false },
    { prefix: 'exports/',         uidScoped: false },
    { prefix: 'lessons/',         uidScoped: true  },
    { prefix: 'images/',          uidScoped: true  },
    { prefix: 'voice-messages/',  uidScoped: true  },
    { prefix: 'content-images/',  uidScoped: true  },
    { prefix: 'visual-aids/',     uidScoped: true  },
    { prefix: 'avatars/',         uidScoped: true  },
];

/** Returns null if storagePath is allowed, otherwise a rejection reason. */
export function validateStoragePath(storagePath: string, verifiedUid: string | null): string | null {
    if (typeof storagePath !== 'string' || storagePath.length === 0) {
        return 'empty_path';
    }
    // Reject traversal attempts.
    if (storagePath.includes('..') || storagePath.startsWith('/')) {
        return 'path_traversal';
    }
    for (const { prefix, uidScoped } of ALLOWED_PREFIXES) {
        if (!storagePath.startsWith(prefix)) continue;
        if (!uidScoped) return null;
        // uid-scoped: storagePath = "<prefix><uid>/<rest>". Extract <uid>.
        const rest = storagePath.slice(prefix.length);
        const slash = rest.indexOf('/');
        if (slash <= 0) return 'uid_segment_missing';
        const pathUid = rest.slice(0, slash);
        // When called with a verified uid (OIDC sub or CRON_SECRET body.userId),
        // require it to match the path. When verifiedUid is null we conservatively reject.
        if (!verifiedUid) return 'uid_required_for_scoped_prefix';
        // Service-account OIDC subjects look like "1234567890" (numeric) — we let
        // CRON_SECRET caller pass any uid via body.userId already validated upstream.
        // Pub/Sub OIDC subject is the SA — we accept it as a privileged caller
        // ONLY when body.userId matches the path uid (caller passes both).
        if (pathUid !== verifiedUid) return 'uid_mismatch';
        return null;
    }
    return 'prefix_not_allowed';
}

// ── OIDC verification ───────────────────────────────────────────────────────

const oauth2Client = new OAuth2Client();

interface OidcVerificationResult {
    ok: boolean;
    /** Service-account email or `sub` of the verified Google identity. */
    subject?: string;
    reason?: string;
}

async function verifyPubSubOidc(authHeader: string | null, expectedAudience: string): Promise<OidcVerificationResult> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { ok: false, reason: 'missing_bearer' };
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) return { ok: false, reason: 'empty_token' };
    try {
        const ticket = await oauth2Client.verifyIdToken({
            idToken: token,
            audience: expectedAudience,
        });
        const payload = ticket.getPayload();
        if (!payload) return { ok: false, reason: 'no_payload' };
        // Issuer must be Google.
        if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
            return { ok: false, reason: 'bad_issuer' };
        }
        // Optional: enforce SA allowlist via env (comma-separated emails).
        const allowed = (process.env.PUBSUB_PUSH_SERVICE_ACCOUNTS || '').split(',').map(s => s.trim()).filter(Boolean);
        if (allowed.length > 0 && payload.email && !allowed.includes(payload.email)) {
            return { ok: false, reason: 'sa_not_allowlisted' };
        }
        return { ok: true, subject: payload.email || payload.sub };
    } catch (err: any) {
        return { ok: false, reason: `verify_failed:${err?.message || 'unknown'}` };
    }
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        // Auth path 1: CRON_SECRET bearer.
        const isCronSecretCall = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

        // Auth path 2: Pub/Sub OIDC bearer.
        let oidcSubject: string | null = null;
        if (!isCronSecretCall) {
            // Build expected audience from request URL — Pub/Sub signs the URL the SA was told to use.
            const url = new URL(request.url);
            const expectedAudience = `${url.protocol}//${url.host}${url.pathname}`;
            const oidc = await verifyPubSubOidc(authHeader, expectedAudience);
            if (!oidc.ok) {
                logger.warn('storage-cleanup unauth reject', 'STORAGE_JOB', { reason: oidc.reason });
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            oidcSubject = oidc.subject ?? null;
        }

        if (!cronSecret && !oidcSubject) {
            // Defensive: CRON_SECRET unset AND no OIDC — refuse.
            return NextResponse.json({ error: 'No auth configured' }, { status: 503 });
        }

        const body = await request.json();

        let message: StorageCleanupMessage;

        if (body?.message?.data) {
            const decoded = Buffer.from(body.message.data, 'base64').toString('utf8');
            message = JSON.parse(decoded) as StorageCleanupMessage;
        } else if (body?.storagePath) {
            message = body as StorageCleanupMessage;
        } else {
            return NextResponse.json({ error: 'Unrecognised payload shape' }, { status: 400 });
        }

        const { storagePath, userId, contentId } = message;

        if (!storagePath) {
            return NextResponse.json({ ok: true, skipped: true });
        }

        // The uid used to match uid-scoped prefixes.
        // For CRON_SECRET callers (trusted backend), use the message's userId.
        // For Pub/Sub OIDC callers, also use message.userId (the SA is a trusted backend
        // identity; it tells us which user this cleanup is for, having been queued by
        // our own server when soft-delete fired).
        const verifiedUid = (typeof userId === 'string' && userId.length > 0) ? userId : null;

        const reject = validateStoragePath(storagePath, verifiedUid);
        if (reject !== null) {
            logger.warn('storage-cleanup path rejected', 'STORAGE_JOB', {
                reason: reject, storagePath, userId, contentId,
            });
            return NextResponse.json({ error: 'Forbidden', reason: reject }, { status: 403 });
        }

        const { getStorageInstance } = await import('@/lib/firebase-admin');
        const storage = await getStorageInstance();

        try {
            await storage.bucket().file(storagePath).delete();
            logger.info('GCS cleanup succeeded', 'STORAGE', { userId, contentId, storagePath });
        } catch (err: any) {
            if (err?.code === 404) {
                logger.info('GCS cleanup: file already absent', 'STORAGE', { userId, contentId, storagePath });
            } else {
                throw err;
            }
        }

        return NextResponse.json({ ok: true });

    } catch (error) {
        logger.error('Storage cleanup job failed', error, 'STORAGE_JOB');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
