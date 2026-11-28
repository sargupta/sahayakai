/** Pure helpers in src/lib/api/access.ts used by the access-flow screens. */

let tokenClaims: Record<string, unknown> | null = null;
jest.mock('@/lib/firebase', () => ({
    auth: {
        get currentUser() {
            return tokenClaims
                ? { getIdToken: async () => 'tok', getIdTokenResult: async () => ({ claims: tokenClaims }) }
                : null;
        },
    },
}));

import {
    claimAutoRedirect,
    normalizePhone,
    resolveExitFromAccessFlow,
    serverErrorCode,
    serverErrorText,
    tokenIsEntitled,
    extractJoinCode,
    getAccessMode,
    isValidEmail,
    isValidIndianPhone,
    validateAccessRequest,
} from '@/lib/api/access';

describe('extractJoinCode', () => {
    it('accepts a bare code', () => {
        expect(extractJoinCode('  org123.AbCdEf-_012345  ')).toBe('org123.AbCdEf-_012345');
    });

    it('extracts the code from a full invitation URL', () => {
        expect(extractJoinCode('https://www.sahayakai.com/join/org123.tokenTOKEN99?utm=x#top')).toBe('org123.tokenTOKEN99');
        expect(extractJoinCode('https://www.sahayakai.com/join/org123.tokenTOKEN99/')).toBe('org123.tokenTOKEN99');
    });

    it('rejects empty, too-short and unsafe input', () => {
        expect(extractJoinCode('')).toBeNull();
        expect(extractJoinCode('abc')).toBeNull();
        expect(extractJoinCode('has spaces inside it')).toBeNull();
        expect(extractJoinCode('../../etc/passwd')).toBeNull();
        expect(extractJoinCode('https://evil.example/join/<script>alert(1)</script>')).toBeNull();
        expect(extractJoinCode('%E0%A4%A')).toBeNull();
    });
});

describe('isValidIndianPhone', () => {
    it.each(['9876543210', '+91 98765 43210', '098765-43210', '919876543210'])('accepts %s', (v) => {
        expect(isValidIndianPhone(v)).toBe(true);
    });
    it.each(['', '12345', '5876543210', '98765432101', 'abcdefghij'])('rejects %s', (v) => {
        expect(isValidIndianPhone(v)).toBe(false);
    });
});

describe('isValidEmail', () => {
    it('accepts a normal address and rejects malformed ones', () => {
        expect(isValidEmail(' principal@school.edu.in ')).toBe(true);
        expect(isValidEmail('principal@school')).toBe(false);
        expect(isValidEmail('not an email')).toBe(false);
    });
});

describe('validateAccessRequest', () => {
    const valid = {
        schoolName: 'Don Bosco School', role: 'Principal', board: 'CBSE', city: 'Siliguri',
        state: 'West Bengal', phone: '9876543210', teacherCount: '', acceptTerms: true,
    };

    it('passes a complete request', () => {
        expect(validateAccessRequest(valid)).toEqual([]);
    });

    it('reports each invalid field', () => {
        expect(
            validateAccessRequest({
                schoolName: 'ab', role: '', board: '', city: ' ', state: '', phone: '123', teacherCount: '0', acceptTerms: false,
            }),
        ).toEqual(['schoolName', 'role', 'board', 'city', 'state', 'phone', 'teacherCount', 'acceptTerms']);
    });

    it('treats teacher count as optional but validates it when given', () => {
        expect(validateAccessRequest({ ...valid, teacherCount: '45' })).toEqual([]);
        expect(validateAccessRequest({ ...valid, teacherCount: '4.5' })).toEqual(['teacherCount']);
    });
});

describe('getAccessMode', () => {
    it('returns the mode from the endpoint', async () => {
        (global as unknown as { fetch: unknown }).fetch = jest.fn(async () => ({ ok: true, json: async () => ({ mode: 'enforce' }) }));
        await expect(getAccessMode()).resolves.toBe('enforce');
    });

    it('falls back to off on failure or an unknown value', async () => {
        (global as unknown as { fetch: unknown }).fetch = jest.fn(async () => { throw new Error('offline'); });
        await expect(getAccessMode()).resolves.toBe('off');
        (global as unknown as { fetch: unknown }).fetch = jest.fn(async () => ({ ok: true, json: async () => ({ mode: 'wat' }) }));
        await expect(getAccessMode()).resolves.toBe('off');
        (global as unknown as { fetch: unknown }).fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) }));
        await expect(getAccessMode()).resolves.toBe('off');
    });
});

