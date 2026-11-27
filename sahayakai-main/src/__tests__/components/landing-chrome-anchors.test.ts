/**
 * Class gate for the founder-reported "can't click Product from /pricing" bug.
 *
 * WHAT HAPPENED
 * The shared marketing header (landing-nav.tsx) linked Product with
 * `href="#product"`. That section (`id="product"`) lives in
 * landing-pillar-strip.tsx, which only renders on the homepage (LandingPage).
 * The nav, however, also renders on /pricing and /school-pricing — pages that
 * have no #product element — so the bare same-page hash resolved to nothing and
 * the link did nothing. "Pricing" worked from everywhere only because it used
 * an absolute path (`/pricing`), not a same-page hash.
 *
 * WHAT THIS GATE CATCHES
 * Not "the Product link" specifically — the class is: shared marketing chrome
 * (the nav and footer, which appear on every marketing page) must not use a
 * bare same-page hash `href="#..."`, because it is dead on every page that
 * lacks that section. Cross-page anchors must be absolute (`/#section`) so they
 * navigate home and then scroll. A future dead nav/footer anchor fails here.
 */

import * as fs from 'fs';
import * as path from 'path';

const LANDING_DIR = path.resolve(__dirname, '../../components/landing');

// The chrome that renders on marketing SUB-pages (not just the homepage), so a
// same-page anchor is not guaranteed to have a target where the chrome appears.
const SHARED_CHROME = ['landing-nav.tsx', 'landing-footer.tsx', 'home/home-chrome.tsx'];

// Matches href="#..." / href='#...' but NOT href="/#..." (absolute cross-page).
const BARE_HASH_HREF = /href=\s*["'`]#[^"'`]*["'`]/g;

describe('Landing chrome anchors (class gate)', () => {
    it.each(SHARED_CHROME)('%s uses no bare same-page hash links (use /#section)', (file) => {
        const full = path.join(LANDING_DIR, file);
        const src = fs.readFileSync(full, 'utf8');
        const offenders = src.match(BARE_HASH_HREF) ?? [];
        expect(offenders).toEqual([]);
    });
});

/**
 * Second half of the class (2026-11-27, homepage v1): an absolute anchor
 * "/#section" is only alive while the homepage still has that section. When
 * the homepage was replaced, "/#product" in the shared nav pointed at a
 * section that no longer existed. Every "/#id" link in the app must name an
 * id the homepage renders.
 */
describe('Absolute homepage anchors point at real homepage sections (class gate)', () => {
    const SRC = path.resolve(__dirname, '../..');
    const HOME_DIR = path.join(SRC, 'components/landing/home');
    const homeSource = fs
        .readdirSync(HOME_DIR)
        .filter((f) => f.endsWith('.tsx'))
        .map((f) => fs.readFileSync(path.join(HOME_DIR, f), 'utf8'))
        .join('\n');
    const homeIds = new Set([...homeSource.matchAll(/\bid="([\w-]+)"/g)].map((m) => m[1]));

    function walk(dir: string): string[] {
        return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
            return /\.tsx?$/.test(e.name) ? [p] : [];
        });
    }

    it('every "/#id" link targets an id on the homepage', () => {
        const offenders: string[] = [];
        for (const file of walk(SRC)) {
            const src = fs.readFileSync(file, 'utf8');
            for (const m of src.matchAll(/href=\{?\s*["'`]\/#([\w-]+)["'`]/g)) {
                if (!homeIds.has(m[1])) offenders.push(`${path.relative(SRC, file)}: /#${m[1]}`);
            }
        }
        expect(homeIds.size).toBeGreaterThan(3);
        expect(offenders).toEqual([]);
    });
});
