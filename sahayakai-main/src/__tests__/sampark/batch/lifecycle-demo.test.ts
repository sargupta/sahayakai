/** @jest-environment node */
/**
 * Controlled local test batch, end to end, with mocked Vobiz: the brief's own timeline plus the
 * unhappy paths, every event delivered through the production handlers (Vobiz hangup callback,
 * signed bridge report, scheduler tick). Prints the timeline it observed (set BATCH_DEMO_OUT to also
 * write it to a file) and asserts it. Synthetic families and test-only numbers; nothing rings.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { writeFileSync } from 'node:fs';

import { holdsLine } from '@/lib/sampark/batch/schedule';
import { RIYA_VOBIZ_HARD_END_MS } from '@/lib/sampark/conversation/vobiz-provider';
import { actOnBatch, getBatch, runBatchTick } from '@/server/sampark/batch-calls';
import { _resetBatchWakeForTest } from '@/server/sampark/batch-wake';

import { ADMIN, bridgeEvent, createFrom, hangup, pad, setup, vobizScript, WED_11_IST, type Setup } from './_harness';

const T0 = WED_11_IST.getTime();

afterEach(() => {
    delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
    _resetBatchWakeForTest();
});

const mmss = (ms: number) => `${String(Math.floor(ms / 60_000)).padStart(2, '0')}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`;

it('a controlled 9-family batch follows the rolling rules through every lifecycle event', async () => {
    const script = vobizScript();
    const t: Setup = await setup({ count: 9, provider: 'vobiz-roster', concurrency: 3, script, env: { SAMPARK_BATCH_DIAL_GAP_SECONDS: '60' } });
    const rows: string[] = [];
    const seenCalls = new Set<string>();
    const familyOf = (callId: string) => Number([...t.calls.calls.values()].find((c) => c.id === callId)?.studentId.slice(1));
    const callOf = (n: number) => [...t.calls.calls.values()].filter((c) => c.studentId === `s${pad(n)}`).at(-1)!;
    const lines = () => [...t.calls.calls.values()].filter((c) => holdsLine(c, t.clock.now().getTime(), RIYA_VOBIZ_HARD_END_MS)).map((c) => familyOf(c.id)).sort((a, b) => a - b);
    let campaignId = '';
    const log = async (event: string) => {
        // Every launch since the last row is part of what happened at this moment.
        const launched = [...t.calls.calls.values()].filter((c) => !seenCalls.has(c.id));
        for (const c of launched) seenCalls.add(c.id);
        const launches = launched.map((c) => `F${familyOf(c.id)}${c.state === 'failed' ? ' refused' : ''}`).join(', ');
        const camp = campaignId ? (await getBatch(t.deps, t.org, ADMIN, campaignId)).campaign : null;
        const held = lines();
        rows.push(`| ${mmss(t.clock.now().getTime() - T0)} | ${event}${launches ? ` → launched ${launches}` : ''} | ${held.length}/3 (${held.map((n) => `F${n}`).join(' ') || '-'}) | ${camp ? `${camp.status}${camp.waitingReason ? ` · ${camp.waitingReason}` : ''}` : ''} |`);
        expect(held.length).toBeLessThanOrEqual(3);
    };
    const at = (s: number) => t.clock.set(new Date(T0 + s * 1000));
    const tick = async (s: number, label = 'scheduler tick') => { at(s); await runBatchTick(t.deps); await log(label); };

    at(0);
    campaignId = (await createFrom(t)).campaign.id;
    await log('teacher confirms the batch (9 families)');
    await tick(60);
    await tick(120);
    await tick(180, 'tick: all 3 lines busy, family 4 waits');
    at(210); await bridgeEvent(t, callOf(2).id); await log('F2 call completes (bridge report)');
    at(211); await bridgeEvent(t, callOf(2).id); await log('F2 report delivered AGAIN (duplicate)');
    at(270); await hangup(t, callOf(3).id, 'NO_ANSWER'); await log('F3 not answered (Vobiz hangup)');
    at(290); await hangup(t, callOf(1).id, 'USER_BUSY'); await log('F1 busy (Vobiz hangup)');
    await tick(330);
    script.next.push({ status: 429 });
    await tick(390, 'tick (mock Vobiz armed: next Make Call gets 429)');
    await tick(420);
    at(430); await bridgeEvent(t, callOf(4).id); await log('F4 call completes; the launch for F7 gets 429');
    await tick(450, 'tick during backoff (60 s from 07:10)');
    at(460); await actOnBatch(t.deps, t.org, ADMIN, campaignId, { action: 'pause' }); await log('teacher pauses');
    await tick(600, 'tick while paused');
    at(610); await bridgeEvent(t, callOf(5).id); await log('F5 completes while paused');
    at(620); await actOnBatch(t.deps, t.org, ADMIN, campaignId, { action: 'resume' }); await log('teacher resumes');
    for (let s = 630; s <= 1200; s += 30) {
        at(s);
        for (const c of [...t.calls.calls.values()]) {
            if (c.state === 'initiated' && t.clock.now().getTime() - Date.parse(c.createdAt) >= 100_000) {
                await bridgeEvent(t, c.id);
                await log(`F${familyOf(c.id)} call completes`);
            }
        }
        await runBatchTick(t.deps);
        if ([...t.calls.calls.values()].some((c) => !seenCalls.has(c.id))) await log('scheduler tick');
    }
    const final = (await getBatch(t.deps, t.org, ADMIN, campaignId)).campaign;
    rows.push(`| ${mmss(t.clock.now().getTime() - T0)} | end of run | ${lines().length}/3 | ${final.status} · completed ${final.progress.completed}, busy ${final.progress.busy}, no answer ${final.progress.noAnswer} |`);

    const table = ['| time | event | lines held | campaign |', '|---|---|---|---|', ...rows].join('\n');
    console.log(`\n${table}\n`);
    if (process.env.BATCH_DEMO_OUT) writeFileSync(process.env.BATCH_DEMO_OUT, `${table}\n`);

    // What the timeline must show.
    const dialMins = t.dials.map((d) => (d.at - T0) / 1000);
    expect(dialMins.slice(0, 4)).toEqual([0, 60, 120, 210]); // F4 the moment F2 freed a line (interval long passed)
    expect(final.status).toBe('completed');
    expect(final.progress).toMatchObject({ total: 9, completed: 7, busy: 1, noAnswer: 1, pending: 0, inProgress: 0 });
    // Exactly one placed (accepted) call per family; the 429 refusal never rang.
    const placed = [...t.calls.calls.values()].filter((c) => c.providerConversationId);
    expect(placed).toHaveLength(9);
    expect(new Set(placed.map((c) => c.studentId)).size).toBe(9);
});
