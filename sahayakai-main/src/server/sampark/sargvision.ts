/**
 * The Sargvision sample class for the demo frame: names and last four digits of the roster
 * contacts seeded in the local emulator (`seed-emulator.ts --sargvision`). Only on the local
 * emulator with the non-production database and SAMPARK_SARGVISION_ROSTER=true; everywhere else
 * the demo shows no Sargvision class. Full numbers never leave the server.
 */

import { logger } from '@/lib/logger';
import { hashPhone } from '@/lib/sampark/phone';
import { getSamparkRepo, SAMPARK_NONPROD_DATABASE } from '@/lib/sampark/repo/factory';
import { SARGVISION_ORG_ID, type SargvisionContact } from '@/lib/sampark/sargvision';

type Env = Record<string, string | undefined>;

export function sargvisionRosterEnabled(env: Env = process.env): boolean {
    return env.SAMPARK_SARGVISION_ROSTER === 'true'
        && Boolean(env.FIRESTORE_EMULATOR_HOST?.trim())
        && env.NODE_ENV !== 'production'
        && env.SAMPARK_FIRESTORE_DATABASE?.trim() === SAMPARK_NONPROD_DATABASE;
}

/** A Sargvision call really rings only in Test mode with live dialling on; Practice simulates it. */
export function sargvisionCallsRing(school: { mode: string } | null, env: Env = process.env): boolean {
    return school?.mode === 'test' && env.SAMPARK_LIVE_DIAL_ENABLED === 'true';
}

export async function loadSargvisionRoster(env: Env = process.env): Promise<SargvisionContact[]> {
    if (!sargvisionRosterEnabled(env)) return [];
    try {
        const repo = await getSamparkRepo();
        const [students, guardians, school] = await Promise.all([repo.listStudents(SARGVISION_ORG_ID), repo.listGuardians(SARGVISION_ORG_ID), repo.getSchool(SARGVISION_ORG_ID)]);
        // Practice (the launcher default) simulates every call; only Test mode with live dialling rings.
        const rings = sargvisionCallsRing(school, env);
        // Per contact: only a number on SAMPARK_RIYA_TEST_ALLOWED_NUMBERS can ring; the rest of the
        // class is shown but a call to them is refused, and the row must say so.
        const allowed = new Set((env.SAMPARK_RIYA_TEST_ALLOWED_NUMBERS ?? '').split(',').map((n) => n.replace(/\s+/g, '').trim()).filter(Boolean).map((n) => hashPhone(n)));
        const byId = new Map(guardians.filter((g) => g.active).map((g) => [g.id, g]));
        return students
            .filter((s) => s.active)
            .flatMap((s) => {
                const g = byId.get(s.primaryGuardianIds?.[0] ?? '');
                if (!g) return [];
                const onList = allowed.has(g.phoneHash);
                return [{ studentId: s.id, guardianId: g.id, name: s.displayName, phoneLast4: g.phoneLast4, realCall: rings && onList, notAllowListed: rings && !onList }];
            })
            .sort((a, b) => a.studentId.localeCompare(b.studentId));
    } catch (err) {
        logger.warn('Sargvision roster unavailable', 'SAMPARK_SARGVISION', { error: err instanceof Error ? err.message : String(err) });
        return [];
    }
}
