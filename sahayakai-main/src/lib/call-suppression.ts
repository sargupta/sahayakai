import { createHash } from 'crypto';
import { NextResponse } from 'next/server';

/**
 * Do-not-call suppression.
 *
 * When a parent says on a call that they do not want to be called again, the
 * telephony bridge (sahayakai-agents, `_persist_opt_out`) writes
 * `call_suppressions/{sha256(E.164)}`. Every route that can place a parent call
 * MUST run `refuseIfParentOptedOut` before it contacts any provider.
 *
 * Keyed by phone, not student: siblings share a parent's number, and a new
 * outreach doc must not erase the parent's "no".
 *
 * The id is sha256 (hex) of the E.164 string — identical to
 * `phone_suppression_id` in sahayakai-agents. The raw number is never a doc id.
 */

export const SUPPRESSION_COLLECTION = 'call_suppressions';
export const PARENT_OPTED_OUT_CODE = 'PARENT_OPTED_OUT';

export function phoneSuppressionId(e164: string): string {
    return createHash('sha256').update(e164.trim(), 'utf8').digest('hex');
}

export async function isParentOptedOut(
    db: FirebaseFirestore.Firestore,
    e164: string,
): Promise<boolean> {
    const snap = await db.collection(SUPPRESSION_COLLECTION).doc(phoneSuppressionId(e164)).get();
    return snap.exists;
}

/**
 * Returns a 409 response when this parent has opted out, otherwise null.
 * Callers return the response as-is.
 *
 * FAILS CLOSED: if the lookup itself errors we refuse rather than dial. Calling
 * someone who may have said no is worse than asking the teacher to retry.
 */
export async function refuseIfParentOptedOut(
    db: FirebaseFirestore.Firestore,
    e164: string,
): Promise<NextResponse | null> {
    let optedOut: boolean;
    try {
        optedOut = await isParentOptedOut(db, e164);
    } catch (e) {
        console.error('[call-suppression] lookup failed; refusing call (fail closed):', e);
        return NextResponse.json(
            {
                error: 'We could not check this parent\'s call preferences just now. Please try again in a minute.',
                code: 'SUPPRESSION_CHECK_FAILED',
                retryable: true,
            },
            { status: 503 },
        );
    }
    if (!optedOut) return null;
    return NextResponse.json(
        {
            error:
                'This parent asked not to be called again, so we have not placed the call. ' +
                'Please reach them another way, such as a WhatsApp message or a note home.',
            code: PARENT_OPTED_OUT_CODE,
        },
        { status: 409 },
    );
}
