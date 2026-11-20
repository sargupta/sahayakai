/**
 * The webhook → scheduler wake-up, kept in its own module so the call reducer
 * (server/sampark/conversation.ts) never imports the batch orchestrator (which imports it).
 *
 * Why it exists: a slot is freed by the PROVIDER telling us a call ended, not by a timer. The
 * moment a batch call reaches a terminal state — completed, no answer, busy, failed, the carrier
 * reporting the line ended, or a reconciliation that confirms it ended — the campaign is advanced,
 * so the next family goes out as soon as the launch interval allows instead of waiting for the
 * next scheduler tick.
 *
 * A wake is never dropped:
 *   - a wake that arrives while THIS process is already advancing that campaign is remembered and
 *     the running pass goes round once more before it lets go (`takeRerun`);
 *   - a wake that finds ANOTHER worker holding the campaign lease leaves a flag on the campaign
 *     record, which that worker reads when it lets go (batch-calls.ts, advanceBatch).
 *
 * Timers: when a pass ends waiting for the launch interval or a rate-limit backoff, it arms one
 * in-process timer for exactly that moment (`armTimer`). Best effort — the periodic tick
 * (/api/jobs/sampark-dispatch) is the reconciliation half of the hybrid, covering lost webhooks,
 * crashed workers and processes that were stopped.
 */

import { logger } from '@/lib/logger';
import type { ConversationCall } from '@/lib/sampark/conversation/types';

export type BatchWaker = (deps: unknown, orgId: string, campaignId: string) => Promise<void>;

let waker: BatchWaker | null = null;
/** Campaigns this process is already advancing: a wake from inside a pass must not re-enter it. */
const advancing = new Set<string>();
/** Wakes that arrived during a pass in this process: the pass runs once more before letting go. */
const rerun = new Set<string>();
const timers = new Map<string, { at: number; handle: ReturnType<typeof setTimeout> }>();

const key = (orgId: string, campaignId: string) => `${orgId}/${campaignId}`;

export function registerBatchWaker(fn: BatchWaker): void {
    waker = fn;
}

export function markAdvancing(orgId: string, campaignId: string, on: boolean): void {
    if (on) advancing.add(key(orgId, campaignId));
    else advancing.delete(key(orgId, campaignId));
}

export function isAdvancing(orgId: string, campaignId: string): boolean {
    return advancing.has(key(orgId, campaignId));
}

/** True (once) when a wake arrived while this process was advancing the campaign. */
export function takeRerun(orgId: string, campaignId: string): boolean {
    return rerun.delete(key(orgId, campaignId));
}

/**
 * Advance the campaign a call belongs to, after that call released its line. Best effort: a
 * failure here never fails the webhook that freed the slot (the tick picks the campaign up).
 */
export async function wakeBatchForCall(deps: unknown, call: Pick<ConversationCall, 'orgId' | 'batch'>): Promise<void> {
    const campaignId = call.batch?.campaignId;
    if (!campaignId) return;
    await wakeBatch(deps, call.orgId, campaignId);
}

export async function wakeBatch(deps: unknown, orgId: string, campaignId: string): Promise<void> {
    if (isAdvancing(orgId, campaignId)) {
        // The pass that is running here goes round once more before it lets go: not dropped.
        rerun.add(key(orgId, campaignId));
        return;
    }
    try {
        if (!waker) await import('./batch-calls'); // registers the waker on first load
        await waker?.(deps, orgId, campaignId);
    } catch (err) {
        logger.warn('Batch wake-up failed', 'SAMPARK_BATCH', { orgId, campaignId, error: err instanceof Error ? err.message.slice(0, 120) : 'unknown' });
    }
}

/**
 * Arm (or move earlier) this process's timer for a campaign's next due moment. A later moment
 * than one already armed is ignored; the timer never keeps the process alive.
 */
export function armTimer(deps: unknown, orgId: string, campaignId: string, at: Date, nowMs: number = Date.now()): void {
    const k = key(orgId, campaignId);
    const due = at.getTime();
    const existing = timers.get(k);
    if (existing && existing.at <= due && existing.at > nowMs) return;
    if (existing) clearTimeout(existing.handle);
    const handle = setTimeout(() => {
        timers.delete(k);
        void wakeBatch(deps, orgId, campaignId);
    }, Math.max(0, due - nowMs) + 250);
    (handle as { unref?: () => void }).unref?.();
    timers.set(k, { at: due, handle });
}

/** Test helper: clear every armed timer and remembered wake. */
export function _resetBatchWakeForTest(): void {
    for (const t of timers.values()) clearTimeout(t.handle);
    timers.clear();
    rerun.clear();
    advancing.clear();
}
