#!/usr/bin/env node
// F15 Probe 10 (bn) — Pongal-in-Bengali cross-cultural translation.
// Asks lesson-plan to write a Class 4 cultural-festival lesson for a Bengali-medium
// classroom and verifies the model substitutes Pongal -> a Bengali harvest concept
// (e.g. Poush Parbon / Nabanna) instead of literally writing about Pongal.
import process from 'node:process';
const BASE = process.env.BASE || 'http://localhost:3000';
const ID_TOKEN = process.env.ID_TOKEN;
if (!ID_TOKEN) { console.error('ID_TOKEN required'); process.exit(2); }
const res = await fetch(`${BASE}/api/ai/lesson-plan`, {
  method:'POST',
  headers:{'Content-Type':'application/json','Authorization':`Bearer ${ID_TOKEN}`},
  body: JSON.stringify({
    topic:'হারভেস্ট ফেস্টিভ্যাল (যেমন পোঙ্গল বা নবান্ন)',
    grade:'4', subject:'Social Studies', language:'Bengali'
  })
});
const json = await res.json();
const text = JSON.stringify(json);
const bengaliHarvest = /(নবান্ন|পৌষ\s*পার্বণ|পিঠে)/.test(text);
const literalPongal  = /পোঙ্গল/.test(text) && !bengaliHarvest;
console.log(`bengali-harvest-substituted=${bengaliHarvest} literal-pongal-only=${literalPongal}`);
console.log(literalPongal ? 'FAIL: cross-cultural sub missing' : 'PASS');
