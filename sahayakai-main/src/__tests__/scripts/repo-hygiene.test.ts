/**
 * Class gate for the recurring "cannot npm ci / cannot build" blocker.
 *
 * WHAT HAPPENED
 * `node_modules` was committed in 2edfd96fd as a mode-120000 symlink whose
 * target was its own absolute path — a self-referential link. `.gitignore`
 * already listed `node_modules/`, but gitignore does not apply to files git is
 * already tracking, so every clone and every branch switch restored the
 * circular link. Any `npm ci`, `jest`, or `next build` then died with
 * "Too many levels of symbolic links". Deleting it locally fixed one machine
 * until the next checkout put it back.
 *
 * WHAT THIS GATE CATCHES
 * Not "node_modules is untracked" alone — the class is: no dependency or build
 * output directory may be tracked, and no tracked symlink may point outside the
 * repo or at itself. Either mistake reproduces the same unbootstrappable
 * checkout, and neither is visible until someone tries a clean install.
 */

import { execFileSync } from 'child_process';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../..');

function git(...args: string[]): string {
    return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** Every tracked path, with its mode — `git ls-files --stage` output. */
function trackedEntries(): Array<{ mode: string; file: string }> {
    return git('ls-files', '--stage')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
            const [meta, file] = line.split('\t');
            return { mode: meta.split(' ')[0], file };
        });
}

describe('Repo hygiene (class gate)', () => {
    const entries = trackedEntries();

    // Directories that are generated, never authored. Tracking any of them
    // makes a fresh checkout disagree with a fresh install.
    const GENERATED = ['node_modules', '.next', 'out', 'dist', 'coverage', '.turbo'];

    it.each(GENERATED)('does not track %s', (dir) => {
        const tracked = entries.filter((e) => e.file === dir || e.file.startsWith(`${dir}/`));
        expect(tracked.map((e) => e.file)).toEqual([]);
    });

    it('tracks no symlink that escapes the repo or points at itself', () => {
        // Mode 120000 is a symlink; its blob content is the link target.
        const symlinks = entries.filter((e) => e.mode === '120000');

        const bad = symlinks.filter((link) => {
            const target = git('cat-file', '-p', `:${link.file}`).trim();
            if (path.isAbsolute(target)) return true; // absolute — machine-specific
            const resolved = path.resolve(REPO_ROOT, path.dirname(link.file), target);
            if (resolved === path.resolve(REPO_ROOT, link.file)) return true; // self-referential
            return !resolved.startsWith(REPO_ROOT); // escapes the repo
        });

        expect(bad.map((l) => l.file)).toEqual([]);
    });
});
