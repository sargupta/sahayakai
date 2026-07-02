#!/usr/bin/env node
// F15 — Probe 7: Dictionary completeness per language
// Static analysis of language-context.tsx dictionary.
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../../../src/context/language-context.tsx', import.meta.url), 'utf8');
const langs = ['English','Hindi','Kannada','Tamil','Telugu','Marathi','Bengali','Gujarati','Punjabi','Malayalam','Odia'];

// crude entry counter: count `"<Lang>":` occurrences inside dictionary literal
const start = src.indexOf('const dictionary');
const end = src.indexOf('\n};\n', start);
const body = src.slice(start, end > 0 ? end : src.length);
const counts = {};
for (const l of langs) {
  const re = new RegExp('"' + l + '"\\s*:', 'g');
  counts[l] = (body.match(re) || []).length;
}
const enCount = counts.English;
const report = {};
for (const l of langs) {
  const c = counts[l];
  const pctMissing = enCount ? ((enCount - c) / enCount * 100).toFixed(1) : 'n/a';
  report[l] = { entries: c, missingVsEn: enCount - c, pctMissing: pctMissing + '%' };
}
console.log(JSON.stringify({ enCount, report }, null, 2));
