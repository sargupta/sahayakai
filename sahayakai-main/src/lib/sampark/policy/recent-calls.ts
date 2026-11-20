/**
 * The frequency cap's count (gate rule 14) across BOTH calling channels.
 *
 * A family hears from the school by recorded notice (sampark_calls) and by Riya
 * conversation (sampark_conversation_calls). The cap — FREQUENCY_CAP routine calls per
 * phone per FREQUENCY_WINDOW_MS — is about the family's phone, not about a channel, so
 * every place that feeds `recentCallsToPhone` into the gate counts both. Before this,
 * the Riya path counted notice calls but the notice dispatcher did not count Riya
 * calls, so a family could get four notices on top of four Riya calls in one month.
 *
 * The rule is the same on both sides: a simulated (Practice) call rang nobody, a test
 * call rang the school's own phone (it carries the test phone's hash), and emergency
 * purposes are exempt from the cap and never count towards it.
 */

import type { ConversationCallRepo } from '@/lib/sampark/conversation/repo';
import type { SamparkRepo } from '@/lib/sampark/ports';

export interface RoutineCallCounters {
    notice: Pick<SamparkRepo, 'countCallsToPhoneSince'>;
    conversation: Pick<ConversationCallRepo, 'countRealCallsToPhoneSince'>;
}

/**
 * A school with no Riya calls. For unit tests of the notice engine only: production wiring always
 * passes the real conversation repo (gate-cross-channel-frequency-cap checks the call sites).
 */
export const NO_CONVERSATION_CALLS: RoutineCallCounters['conversation'] = Object.freeze({
    countRealCallsToPhoneSince: async () => 0,
});

/** Routine (non-emergency) calls that could have rung this phone since `since`, on either channel. */
export async function countRoutineCallsToPhone(
    counters: RoutineCallCounters,
    orgId: string,
    phoneHash: string,
    since: Date,
): Promise<number> {
    const [notice, conversation] = await Promise.all([
        counters.notice.countCallsToPhoneSince(orgId, phoneHash, since, true),
        counters.conversation.countRealCallsToPhoneSince(orgId, phoneHash, since, true),
    ]);
    return notice + conversation;
}
