/**
 * One outreach record = at most one dial.
 *
 * /api/attendance/call used to re-check only ownership, destination and opt-out,
 * so repeating the POST with the same outreachId (a double click, a retry loop
 * or a script) rang the same parent again every time. The client already makes
 * a NEW outreach record for every call, "Try again" included, so the server can
 * hold each record to a single dial: the first caller claims it inside a
 * transaction, before any provider is contacted; every later caller gets 409.
 */
import type { CallStatusDb } from './reconcile-call-status';

export type DialClaim = { ok: true } | { ok: false; reason: 'not_found' | 'already_dialled' };

export async function claimOutreachDial(db: CallStatusDb, outreachId: string, now: Date = new Date()): Promise<DialClaim> {
    const ref = db.collection('parent_outreach').doc(outreachId);
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return { ok: false, reason: 'not_found' } as const;
        const data = snap.data() ?? {};
        // `callSid` covers records dialled before this claim existed.
        if (data.dialClaimedAt || data.callSid) return { ok: false, reason: 'already_dialled' } as const;
        tx.update(ref, { dialClaimedAt: now.toISOString() });
        return { ok: true } as const;
    });
}
