/**
 * CLASS GATE — Community never blocks its first paint on the slowest request.
 *
 * Founder report (2026-11-17): Community took ~7 s. The page awaited ensureUserGroups, then a
 * profile read, then six calls, and showed nothing until all six landed. The feed must start
 * immediately (not behind the auto-join) and the loading state must end when the FEED lands,
 * not when every panel has.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.join(process.cwd(), 'src/app/community/page.tsx'), 'utf8');
const effect = SRC.slice(SRC.indexOf('onAuthStateChanged(auth'), SRC.indexOf('return () => unsub();'));

it('does not await the auto-join (or anything) before starting the feed', () => {
    expect(effect).not.toMatch(/await\s+ensureUserGroupsAction\(/);
    expect(effect).not.toMatch(/await\s+getDoc\(/);
    const feedStart = effect.indexOf('loadFeed()');
    const ensure = effect.indexOf('ensureUserGroupsAction()');
    expect(feedStart).toBeGreaterThan(0);
    expect(feedStart).toBeLessThan(ensure);
});

it('first paint is tied to the feed, not to an allSettled of every panel', () => {
    expect(effect).toMatch(/loadFeed\(\)[^;]*\.finally\(\(\)\s*=>\s*setLoading\(false\)\)/);
    expect(effect).not.toMatch(/allSettled\(\[[^\]]*getUnifiedFeedAction/);
});
