/**
 * SAHAYAKAI_FIRESTORE_DATABASE selects a named Firestore database for isolated
 * test stacks. Unset must mean the default database (production behaviour).
 */
// jest.setup mocks this module globally; this test needs the real helper.
jest.unmock('@/lib/firebase-admin');
jest.mock('@/lib/secrets', () => ({ getSecret: async () => '' }));

import { firestoreDatabaseId } from '@/lib/firebase-admin';

describe('firestoreDatabaseId', () => {
    it('is null (the default database) when unset, blank or "(default)"', () => {
        expect(firestoreDatabaseId({} as NodeJS.ProcessEnv)).toBeNull();
        expect(firestoreDatabaseId({ SAHAYAKAI_FIRESTORE_DATABASE: '  ' } as NodeJS.ProcessEnv)).toBeNull();
        expect(firestoreDatabaseId({ SAHAYAKAI_FIRESTORE_DATABASE: '(default)' } as NodeJS.ProcessEnv)).toBeNull();
    });

    it('returns the named database when set', () => {
        expect(firestoreDatabaseId({ SAHAYAKAI_FIRESTORE_DATABASE: 'parent-call-test' } as NodeJS.ProcessEnv)).toBe('parent-call-test');
    });
});
