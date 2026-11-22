import { createHash } from 'crypto';
import { NextResponse } from 'next/server';

/**
 * Do-not-call suppression.
 *
 * When a parent says on a call that they do not want to be called again, the
 * telephony bridge (`_persist_opt_out`) writes `call_suppressions/{id}`. Every
 * route that can place a parent call MUST run `refuseIfParentOptedOut` before
 * it contacts any provider.
 *
 * Keyed by phone, not student: siblings share a parent's number, and a new
 * outreach doc must not erase the parent's "no".
 *
 * The id was a plain sha256 of the E.164 number. Indian mobile numbers are only
 * about 10^10 values, so anyone holding the list could recover every number. New
 * entries use the keyed form: sha256 of "<E.164>|<SAMPARK_PHONE_PEPPER>", the
 * same hash as Sampark's own `hashPhone` (`lib/sampark/phone.ts`). Both forms are
 * byte-identical to the bridge's `suppression.py`; a shared fixture pins them.
 *
 * Entries written before the change sit under the plain id, which cannot be
 * turned into the keyed one without the number. So a lookup checks both ids,
 * keyed first, and no recorded "no" is lost.
 */

export const SUPPRESSION_COLLECTION = 'call_suppressions';
export const PARENT_OPTED_OUT_CODE = 'PARENT_OPTED_OUT';

function pepper(): string | null {
    const value = process.env.SAMPARK_PHONE_PEPPER?.trim();
    return value ? value : null;
}

/** The old, unkeyed id. Read only: kept so entries written before the change are still found. */
export function legacyPhoneSuppressionId(e164: string): string {
    return createHash('sha256').update(e164.trim(), 'utf8').digest('hex');
}

/** sha256 hex of "<E.164>|<pepper>", identical to Sampark's `hashPhone`. */
export function keyedPhoneSuppressionId(e164: string, phonePepper: string): string {
    return createHash('sha256').update(`${e164.trim()}|${phonePepper}`, 'utf8').digest('hex');
}

/** Every id an opt-out for this number may sit under: keyed first (when configured), then the old one. */
export function phoneSuppressionIds(e164: string): string[] {
    const p = pepper();
    return [...(p ? [keyedPhoneSuppressionId(e164, p)] : []), legacyPhoneSuppressionId(e164)];
}

export async function isParentOptedOut(
    db: FirebaseFirestore.Firestore,
    e164: string,
): Promise<boolean> {
    for (const id of phoneSuppressionIds(e164)) {
        const snap = await db.collection(SUPPRESSION_COLLECTION).doc(id).get();
        if (snap.exists) return true;
    }
    return false;
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
