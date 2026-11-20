import { isContentId, resolveContentId } from '@/lib/content-id';

describe('content-id', () => {
    it('accepts a well-formed UUID and returns it unchanged', () => {
        const id = '6f1c2d3e-4b5a-4c6d-8e7f-0123456789ab';
        expect(isContentId(id)).toBe(true);
        expect(resolveContentId(id)).toBe(id);
    });

    it.each([undefined, null, '', 'saved_abc_123', '../../users/x', 42, '6f1c2d3e4b5a4c6d8e7f0123456789ab'])(
        'mints a fresh UUID for %p',
        (candidate) => {
            expect(isContentId(candidate)).toBe(false);
            const out = resolveContentId(candidate);
            expect(isContentId(out)).toBe(true);
            expect(out).not.toBe(candidate);
        },
    );
});
