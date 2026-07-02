#!/usr/bin/env ts-node
import { getDb } from '../src/lib/firebase-admin';
async function main() {
    const db = await getDb();
    const all = await db.collection('users').get();
    const fieldFreq: Record<string, number> = {};
    let total = 0;
    let aiCount = 0;
    for (const doc of all.docs) {
        const d = doc.data() as Record<string, unknown>;
        if (d.isAITeacher === true) { aiCount++; continue; }
        total++;
        for (const k of Object.keys(d)) fieldFreq[k] = (fieldFreq[k]||0)+1;
    }
    console.error(`Real teachers: ${total}, AI: ${aiCount}`);
    console.error('Field frequency:');
    const sorted = Object.entries(fieldFreq).sort((a,b) => b[1]-a[1]);
    for (const [k,v] of sorted) {
        const pct = Math.round((v/total)*100);
        console.error(`  ${k.padEnd(30)} ${v.toString().padStart(4)} / ${total}  (${pct}%)`);
    }
}
main().catch(e => { console.error(e); process.exit(1); });
