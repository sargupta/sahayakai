/**
 * Class gate: no emoji in translatable UI strings.
 *
 * The house rule is that the product interface carries no emoji. It is not
 * decoration policy — SahayakAI addresses schoolteachers in eleven Indian
 * languages, and an emoji is the one glyph in a string that no translator can
 * localise, no screen reader reads usefully, and no Indic font is guaranteed to
 * render. "Excellent work! 🎉" and "Well done 👍" reached production in the
 * assessment scanner as the top two rungs of a four-rung encouragement ladder
 * whose bottom two rungs had none, so the inconsistency shipped as well.
 *
 * Removing those two strings does not stop the third from being added, so the
 * gate scans the source of truth — every translatable literal and every locale
 * value — rather than a list someone remembers to update.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC = path.join(APP_ROOT, 'src');
const LOCALES = path.join(SRC, 'locales');

/**
 * Pictographs, dingbats, transport and map symbols, variation selectors, and
 * regional indicators. Deliberately does NOT include the Devanagari danda,
 * Indic punctuation, currency signs, or the arrows and box-drawing characters
 * some layouts legitimately use.
 */
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]/u;

/**
 * Strings allowed to keep a pictograph, each with the reason it is not
 * decoration. Adding an entry is a deliberate, reviewable act.
 */
const ALLOWED = new Map<string, string>([
  [
    'Made in Bharat 🇮🇳',
    'The flag is the content of this badge, not ornament on a sentence. Every locale already renders it, and replacing it with the word would change what the badge says.',
  ],
]);

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__' || entry === 'locales') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe('UI strings carry no emoji', () => {
  it('scans a meaningful number of source files', () => {
    // A gate that scans nothing passes forever.
    expect(sourceFiles(SRC).length).toBeGreaterThan(200);
    expect(readdirSync(LOCALES).filter((f) => f.endsWith('.json')).length).toBeGreaterThan(5);
  });

  it('has no emoji inside a translatable literal', () => {
    const offenders: string[] = [];
    // Matches a single- or double-quoted argument to t(, with no embedded quote
    // of the same kind, which covers every translatable literal in this codebase.
    // Written as a regex rather than spelled out in prose on purpose: the repo's
    // own key scanner reads a quoted literal after t( as a key, so writing the
    // pattern out registers this test file as a caller and invents a missing key.
    const CALL = /\bt\(\s*(['"])((?:(?!\1).)*)\1/gs;

    for (const file of sourceFiles(SRC)) {
      const body = readFileSync(file, 'utf8');
      for (const m of body.matchAll(CALL)) {
        const literal = m[2];
        if (EMOJI.test(literal) && !ALLOWED.has(literal)) {
          offenders.push(`${path.relative(APP_ROOT, file)}: t(${JSON.stringify(literal)})`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('has no emoji in any locale key or value', () => {
    const offenders: string[] = [];

    for (const file of readdirSync(LOCALES).filter((f) => f.endsWith('.json'))) {
      const dict = JSON.parse(readFileSync(path.join(LOCALES, file), 'utf8')) as Record<string, string>;
      for (const [key, value] of Object.entries(dict)) {
        if (ALLOWED.has(key)) continue;
        if (EMOJI.test(key)) offenders.push(`${file}: key ${JSON.stringify(key)}`);
        if (EMOJI.test(value)) offenders.push(`${file}: value for ${JSON.stringify(key)}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps every allowance justified', () => {
    for (const [literal, reason] of ALLOWED) {
      expect(EMOJI.test(literal)).toBe(true);
      expect(reason.length).toBeGreaterThan(40);
    }
  });
});
