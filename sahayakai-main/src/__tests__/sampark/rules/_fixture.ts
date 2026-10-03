/**
 * Loads the mock CRM's exported fixtures (src/__tests__/fixtures/sampark) into the
 * shapes the rules read: SamparkStudent[] and CrmSignals. Anchor date 2026-09-30.
 * Not a test file (no `.test.`).
 */

import fs from 'node:fs';
import path from 'node:path';

import type { CrmStudent } from '@/lib/sampark/crm/schema';
import { CrmSignalsSchema, type CrmSignals } from '@/lib/sampark/rules/signals';
import type { Adoption, RuleId, ThresholdsByRule } from '@/lib/sampark/rules/types';
import { ADOPTION_STATEMENT_V1 } from '@/lib/sampark/rules/types';
import { DEFAULT_THRESHOLDS } from '@/lib/sampark/rules/thresholds';
import { languageFromCode } from '@/lib/sampark/languages';
import type { ParentLanguage, SamparkStudent } from '@/types/sampark';

export const ORG = 'hillview-demo';
export const ANCHOR = '2026-09-30';
/** Wednesday 2026-09-30 11:00 IST. */
export const ANCHOR_11_IST = new Date('2026-09-30T05:30:00Z');

const DIR = path.resolve(__dirname, '../../fixtures/sampark');

function readJson<T>(file: string): T {
    return JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8')) as T;
}

export function loadFixtureStudents(): SamparkStudent[] {
    return readJson<CrmStudent[]>('students.json')
        .filter((s) => !s.deleted)
        .map((s) => {
            const spoken: Partial<Record<ParentLanguage, string>> = {};
            for (const [code, name] of Object.entries(s.spokenFirstName)) {
                const lang = languageFromCode(code);
                if (lang && name) spoken[lang] = name;
            }
            return {
                orgId: ORG,
                id: s.id,
                grade: s.grade,
                section: s.section,
                spokenFirstName: spoken,
                displayName: s.fullName,
                feeCategory: s.feeCategory,
                sensitiveFlags: s.sensitiveFlags,
                boarding: s.boarding,
                transportRoute: s.transportRoute,
                guardianIds: s.guardians.filter((g) => g.isGuardianOfRecord).map((g) => g.guardianId),
                active: s.status === 'active',
                crmUpdatedAt: s.updatedAt,
                importedAt: s.updatedAt,
            } satisfies SamparkStudent;
        });
}

export function loadFixtureSignals(): CrmSignals {
    return CrmSignalsSchema.parse(readJson<unknown>('signals.json'));
}

export function adoption<R extends RuleId>(ruleId: R, thresholds?: Partial<ThresholdsByRule[R]>, status: 'adopted' | 'withdrawn' = 'adopted', version = 1): Adoption {
    return {
        id: `${ruleId}__v${version}`,
        orgId: ORG,
        ruleId,
        version,
        status,
        thresholds: { ...DEFAULT_THRESHOLDS[ruleId], ...thresholds } as ThresholdsByRule[R],
        adoptedBy: 'principal-1',
        adopterName: 'The Principal',
        statementVersion: 'v1',
        adoptedAt: '2026-09-29T00:00:00.000Z',
    } as Adoption;
}

export const ALL_ADOPTED: Adoption[] = (['attendance_talk', 'absence_today', 'academic_talk', 'conduct_talk', 'recognition', 'fee_due', 'fee_overdue'] as RuleId[]).map((r) => adoption(r));

export { ADOPTION_STATEMENT_V1 };
