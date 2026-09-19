/**
 * Vobiz ring + hangup webhooks — the call's progress, written back to Firestore.
 *
 * Gated by a `vobiz-status` token (see `lib/vobiz/tokens`), minted at dial time
 * with a deliberately long TTL because `hangup_url` fires when the call ENDS.
 *
 * Always answers 200. A provider that receives an error from a status callback
 * will retry it, and a retry storm on a call that has already ended helps
 * nobody; anything we could not record is logged instead.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { VOBIZ_DOMAINS, verifyVobizToken } from '@/lib/vobiz/tokens';
import type { CallStatus } from '@/types/attendance';

/**
 * Provider hangup causes -> our own vocabulary.
 *
 * Unmapped causes deliberately fall through to `completed` ONLY when the call
 * was actually answered; otherwise an unknown cause is recorded as `failed`, so
 * a new provider string can never quietly inflate the success rate.
 */
const HANGUP_CAUSE_MAP: Record<string, CallStatus> = {
    NORMAL_CLEARING: 'completed',
    ORIGINATOR_CANCEL: 'failed',
    USER_BUSY: 'busy',
    NO_ANSWER: 'no_answer',
    NO_USER_RESPONSE: 'no_answer',
    TIMEOUT: 'no_answer',
    CALL_REJECTED: 'failed',
    UNALLOCATED_NUMBER: 'failed',
    INVALID_NUMBER_FORMAT: 'failed',
};

export async function POST(req: NextRequest): Promise<NextResponse> {
    const url = new URL(req.url);
    const outreachId = await verifyVobizToken(VOBIZ_DOMAINS.STATUS, url.searchParams.get('t'));
    if (!outreachId) {
        logger.warn('Vobiz status webhook rejected — bad or expired token', 'ATTENDANCE');
        return new NextResponse('OK', { status: 200 });
    }

    const form = await req.formData().catch(() => null);
    const field = (name: string): string =>
        String(form?.get(name) ?? url.searchParams.get(name) ?? '');

    // `kind` is set by us when building the two callback URLs, so a ring event
    // is never mistaken for a hangup even if the provider reuses field names.
    const kind = url.searchParams.get('kind');

    const db = await getDb();
    const ref = db.collection('parent_outreach').doc(outreachId);

    if (kind === 'ring') {
        // Ringing is progress, not an outcome: it must not overwrite a terminal
        // status if events arrive out of order.
        await ref
            .update({ ringingAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
            .catch((e: unknown) =>
                logger.error('Vobiz ring: could not stamp record', e, 'ATTENDANCE', { outreachId }),
            );
        return new NextResponse('OK', { status: 200 });
    }

    const cause = field('HangupCause') || field('hangup_cause');
    const durationRaw = field('Duration') || field('duration');
    const duration = Number.parseInt(durationRaw, 10);
    const answered = Number.isFinite(duration) && duration > 0;

    const callStatus: CallStatus =
        HANGUP_CAUSE_MAP[cause.toUpperCase()] ?? (answered ? 'completed' : 'failed');

    await ref
        .update({
            callStatus,
            callDurationSeconds: Number.isFinite(duration) ? duration : null,
            vobizHangupCause: cause || null,
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })
        .catch((e: unknown) =>
            logger.error('Vobiz hangup: could not stamp record', e, 'ATTENDANCE', { outreachId }),
        );

    return new NextResponse('OK', { status: 200 });
}
