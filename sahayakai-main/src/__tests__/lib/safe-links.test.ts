/**
 * CLASS GATE — user-generated links can never become script or off-app navigation.
 *
 * Bug: group-post attachments accepted any URL (rendered as <a href>, React does
 * not block `javascript:`), and a DM resource route like "/evil.example" turned
 * router.push(`/${route}`) into an open redirect. Both producers (API) and both
 * renderers (feed-post, message-bubble) now go through these two guards; the
 * static check below fails if a renderer stops using them.
 */
import fs from 'fs';
import path from 'path';
import { isSafeAppRouteSlug, isSafeHttpsUrl } from '@/lib/security/safe-links';

describe('isSafeHttpsUrl', () => {
    it.each([
        ['https://example.org/x', true],
        ['javascript:alert(1)', false],
        ['JAVASCRIPT:alert(1)', false],
        [' javascript:alert(1)', false],
        ['data:text/html,<script>1</script>', false],
        ['http://example.org', false],
        ['//evil.example', false],
        ['/my-library', false],
        [undefined, false],
        ['https://' + 'a'.repeat(2050), false],
    ])('%s → %s', (v, ok) => expect(isSafeHttpsUrl(v)).toBe(ok));
});

describe('isSafeAppRouteSlug', () => {
    it.each([
        ['lesson-planner', true],
        ['quiz-generator', true],
        ['/evil.example', false],
        ['evil.example', false],
        ['..', false],
        ['', false],
        ['a/b', false],
        [42, false],
    ])('%s → %s', (v, ok) => expect(isSafeAppRouteSlug(v)).toBe(ok));
});

describe('renderers use the guards', () => {
    const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
    it('feed-post only links https URLs', () => {
        expect(read('src/components/community/feed-post.tsx')).toMatch(/isLink = attachment\.type === 'link' && isSafeHttpsUrl\(attachment\.url\)/);
    });
    it('message-bubble refuses a non-slug route before router.push', () => {
        const src = read('src/components/messages/message-bubble.tsx');
        const guard = src.indexOf('if (!isSafeAppRouteSlug(resource.route)) return;');
        const push = src.indexOf('router.push(`/${resource.route}');
        expect(guard).toBeGreaterThan(0);
        expect(push).toBeGreaterThan(guard);
    });
    it('the group-post API and the messages server validate the same way', () => {
        expect(read('src/app/api/groups/[groupId]/posts/route.ts')).toMatch(/refine\(isSafeHttpsUrl/);
        expect(read('src/server/messages.ts')).toMatch(/isSafeAppRouteSlug\(resource\.route\)/);
    });
});
