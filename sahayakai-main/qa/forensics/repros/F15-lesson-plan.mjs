#!/usr/bin/env node
// F15 Probe 2 — lesson-plan native-script for Class 7 Math.
import process from 'node:process';
const BASE = process.env.BASE || 'http://localhost:3000';
const ID_TOKEN = process.env.ID_TOKEN;
if (!ID_TOKEN) { console.error('ID_TOKEN required'); process.exit(2); }
const langs = ['Hindi','Bengali','Tamil','Telugu','Marathi','Gujarati','Kannada','Malayalam','Punjabi','Odia'];
const topics = {
  Hindi:'भिन्न',Bengali:'ভগ্নাংশ',Tamil:'பின்னம்',Telugu:'భిన్నాలు',Marathi:'अपूर्णांक',
  Gujarati:'અપૂર્ણાંક',Kannada:'ಭಿನ್ನರಾಶಿಗಳು',Malayalam:'ഭിന്നസംഖ്യകൾ',Punjabi:'ਭਿੰਨ',Odia:'ଭଗ୍ନାଂଶ'
};
for (const lang of langs) {
  const body = JSON.stringify({ topic: topics[lang], grade:'7', subject:'Math', language: lang });
  const res = await fetch(`${BASE}/api/ai/lesson-plan`, {
    method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${ID_TOKEN}`}, body
  });
  console.log(`${lang.padEnd(10)} status=${res.status} bytes=${res.headers.get('content-length')}`);
  await new Promise(r=>setTimeout(r,1000));
}
