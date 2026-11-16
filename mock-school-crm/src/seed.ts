/**
 * `npm run seed`: (re)generate the deterministic seed data and overwrite the
 * state file, discarding demo-page changes and written-back communications.
 *
 *   npm run seed                          # seed hillview-demo-v1, anchored to 2026-09-30
 *   npm run seed -- --anchor=2026-10-12   # re-anchor "today" (attendance streaks, recency)
 *   npm run seed -- --seed=other --out=/tmp/state.json
 */

import { DEFAULT_ANCHOR_DATE, DEFAULT_SEED, generateState } from './generate';
import { DEFAULT_STATE_PATH, saveStateAtomic } from './store';

function arg(name: string): string | undefined {
    const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
    return hit?.slice(name.length + 3);
}

const seed = arg('seed') ?? DEFAULT_SEED;
const anchorDate = arg('anchor') ?? DEFAULT_ANCHOR_DATE;
const out = arg('out') ?? process.env.MOCK_CRM_STATE_PATH?.trim() ?? DEFAULT_STATE_PATH;

const state = generateState({ seed, anchorDate });
await saveStateAtomic(out, state);

const live = state.students.filter((s) => !s.deleted);
console.log(`[mock-school-crm] wrote ${out}`);
console.log(
    `  seed=${seed} anchor=${anchorDate}: ${live.length} students (+${state.students.length - live.length} tombstones), ` +
        `${state.guardians.length} guardians, ${state.hpcEntries.length} card entries, ${state.attendance.length} attendance marks, ` +
        `${state.assessments.length} assessment rows, ${state.events.length} events, ${state.meetings.length} meeting requests, ${state.incidents.length} incidents`,
);
