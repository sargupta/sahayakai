/**
 * A2 paging semantics (plan §2A). Pure.
 *
 * A same-day unexplained absence call asks: "1 = I know, my child is with me,
 * 2 = I did not know". v1 let anyone who answered close a possible missing-child
 * case by pressing 1; v2 does not:
 *
 *   - key 2, OR no answer at all (no answer, busy, failed, lost, or a pick-up
 *     with no key), PAGES the class teacher AND the principal immediately;
 *   - key 1 is recorded as a note for the teacher, nothing more;
 *   - a keypress NEVER writes an attendance or leave record: CBSE requires leave
 *     requests in writing, and a stranger's keypress is not one. There is no
 *     code path from a call outcome to an attendance write; `writesLeaveRecord`
 *     is the literal type `false`, and a class gate scans the tree for any
 *     attendance-write vocabulary.
 */

import { hashId } from '@/lib/sampark/intents';
import type { SamparkCall } from '@/types/sampark';

import type { Page, PageReason } from './types';

export interface PagingDecision {
    page: boolean;
    reason: PageReason | null;
    targets: ('class_teacher' | 'principal')[];
    /** Always false: a keypress is never an attendance or leave record. */
    writesLeaveRecord: false;
    /** What to tell the teacher, in plain words. */
    note: string;
}

export const PAGE_TARGETS: ('class_teacher' | 'principal')[] = ['class_teacher', 'principal'];

/** Decide, from a TERMINAL absence-today call, whether to page. Non-terminal calls decide nothing. */
export function pagingFor(call: Pick<SamparkCall, 'state' | 'outcome'>): PagingDecision {
    const none = (note: string): PagingDecision => ({ page: false, reason: null, targets: [], writesLeaveRecord: false, note });
    const terminal = ['completed', 'no_answer', 'busy', 'failed', 'unknown', 'cancelled'].includes(call.state);
    if (!terminal) return none('The call has not finished.');

    const digits = call.outcome.digits ?? '';
    if (digits.includes('2')) {
        return {
            page: true,
            reason: 'parent_said_did_not_know',
            targets: [...PAGE_TARGETS],
            writesLeaveRecord: false,
            note: 'The parent pressed 2: they did not know the child was absent. Please act now.',
        };
    }
    const reachedAndSaidWithMe = call.state === 'completed' && digits.includes('1');
    if (reachedAndSaidWithMe) {
        return none('The parent pressed 1 (the child is with them). This is a note only; it is not a leave record. Leave must still be sent in writing.');
    }
    return {
        page: true,
        reason: 'no_answer',
        targets: [...PAGE_TARGETS],
        writesLeaveRecord: false,
        note: 'The parent did not answer, or did not confirm. Please phone the family now.',
    };
}

/** One page per intent per reason, so a retry that also rings out does not page twice. */
export function pageIdFor(intentId: string, reason: PageReason): string {
    return hashId(`page:${intentId}:${reason}`);
}

export function buildPage(input: {
    orgId: string;
    proposalId: string | null;
    call: Pick<SamparkCall, 'id' | 'intentId'>;
    studentId: string;
    decision: PagingDecision;
    now: Date;
}): Page | null {
    if (!input.decision.page || !input.decision.reason) return null;
    const at = input.now.toISOString();
    return {
        id: pageIdFor(input.call.intentId, input.decision.reason),
        orgId: input.orgId,
        proposalId: input.proposalId,
        callId: input.call.id,
        studentId: input.studentId,
        reason: input.decision.reason,
        targets: input.decision.targets,
        status: 'open',
        acknowledgedBy: null,
        createdAt: at,
        updatedAt: at,
    };
}
