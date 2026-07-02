#!/usr/bin/env node
// F15 Probe 3 — /lesson-plan rendered HTML has no English fallback for chosen UI lang.
// Lightweight: curl + native-script ratio of body text after stripping tags.
import process from 'node:process';
const BASE = process.env.BASE || 'http://localhost:3000';
const langs = ['Hindi','Bengali','Tamil','Telugu','Marathi','Gujarati','Kannada','Malayalam','Punjabi','Odia'];
const scripts = {
  Hindi:/[ऀ-ॿ]/g,Marathi:/[ऀ-ॿ]/g,Bengali:/[ঀ-৿]/g,Gujarati:/[઀-૿]/g,Punjabi:/[਀-੿]/g,
  Tamil:/[஀-௿]/g,Telugu:/[ఀ-౿]/g,Kannada:/[ಀ-೿]/g,Malayalam:/[ഀ-ൿ]/g,Odia:/[଀-୿]/g
};
for (const lang of langs) {
  const res = await fetch(`${BASE}/lesson-plan`, { headers:{ Cookie:`sahayakai-lang=${lang}` } });
  const html = await res.text();
  const body = html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
  const native = (body.match(scripts[lang])||[]).length;
  console.log(`${lang.padEnd(10)} status=${res.status} nativeChars=${native}`);
  await new Promise(r=>setTimeout(r,500));
}
