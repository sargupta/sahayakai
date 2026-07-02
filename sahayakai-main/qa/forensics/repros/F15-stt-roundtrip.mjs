#!/usr/bin/env node
// F15 Probe 6 — TTS sample -> STT, verify normalizeIsoLang returns expected code.
// Generates audio via /api/tts then submits to /api/ai/voice-to-text.
import process from 'node:process';
const BASE = process.env.BASE || 'http://localhost:3000';
const ID_TOKEN = process.env.ID_TOKEN;
if (!ID_TOKEN) { console.error('ID_TOKEN required'); process.exit(2); }
const samples = {
  Hindi:['प्रकाश संश्लेषण','hi'],Bengali:['সালোকসংশ্লেষ','bn'],Tamil:['ஒளிச்சேர்க்கை','ta'],
  Telugu:['కిరణజన్య సంయోగక్రియ','te'],Marathi:['प्रकाशसंश्लेषण','mr'],Gujarati:['પ્રકાશસંશ્લેષણ','gu'],
  Kannada:['ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ','kn'],Malayalam:['പ്രകാശസംശ്ലേഷണം','ml'],
  Punjabi:['ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ','pa'],Odia:['ଆଲୋକ ସଂଶ୍ଳେଷଣ','or']
};
for (const [lang,[text,iso]] of Object.entries(samples)) {
  const tts = await fetch(`${BASE}/api/tts`, {
    method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${ID_TOKEN}`},
    body: JSON.stringify({ text })
  });
  const audio = await tts.arrayBuffer();
  const fd = new FormData();
  fd.append('audio', new Blob([audio], {type:'audio/mp3'}), `${iso}.mp3`);
  fd.append('expectedLanguage', iso);
  const stt = await fetch(`${BASE}/api/ai/voice-to-text`, {
    method:'POST', headers:{'Authorization':`Bearer ${ID_TOKEN}`}, body: fd
  });
  const json = await stt.json().catch(()=>({}));
  const ok = json.language === iso;
  console.log(`${lang.padEnd(10)} expected=${iso} got=${json.language} ${ok?'PASS':'FAIL'} text="${(json.text||'').slice(0,40)}"`);
  await new Promise(r=>setTimeout(r,1500));
}
