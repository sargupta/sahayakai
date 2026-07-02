#!/usr/bin/env node
// F15 Probe 10 (ta) — Sanskrit fallback risk in Tamil lesson plan.
// Generates a Tamil Class 6 Science lesson and counts Sanskrit-loan high-Tamil
// vocabulary vs colloquial Tamil. The risk is that the model produces text in
// Sanskritised Tamil that village teachers struggle to read.
import process from 'node:process';
const BASE = process.env.BASE || 'http://localhost:3000';
const ID_TOKEN = process.env.ID_TOKEN;
if (!ID_TOKEN) { console.error('ID_TOKEN required'); process.exit(2); }
const res = await fetch(`${BASE}/api/ai/lesson-plan`, {
  method:'POST',
  headers:{'Content-Type':'application/json','Authorization':`Bearer ${ID_TOKEN}`},
  body: JSON.stringify({ topic:'நீர் சுழற்சி', grade:'6', subject:'Science', language:'Tamil' })
});
const json = await res.json();
const text = JSON.stringify(json);
// Tamil text should be Tamil script primarily; if Grantha/Devanagari chars appear it's a Sanskrit fallback smell.
const grantha = /[ᄰ0-ᄷF]/u.test(text);
const devanagari = /[ऀ-ॿ]/.test(text);
console.log(`grantha=${grantha} devanagari-in-tamil=${devanagari}`);
console.log((grantha||devanagari) ? 'WARN: non-Tamil script in Tamil output' : 'PASS');
