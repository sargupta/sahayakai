/**
 * @jest-environment node
 *
 * GATE H6 (one call per number) — a class-wide campaign rings each family phone at
 * most once, and that one call names every child it covers.
 *
 * The bug class: Entab repeats a parent's mobile under a NEW guardian id for every
 * child, and lists both parents of record; the audience used to bundle by guardian
 * id, so a family with three children got three calls (six with the father) for the
 * same notice. The fix (audience.ts) calls the CRM's primary guardians first and then
 * merges bundles that share a phone. This gate proves the class on (a) a hand-built
 * Entab snapshot and (b) a seeded sweep of random Entab-shaped schools, checking:
 *   1. no two intents of a campaign share a phone;
 *   2. every reachable audience child is named on exactly one intent;
 *   3. an intent only names children whose guardian of record has that phone;
 *   4. a primary guardian of record, when active, is the only one called for a child;
 *   5. materialising again creates nothing (same representatives, same dedupe keys).
 */
import { bundleAudience, materialiseCampaignIntents } from '@/lib/sampark/audience';
import type { SamparkRepo } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { Intent, SamparkGuardian, SamparkStudent } from '@/types/sampark';

import { campaign, guardian, ORG, prefs, school, student, testClock } from './_fixtures';

const clock = testClock();

async function materialise(repo: SamparkRepo, students: SamparkStudent[], guardians: SamparkGuardian[]) {
    await repo.upsertSchool(school());
    await repo.upsertStudents(ORG, students);
    await repo.upsertGuardians(ORG, guardians);
    await repo.upsertPreferences(guardians.map((g) => prefs(g.id)));
    const c = campaign();
    await repo.createCampaign(c);
    const first = await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated');
    const again = await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated');
    return { first, again, intents: await repo.listIntentsByCampaign(ORG, c.id) };
}

/** The class invariants (header 1–5) for one snapshot. */
function assertOneCallPerNumber(
    students: SamparkStudent[],
    guardians: SamparkGuardian[],
    intents: Intent[],
    again: { created: number },
) {
    const byId = new Map(guardians.map((g) => [g.id, g]));
    const phoneOf = (guardianId: string) => byId.get(guardianId)!.phoneHash;

    // 1. One intent per phone.
    const phones = intents.map((i) => phoneOf(i.guardianId));
    expect(new Set(phones).size).toBe(phones.length);

    // The guardians each child should be reached through (of record both ways, active; primaries first).
    const chosenFor = (s: SamparkStudent) => {
        const ofRecord = s.guardianIds.map((id) => byId.get(id)).filter((g): g is SamparkGuardian => !!g && g.active && g.studentIds.includes(s.id));
        const primaries = ofRecord.filter((g) => (s.primaryGuardianIds ?? []).includes(g.id));
        return primaries.length > 0 ? primaries : ofRecord;
    };
    for (const s of students.filter((x) => x.active)) {
        const chosen = chosenFor(s);
        const naming = intents.filter((i) => i.studentIds.includes(s.id));
        if (chosen.length === 0) {
            expect(naming).toEqual([]);
            continue;
        }
        // 2. Named on an intent for each chosen PHONE, i.e. once when the parents share one number.
        const chosenPhones = new Set(chosen.map((g) => g.phoneHash));
        expect(naming.map((i) => phoneOf(i.guardianId)).sort()).toEqual([...chosenPhones].sort());
        // 4. Never through a non-primary guardian when a primary one is active.
        for (const i of naming) expect(chosenPhones.has(phoneOf(i.guardianId))).toBe(true);
    }

    // 3. Every child on an intent has a chosen guardian of record with the intent's phone.
    for (const i of intents) {
        for (const sid of i.studentIds) {
            const s = students.find((x) => x.id === sid)!;
            expect(chosenFor(s).some((g) => g.phoneHash === phoneOf(i.guardianId))).toBe(true);
        }
    }

    // 5. Idempotent.
    expect(again.created).toBe(0);
}