describe('normalizePhone', () => {
    it.each([
        ['(+91) 98765-43210', '+919876543210'],
        ['+91 98765 43210', '+919876543210'],
        ['919876543210', '+919876543210'],
        ['098765 43210', '9876543210'],
        ['(98765) 43210', '9876543210'],
        ['9876543210', '9876543210'],
    ])('reduces %s to %s', (input, expected) => {
        expect(normalizePhone(input)).toBe(expected);
    });

    it('always produces a value the server pattern accepts for a valid mobile', () => {
        // Same pattern as the zod schemas in src/lib/access/requests.ts and quotes.ts.
        const server = /^\+?[0-9][0-9\s()-]{5,18}[0-9]$/;
        for (const typed of ['(+91) 98765-43210', '(98765) 43210', '+91-98765-43210', '0 98765 43210']) {
            expect(isValidIndianPhone(typed)).toBe(true);
            const sent = normalizePhone(typed);
            expect(server.test(sent)).toBe(true);
            expect(sent.length).toBeLessThanOrEqual(20);
        }
    });

    it('rejects characters the server would not accept', () => {
        expect(isValidIndianPhone('98765.43210')).toBe(false);
        expect(isValidIndianPhone('98765 43210 ext 2')).toBe(false);
    });
});

describe('validateAccessRequest length caps', () => {
    const base = {
        schoolName: 'Don Bosco School', role: 'Principal', board: 'CBSE', city: 'Siliguri',
        state: 'West Bengal', phone: '9876543210', teacherCount: '', acceptTerms: true,
    };
    it('accepts a normal request', () => {
        expect(validateAccessRequest(base)).toEqual([]);
    });
    it('flags values longer than the server allows', () => {
        expect(validateAccessRequest({ ...base, schoolName: 'x'.repeat(161) })).toContain('schoolName');
        expect(validateAccessRequest({ ...base, city: 'x'.repeat(81) })).toContain('city');
    });
});

describe('server error helpers', () => {
    it('reads the error text and code from an ApiError-shaped object', () => {
        const err = { status: 400, message: 'm', body: { error: 'Invalid phone: Enter a valid phone number', code: 'VALIDATION_FAILED' } };
        expect(serverErrorText(err)).toBe('Invalid phone: Enter a valid phone number');
        expect(serverErrorCode(err)).toBe('VALIDATION_FAILED');
    });
    it('returns null for anything else', () => {
        expect(serverErrorText(new Error('network'))).toBeNull();
        expect(serverErrorText({ status: 500, body: {} })).toBeNull();
        expect(serverErrorCode(null)).toBeNull();
    });
});

describe('leaving the access flow', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    beforeEach(() => {
        tokenClaims = null;
        sessionStorage.clear();
        (global as unknown as { fetch: unknown }).fetch = jest.fn(async () => ({
            ok: true,
            json: async () => ({ exists: true, onboardingComplete: true }),
        }));
    });

    it('reads entitlement from the token the browser holds', async () => {
        expect(await tokenIsEntitled()).toBe(false); // signed out
        tokenClaims = { access: 'pending' };
        expect(await tokenIsEntitled()).toBe(false);
        tokenClaims = {};
        expect(await tokenIsEntitled()).toBe(false);
        tokenClaims = { access: 'pilot', accessExp: future };
        expect(await tokenIsEntitled()).toBe(true);
        tokenClaims = { access: 'pilot', accessExp: 1 };
        expect(await tokenIsEntitled()).toBe(false);
    });

    it('stays on the page when the gate is enforced and the token is not entitled', async () => {
        tokenClaims = { access: 'pending' };
        expect(await resolveExitFromAccessFlow('uid_1', 'enforce')).toBeNull();
        // ...and that refusal must not consume the one-shot redirect.
        expect(claimAutoRedirect()).toBe(true);
    });

    it('leaves once the token is entitled, to onboarding until the profile is complete', async () => {
        tokenClaims = { access: 'active' };
        expect(await resolveExitFromAccessFlow('uid_1', 'enforce')).toBe('/');
        sessionStorage.clear();
        (global as unknown as { fetch: unknown }).fetch = jest.fn(async () => ({
            ok: true,
            json: async () => ({ exists: true, onboardingComplete: false }),
        }));
        expect(await resolveExitFromAccessFlow('uid_1', 'enforce')).toBe('/onboarding');
    });

    it('does not require a claim while the gate is not enforced', async () => {
        tokenClaims = {};
        expect(await resolveExitFromAccessFlow('uid_1', 'off')).toBe('/');
    });

    it('never auto-redirects twice in quick succession (no bounce loop)', async () => {
        tokenClaims = { access: 'legacy' };
        expect(await resolveExitFromAccessFlow('uid_1', 'enforce')).toBe('/');
        expect(await resolveExitFromAccessFlow('uid_1', 'enforce')).toBeNull();
        // After the window has passed a redirect is allowed again.
        expect(claimAutoRedirect(Date.now() + 60_000)).toBe(true);
    });
});
