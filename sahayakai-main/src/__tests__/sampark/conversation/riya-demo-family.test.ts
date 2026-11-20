/** @jest-environment node */
/**
 * The emulator demo family is eligible for a Riya PRACTICE call, and can never reach a real
 * phone: synthetic number, and a real-carrier gate refuses it.
 */

import { RIYA_DEMO_PHONE, riyaDemoFamily } from '../../../../scripts/sampark/riya-demo-family';
import { createMemoryConversationRepo } from '@/lib/sampark/conversation/repo';
import { classifyPhone, encryptPhone, hashPhone } from '@/lib/sampark/phone';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { previewRiyaCall } from '@/server/sampark/conversation';

import { school, testClock } from '../engine/_fixtures';
import { setPhoneEnv } from '../server/_helpers';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const ORG = 'hillview-demo';

async function previewIn(mode: 'practice' | 'test') {
    setPhoneEnv();
    const repo = createMemorySamparkRepo();
    await repo.upsertSchool(school({ mode, ...(mode === 'test' ? { testPhoneEnc: encryptPhone('+919800000001'), testPhoneHash: hashPhone('+919800000001'), testPhoneLast4: '0001' } : {}) }));
    const fam = riyaDemoFamily(ORG, '2026-10-01T00:00:00.000Z', { encrypt: encryptPhone, hash: hashPhone });
    await repo.upsertStudents(ORG, [fam.student]);
    await repo.upsertGuardians(ORG, [fam.guardian]);
    await repo.upsertPreferences([fam.preferences]);
    return previewRiyaCall(
        { repo, calls: createMemoryConversationRepo(), clock: testClock(new Date('2026-10-07T05:30:00Z')), env: { SAMPARK_ENABLED: 'true', SAMPARK_ELEVENLABS_ENABLED: 'true' } },
        ORG,
        { purpose: 'ptm_invitation', guardianId: fam.guardian.id, studentId: fam.student.id, facts: { purpose: 'ptm_invitation', date: '2026-10-10', time: { hour: 10, minute: 0 } } },
    );
}

describe('riya demo family', () => {
    it('uses a synthetic number', () => {
        expect(classifyPhone(RIYA_DEMO_PHONE)).toBe('synthetic');
    });
    it('is eligible for a Practice preview', async () => {
        const p = await previewIn('practice');
        expect(p.refusals).toEqual([]);
        expect(p.ok).toBe(true);
        expect(p.announcement).toContain('parent-teacher meeting');
    });
});