describe('gate h6 — one call per number per campaign', () => {
    /**
     * Entab-shaped school:
     *   Rai family: mother's mobile repeated as gR1, gR2, gR3 (one id per child, each primary);
     *               father's mobile as gRF1, gRF2 (not primary)                  → ONE call, three children.
     *   Lama family: both parents primary, different mobiles                      → one call per number.
     *   Das family:  imported before 7 Oct (no primary list): two ids, one mobile  → ONE call.
     *   Gurung family: the primary guardian is inactive; the other parent is used  → ONE call.
     */
    function entab() {
        const students = [
            student('rai-1', { guardianIds: ['gR1', 'gRF1'], primaryGuardianIds: ['gR1'] }),
            student('rai-2', { grade: 3, section: 'A', guardianIds: ['gR2', 'gRF2'], primaryGuardianIds: ['gR2'] }),
            student('rai-3', { grade: 9, section: 'C', guardianIds: ['gR3'], primaryGuardianIds: ['gR3'] }),
            student('lama-1', { guardianIds: ['gLM', 'gLF'], primaryGuardianIds: ['gLM', 'gLF'] }),
            student('das-1', { guardianIds: ['gD1'] }),
            student('das-2', { guardianIds: ['gD2'] }),
            student('gurung-1', { guardianIds: ['gG1', 'gG2'], primaryGuardianIds: ['gG1'] }),
        ];
        const guardians = [
            guardian('gR1', { studentIds: ['rai-1'], phoneHash: 'hash:rai-mother' }),
            guardian('gR2', { studentIds: ['rai-2'], phoneHash: 'hash:rai-mother' }),
            guardian('gR3', { studentIds: ['rai-3'], phoneHash: 'hash:rai-mother' }),
            guardian('gRF1', { studentIds: ['rai-1'], phoneHash: 'hash:rai-father', relation: 'father' }),
            guardian('gRF2', { studentIds: ['rai-2'], phoneHash: 'hash:rai-father', relation: 'father' }),
            guardian('gLM', { studentIds: ['lama-1'], phoneHash: 'hash:lama-mother' }),
            guardian('gLF', { studentIds: ['lama-1'], phoneHash: 'hash:lama-father', relation: 'father' }),
            guardian('gD1', { studentIds: ['das-1'], phoneHash: 'hash:das' }),
            guardian('gD2', { studentIds: ['das-2'], phoneHash: 'hash:das' }),
            guardian('gG1', { studentIds: ['gurung-1'], phoneHash: 'hash:gurung-1', active: false }),
            guardian('gG2', { studentIds: ['gurung-1'], phoneHash: 'hash:gurung-2', relation: 'father' }),
        ];
        return { students, guardians };
    }

    it('Entab data: exactly one intent per number, naming every child', async () => {
        const { students, guardians } = entab();
        const { first, again, intents } = await materialise(createMemorySamparkRepo(), students, guardians);
        const byGuardian = Object.fromEntries(intents.map((i) => [i.guardianId, i.studentIds]));
        expect(byGuardian).toEqual({
            gR1: ['rai-1', 'rai-2', 'rai-3'], // the representative: one child each, so the lowest id
            gLF: ['lama-1'],
            gLM: ['lama-1'],
            gD1: ['das-1', 'das-2'],
            gG2: ['gurung-1'],
        });
        expect(first).toMatchObject({ created: 5, blocked: {} });
        assertOneCallPerNumber(students, guardians, intents, again);
    });

    it('the representative is the guardian with the most children on that phone, ties to the lowest id', () => {
        const students = [
            student('a', { guardianIds: ['gZ'] }),
            student('b', { guardianIds: ['gZ'] }),
            student('c', { guardianIds: ['gA'] }),
        ];
        const guardians = [guardian('gZ', { studentIds: ['a', 'b'], phoneHash: 'hash:same' }), guardian('gA', { studentIds: ['c'], phoneHash: 'hash:same' })];
        const bundles = bundleAudience(campaign(), students, guardians);
        expect([...bundles.keys()]).toEqual(['gZ']);
        expect(bundles.get('gZ')!.students.map((s) => s.id)).toEqual(['a', 'b', 'c']);
        // The input order never changes the answer.
        expect([...bundleAudience(campaign(), [...students].reverse(), [...guardians].reverse()).keys()]).toEqual(['gZ']);
    });

    it('a section audience merges only the children in it', () => {
        const { students, guardians } = entab();
        const bundles = bundleAudience(campaign({ audience: { sections: [{ grade: 7, section: 'B' }] } }), students, guardians);
        expect(bundles.get('gR1')!.students.map((s) => s.id)).toEqual(['rai-1']);
    });

    it('class sweep: random Entab-shaped schools never get two calls on one number', async () => {
        // Deterministic PRNG (mulberry32) so a failure always reproduces.
        let seed = 0x5a3f1c;
        const rand = () => {
            seed = (seed + 0x6d2b79f5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

        for (let school_ = 0; school_ < 40; school_++) {
            const students: SamparkStudent[] = [];
            const guardians: SamparkGuardian[] = [];
            const families = 2 + Math.floor(rand() * 6);
            for (let f = 0; f < families; f++) {
                const children = 1 + Math.floor(rand() * 4);
                const parents = [`hash:s${school_}f${f}m`, `hash:s${school_}f${f}p`].slice(0, 1 + Math.floor(rand() * 2));
                const repeatIds = rand() < 0.7; // Entab: a new guardian id per child
                const legacy = rand() < 0.25; // imported before primaryGuardianIds existed
                for (let c = 0; c < children; c++) {
                    const sid = `s${school_}-f${f}-c${c}`;
                    const gids: string[] = [];
                    const primaries: string[] = [];
                    parents.forEach((phone, p) => {
                        const gid = repeatIds ? `g${school_}-f${f}-p${p}-c${c}` : `g${school_}-f${f}-p${p}`;
                        gids.push(gid);
                        if (p === 0 || rand() < 0.2) primaries.push(gid);
                        const existing = guardians.find((g) => g.id === gid);
                        if (existing) existing.studentIds.push(sid);
                        else guardians.push(guardian(gid, { studentIds: [sid], phoneHash: phone, active: rand() > 0.1 }));
                    });
                    students.push(
                        student(sid, {
                            grade: pick([3, 7]),
                            section: pick(['A', 'B']),
                            guardianIds: gids,
                            active: rand() > 0.05,
                            ...(legacy ? {} : { primaryGuardianIds: primaries }),
                        }),
                    );
                }
            }
            const { again, intents } = await materialise(createMemorySamparkRepo(), students, guardians);
            assertOneCallPerNumber(students, guardians, intents, again);
        }
    });
});
