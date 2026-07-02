#!/usr/bin/env node
// F15 — Probe 7b/9: placeholder detection + script-purity per language
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../../../src/context/language-context.tsx', import.meta.url), 'utf8');
const start = src.indexOf('const dictionary');
const end = src.indexOf('\n};\n', start);
const body = src.slice(start, end);

const entryRe = /"([^"\n]+)"\s*:\s*\{([^}]*)\}/g;
const langs = ['English','Hindi','Kannada','Tamil','Telugu','Marathi','Bengali','Gujarati','Punjabi','Malayalam','Odia'];
const scripts = {
  Hindi:     /[ऀ-ॿ]/,
  Marathi:   /[ऀ-ॿ]/,
  Bengali:   /[ঀ-৿]/,
  Gujarati:  /[઀-૿]/,
  Punjabi:   /[਀-੿]/,
  Tamil:     /[஀-௿]/,
  Telugu:    /[ఀ-౿]/,
  Kannada:   /[ಀ-೿]/,
  Malayalam: /[ഀ-ൿ]/,
  Odia:      /[଀-୿]/,
};

const stats = {};
for (const l of langs) stats[l] = { total:0, placeholderEqEn:0, hasNativeScript:0, empty:0 };

let m, entryCount = 0;
while ((m = entryRe.test(body) && entryRe.lastIndex && (entryRe.lastIndex = entryRe.lastIndex, m)) || (m = null) || (entryRe.lastIndex && false)) {}
entryRe.lastIndex = 0;
while ((m = entryRe.exec(body)) !== null) {
  const inner = m[2];
  const vals = {};
  const vre = /"(English|Hindi|Kannada|Tamil|Telugu|Marathi|Bengali|Gujarati|Punjabi|Malayalam|Odia)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let v;
  while ((v = vre.exec(inner)) !== null) vals[v[1]] = v[2];
  if (!vals.English) continue;
  entryCount++;
  for (const l of langs) {
    if (!(l in vals)) continue;
    stats[l].total++;
    const val = vals[l];
    if (val === '') stats[l].empty++;
    if (l !== 'English' && val === vals.English) stats[l].placeholderEqEn++;
    if (l !== 'English' && scripts[l] && scripts[l].test(val)) stats[l].hasNativeScript++;
  }
}

// summary: pct translated = hasNativeScript / total
const summary = {};
for (const l of langs) {
  const s = stats[l];
  if (l === 'English') { summary[l] = { ...s, pctNativeScript:'n/a', pctPlaceholder:'n/a' }; continue; }
  summary[l] = {
    ...s,
    pctNativeScript: s.total ? (s.hasNativeScript/s.total*100).toFixed(1)+'%' : 'n/a',
    pctPlaceholder:  s.total ? (s.placeholderEqEn/s.total*100).toFixed(1)+'%' : 'n/a',
  };
}
console.log(JSON.stringify({ entryCount, summary }, null, 2));
