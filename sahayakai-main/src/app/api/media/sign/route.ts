/**
 * POST /api/media/sign — access-checked signed-URL minting for Storage media.
 *
 * H8 (docs/security/BUG_AUDIT_2026-07-02.md): voice DMs in Firebase Storage
 * were readable by ANY authenticated user (auth-wide `allow read` in
 * storage.rules + guessable `voice-messages/{uid}/{ts}` paths). The fix:
 *   - storage.rules now denies ALL client reads on voice-messages/** —
 *     playback is proxy-only via this route.
 *   - The client sends the bare storage path; this route authorizes the
 *     caller per media class, then returns a short-lived (10 min) V4 signed
 *     URL the <audio> element can fetch directly. (An <audio src> cannot
 *     carry the Bearer header, so streaming through an authed route doesn't
 *     work — signing after an explicit access check does.)
 *
 * Media classes and their access rules:
 *   voice-messages/{owner}/{conversationId}/{file}
 *       → owner, or any participant of {conversationId} (private DM audio).
 *   voice-messages/{owner}/{file}          (legacy pre-H8 layout, no conv id)
 *       → owner only. Recipients of legacy messages keep playing the
 *         token-bearing download URL already stored on the message doc.
 *   community-voice/{owner}/{file}
 *   users/{owner}/uploads/**, profile-photos/{owner}/**, uploads/{owner}/**
 *       → any authenticated user. These are shared-to-community BY INTENT
 *         (community chat audio, shared resources/lesson images, avatars) —
 *         auth-wide read is the designed behavior, documented here so the
 *         next audit doesn't flag it again.
 *   anything else → 403 (default-deny; the allowlist is the contract).
 *
 * Caller identity comes ONLY from the middleware-verified x-user-id header.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStorageInstance } from '@/lib/firebase-admin';
import { isConversationParticipant } from '@/server/messages';
import { unauthorizedResponse } from '@/server/api-error';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const SIGNED_URL_TTL_MS = 10 * 60 * 1000; // 10 minutes

const BodySchema = z.object({
    path: z.string().min(1).max(1024),
});

/**
 * Reject anything that could escape the allowlisted prefixes once handed to
 * GCS: traversal segments, absolute paths, backslashes, encoded separators,
 * empty segments, control characters.
 */
function isSafeStoragePath(path: string): boolean {
    if (path.startsWith('/') || path.includes('\\')) return false;
    if (path.includes('%')) return false;           // no encoded traversal tricks
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f]/.test(path)) return false;
    const segments = path.split('/');
    return segments.every((s) => s.length > 0 && s !== '.' && s !== '..');
}

type Decision = { allowed: true } | { allowed: false; status: 403 | 400 };

async function authorize(path: string, userId: string): Promise<Decision> {
    const segments = path.split('/');
    const [root] = segments;

    if (root === 'voice-messages') {
        // New layout: voice-messages/{owner}/{conversationId}/{file}
        if (segments.length === 4) {
            const [, owner, conversationId] = segments;
            if (owner === userId) return { allowed: true };
            const participant = await isConversationParticipant(conversationId, userId);
            return participant ? { allowed: true } : { allowed: false, status: 403 };
        }
        // Legacy layout: voice-messages/{owner}/{file} — no conversation id on
        // the path, so the only safe check is ownership.
        if (segments.length === 3) {
            const [, owner] = segments;
            return owner === userId ? { allowed: true } : { allowed: false, status: 403 };
        }
        return { allowed: false, status: 400 };
    }

    // Community-shared media: readable by any authenticated user by design
    // (see the media-class table in the file header).
    if (root === 'community-voice' && segments.length === 3) return { allowed: true };
    if (root === 'users' && segments.length >= 4 && segments[2] === 'uploads') return { allowed: true };
    if (root === 'profile-photos' && segments.length >= 3) return { allowed: true };
    if (root === 'uploads' && segments.length >= 3) return { allowed: true };

    return { allowed: false, status: 403 };
}

export async function POST(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const path = parsed.data.path;

    if (!isSafeStoragePath(path)) {
        return NextResponse.json({ error: 'Invalid media path' }, { status: 400 });
    }

    try {
        const decision = await authorize(path, userId);
        if (!decision.allowed) {
            return NextResponse.json(
                decision.status === 400
                    ? { error: 'Invalid media path' }
                    : { error: 'Forbidden' },
                { status: decision.status },
            );
        }

        const storage = await getStorageInstance();
        const expiresAt = Date.now() + SIGNED_URL_TTL_MS;
        const [url] = await storage.bucket().file(path).getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: expiresAt,
        });

        return NextResponse.json(
            { url, expiresAt },
            { headers: { 'Cache-Control': 'private, no-store' } },
        );
    } catch (err) {
        logger.error('Media sign failed', err, 'MEDIA', { userId, path });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
