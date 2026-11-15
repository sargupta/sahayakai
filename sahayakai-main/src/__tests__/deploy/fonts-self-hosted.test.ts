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
import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';

const appDir = path.join(__dirname, '..', '..', 'app');
const layout = readFileSync(path.join(appDir, 'layout.tsx'), 'utf8');
const noto = readFileSync(path.join(appDir, 'noto-fonts.ts'), 'utf8');
const srcDir = path.join(appDir, '..');

/** Every .ts/.tsx file under src (tests excluded). */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__' || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

describe('fonts are self-hosted', () => {
  it('no source file fetches a font from Google at build time', () => {
    // Google intermittently serves extension-less font URLs that crash
    // next/font/google's loader, so no family may be loaded that way.
    const offenders = sourceFiles(srcDir).filter((f) => /from\s+['"]next\/font\/google['"]/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('points only at local woff2 files that exist', () => {
    const srcs = [...(layout + noto).matchAll(/src:\s*'(\.\/_fonts\/[^']+)'/g)].map((m) => m[1]);
    expect(srcs.length).toBeGreaterThanOrEqual(4 + 9 * 3);
    for (const rel of srcs) {
      const file = path.join(appDir, rel);
      expect(existsSync(file)).toBe(true);
      expect(readFileSync(file).subarray(0, 4).toString('latin1')).toBe('wOF2');
    }
  });

  it('still sets every font CSS variable the stylesheets use', () => {
    expect(layout).toMatch(/'--font-ui':/);
    expect(layout).toMatch(/'--font-display':/);
    expect(layout).toMatch(/<html[^>]*style=\{fontVars\}/);
    for (const script of ['devanagari', 'bengali', 'tamil', 'telugu', 'kannada', 'malayalam', 'gujarati', 'gurmukhi', 'oriya']) {
      expect(noto).toContain(`'--font-noto-${script}':`);
    }
  });

  it('lets no fallback outrank a later face of the same stack', () => {
    // A localFont fallback (Arial) has no unicode-range. If any face but the
    // last of a stack carries one, Arial wins before the latin-ext face.
    for (const first of ['instrument-latin.woff2', 'bricolage-latin.woff2']) {
      expect(layout).toMatch(new RegExp(`src: './_fonts/${first}',\\s*adjustFontFallback: false`));
    }
    const faces = (noto.match(/localFont\(/g) ?? []).length;
    const withoutFallback = (noto.match(/adjustFontFallback: false/g) ?? []).length;
    expect(withoutFallback).toBe(faces - 9); // exactly one fallback per family
    for (const m of noto.matchAll(/'--font-noto-\w+': `([^`]+)`/g)) {
      const last = m[1].split(', ').pop()!.replace(/[${}]|\.style\.fontFamily/g, '');
      expect(noto).toMatch(new RegExp(`const ${last} = localFont\\(\\{[^}]*?display: 'swap',\\n(?!  adjustFontFallback)`));
    }
  });

  it('keeps the rupee sign in the design face (latin-ext range covers U+20B9)', () => {
    expect(layout).toMatch(/U\+20AD-20C4/);
  });
});
