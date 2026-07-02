#!/usr/bin/env node
// F15 Probe 5 — /api/tts returns 200 + audio body for each lang.
import process from 'node:process';
const BASE = process.env.BASE || 'http://localhost:3000';
const ID_TOKEN = process.env.ID_TOKEN;
if (!ID_TOKEN) { console.error('ID_TOKEN required'); process.exit(2); }
const samples = {
  Hindi:'प्रकाश संश्लेषण क्या है',Bengali:'সালোকসংশ্লেষ কী',Tamil:'ஒளிச்சேர்க்கை என்றால் என்ன',
  Telugu:'కిరణజన్య సంయోగక్రియ',Marathi:'प्रकाशसंश्लेषण म्हणजे काय',Gujarati:'પ્રકાશસંશ્લેષણ શું છે',
  Kannada:'ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಎಂದರೇನು',Malayalam:'പ്രകാശസംശ്ലേഷണം',Punjabi:'ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ',Odia:'ଆଲୋକ ସଂଶ୍ଳେଷଣ'
};
for (const [lang,text] of Object.entries(samples)) {
  const res = await fetch(`${BASE}/api/tts`, {
    method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${ID_TOKEN}`},
    body: JSON.stringify({ text })
  });
  const buf = await res.arrayBuffer().catch(()=>new ArrayBuffer(0));
  console.log(`${lang.padEnd(10)} status=${res.status} bytes=${buf.byteLength}`);
  await new Promise(r=>setTimeout(r,1000));
}
