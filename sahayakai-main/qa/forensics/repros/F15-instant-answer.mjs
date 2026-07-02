#!/usr/bin/env node
// F15 Probe 1 — instant-answer native-script coverage per language.
// Run: ID_TOKEN=$(gcloud auth print-identity-token --impersonate-service-account=...) \
//      APP_CHECK_TOKEN=... BASE=http://localhost:3000 node F15-instant-answer.mjs
import process from 'node:process';
const BASE = process.env.BASE || 'http://localhost:3000';
const ID_TOKEN = process.env.ID_TOKEN;
const APP_CHECK = process.env.APP_CHECK_TOKEN;
if (!ID_TOKEN) { console.error('ID_TOKEN required'); process.exit(2); }

const langs = ['Hindi','Bengali','Tamil','Telugu','Marathi','Gujarati','Kannada','Malayalam','Punjabi','Odia'];
const scripts = {
  Hindi:/[ऀ-ॿ]/,Marathi:/[ऀ-ॿ]/,Bengali:/[ঀ-৿]/,Gujarati:/[઀-૿]/,Punjabi:/[਀-੿]/,
  Tamil:/[஀-௿]/,Telugu:/[ఀ-౿]/,Kannada:/[ಀ-೿]/,Malayalam:/[ഀ-ൿ]/,Odia:/[଀-୿]/
};

for (const lang of langs) {
  const body = JSON.stringify({ question:'What is photosynthesis?', language: lang });
  const res = await fetch(`${BASE}/api/ai/instant-answer`, {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${ID_TOKEN}`, ...(APP_CHECK?{'X-Firebase-AppCheck':APP_CHECK}:{})},
    body
  });
  const json = await res.json().catch(()=>({}));
  const text = json.answer || json.text || JSON.stringify(json);
  const total = [...text].filter(c=>/\S/.test(c)).length;
  const native = [...text].filter(c=>scripts[lang].test(c)).length;
  const pct = total ? (native/total*100).toFixed(1) : '0';
  console.log(`${lang.padEnd(10)} status=${res.status} native=${pct}% ${pct<90?'FAIL':'PASS'}`);
  await new Promise(r=>setTimeout(r,1000)); // 1 RPS
}
