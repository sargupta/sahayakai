/**
 * Class gate: the root layout's design fonts must build without the network.
 *
 * Cloud Build's Docker image builds failed on every attempt with
 * "An error occurred in `next/font` ... Cannot read properties of null
 * (reading '1')" because next/font/google fetches font CSS at build time and
 * could not parse what it got back. The design faces (Instrument Sans,
 * Bricolage Grotesque) are therefore committed as woff2 files and loaded
 * with next/font/local.
 *
 * This gate catches the class, not the instance:
 *  - the design families must not come back from next/font/google;
 *  - every local font file the layout points at must exist and be a woff2;
 *  - both design CSS variables must still be set on <html>.
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const appDir = path.join(__dirname, '..', '..', 'app');
const layout = readFileSync(path.join(appDir, 'layout.tsx'), 'utf8');

describe('root layout fonts are self-hosted', () => {
  it('does not fetch the design families from Google at build time', () => {
    const googleImport = layout.match(/import\s*\{([^}]*)\}\s*from\s*'next\/font\/google'/);
    const names = googleImport ? googleImport[1] : '';
    expect(names).not.toMatch(/Instrument_Sans|Bricolage_Grotesque/);
  });

  it('points only at local woff2 files that exist', () => {
    const srcs = [...layout.matchAll(/src:\s*'(\.\/_fonts\/[^']+)'/g)].map((m) => m[1]);
    expect(srcs.length).toBeGreaterThanOrEqual(4);
    for (const rel of srcs) {
      const file = path.join(appDir, rel);
      expect(existsSync(file)).toBe(true);
      const head = readFileSync(file).subarray(0, 4).toString('latin1');
      expect(head).toBe('wOF2');
    }
  });

  it('still sets --font-ui and --font-display on <html>', () => {
    expect(layout).toMatch(/'--font-ui':/);
    expect(layout).toMatch(/'--font-display':/);
    expect(layout).toMatch(/<html[^>]*style=\{designFontVars\}/);
  });

  it('keeps the rupee sign in the design face (latin-ext range covers U+20B9)', () => {
    expect(layout).toMatch(/U\+20AD-20C4/);
  });
});
