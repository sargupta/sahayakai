/**
 * F6-14 fix verification: preferredLanguage lookup canonicalization.
 *
 * Previously NOTIFICATION_DICTS was indexed by the raw preferredLanguage
 * string, so 'hi' / 'Hindi' / 'HINDI' / 'hindi' would silently fall back to
 * English. resolveLanguage() + formatNotificationMessage() now normalize.
 */

import { formatNotificationMessage, resolveLanguage } from '@/lib/notifications/i18n';

describe('resolveLanguage', () => {
    const cases: [string, string | null | undefined, string | undefined][] = [
        ['canonical Hindi', 'Hindi', 'Hindi'],
        ['lower hindi', 'hindi', 'Hindi'],
        ['upper HINDI', 'HINDI', 'Hindi'],
        ['ISO hi', 'hi', 'Hindi'],
        ['ISO HI', 'HI', 'Hindi'],
        ['English variants', 'english', 'English'],
        ['en code', 'en', 'English'],
        ['Kannada code kn', 'kn', 'Kannada'],
        ['Bengali code bn', 'BN', 'Bengali'],
        ['unknown value', 'klingon', undefined],
        ['null', null, undefined],
        ['undefined', undefined, undefined],
        ['empty', '', undefined],
        ['whitespace', '   ', undefined],
    ];
    test.each(cases)('%s → %s', (_label, input, expected) => {
        expect(resolveLanguage(input as any)).toBe(expected);
    });
});

describe('formatNotificationMessage F6-14 normalization', () => {
    it('resolves "hi" to the Hindi template', () => {
        const out = formatNotificationMessage('group_post', 'hi', {
            name: 'Asha',
            group: 'Maths Bengaluru',
        });
        expect(out).toContain('Asha');
        expect(out).toContain('Maths Bengaluru');
        expect(out).toContain('पोस्ट');
    });

    it('resolves "HINDI" (upper) to the Hindi template', () => {
        const out = formatNotificationMessage('group_post', 'HINDI', {
            name: 'Asha',
            group: 'Group',
        });
        expect(out).toContain('पोस्ट');
    });

    it('falls back to English on unknown language', () => {
        const out = formatNotificationMessage('group_post', 'klingon', {
            name: 'Asha',
            group: 'Group',
        });
        expect(out).toBe('Asha posted in Group');
    });

    it('falls back to English on undefined', () => {
        const out = formatNotificationMessage('group_post_like', undefined, {
            name: 'Asha',
        });
        expect(out).toBe('Asha liked your post');
    });
});
