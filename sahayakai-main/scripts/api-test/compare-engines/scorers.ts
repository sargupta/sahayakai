/**
 * Diff scorers used by compare-engines/index.ts.
 *
 * Pure stdlib: term-frequency cosine, Unicode-block dominance for
 * language match, JSON shape match, length ratio. Avoids LaBSE so this
 * runs on a stock Node install with no Python sidecar required.
 */

const TOKEN_RE = /[\p{L}\p{N}]+/gu;

function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const m of text.toLowerCase().matchAll(TOKEN_RE)) out.push(m[0]);
  return out;
}

function tf(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

export function tfCosine(a: string, b: string): number {
  if (!a || !b) return 0;
  const ta = tf(tokenize(a));
  const tb = tf(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let dot = 0;
  for (const [tok, va] of ta) {
    const vb = tb.get(tok);
    if (vb) dot += va * vb;
  }
  let na = 0;
  for (const v of ta.values()) na += v * v;
  let nb = 0;
  for (const v of tb.values()) nb += v * v;
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

const LANG_TO_BLOCK: Record<string, RegExp> = {
  hi: /[ऀ-ॿ]/g, // Devanagari (also used by mr)
  mr: /[ऀ-ॿ]/g,
  bn: /[ঀ-৿]/g, // Bengali (also used by as)
  ta: /[஀-௿]/g,
  te: /[ఀ-౿]/g,
  kn: /[ಀ-೿]/g,
  ml: /[ഀ-ൿ]/g,
  gu: /[઀-૿]/g,
  pa: /[਀-੿]/g, // Gurmukhi
  or: /[଀-୿]/g,
  en: /[A-Za-z]/g,
};

/** Fraction of letters in `text` that fall in the expected Unicode block. */
export function languageMatch(text: string, lang: string): number {
  if (!text) return 0;
  const re = LANG_TO_BLOCK[lang];
  if (!re) return 0;
  const all = (text.match(/\p{L}/gu) ?? []).length;
  if (all === 0) return 0;
  const matched = (text.match(re) ?? []).length;
  return matched / all;
}

export function lengthRatio(genkit: string, sidecar: string): number {
  const a = genkit.length || 1;
  const b = sidecar.length || 1;
  return Math.min(a, b) / Math.max(a, b);
}

function collectKeys(value: unknown, prefix: string, out: Set<string>): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    if (value.length > 0) collectKeys(value[0], `${prefix}[]`, out);
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    out.add(path);
    collectKeys(v, path, out);
  }
}

export function shapeMatch(a: unknown, b: unknown): { jaccard: number; aOnly: string[]; bOnly: string[] } {
  const sa = new Set<string>();
  const sb = new Set<string>();
  collectKeys(a, '', sa);
  collectKeys(b, '', sb);
  const intersection = new Set<string>();
  for (const k of sa) if (sb.has(k)) intersection.add(k);
  const union = new Set<string>([...sa, ...sb]);
  const aOnly = [...sa].filter((k) => !sb.has(k));
  const bOnly = [...sb].filter((k) => !sa.has(k));
  const jaccard = union.size === 0 ? 1 : intersection.size / union.size;
  return { jaccard, aOnly, bOnly };
}

/** Extract a comparable text blob from any flow output. */
export function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || typeof value !== 'object') return '';
  const parts: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(value);
  return parts.join(' ');
}
