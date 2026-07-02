/**
 * F9-002 — Duplicate / racing call-summary generation.
 *
 * Scenario A (cross-webhook): one outreach completes. Both transcript-sync
 * (with callStatus='completed' + final transcript) and twiml-status (Twilio
 * callback with CallStatus=completed) fire. Both invoke generateCallSummary.
 *
 * Scenario B (intra-webhook race): two concurrent transcript-sync POSTs with
 * the same outreachId. Both read existing.callSummary === undefined, both
 * pass the gate, both run generateCallSummary.
 *
 * Run with: pnpm tsx qa/forensics/repros/F9/F9-002-race-summary.ts
 *
 * Required env:
 *   BASE                       (e.g. http://localhost:3000)
 *   VOICE_PIPELINE_INTERNAL_KEY (internal key shared with transcript-sync)
 *   OUTREACH_ID                (existing outreach doc to target — must be a
 *                               test record; this WILL trigger Vertex spend)
 */

const BASE = process.env.BASE ?? 'http://localhost:3000';
const KEY  = process.env.VOICE_PIPELINE_INTERNAL_KEY!;
const ID   = process.env.OUTREACH_ID!;
if (!KEY || !ID) throw new Error('set VOICE_PIPELINE_INTERNAL_KEY and OUTREACH_ID');

const transcript = [
  { role: 'agent',  text: 'Namaste, Rahul ke pita ji se baat ho rahi hai?' },
  { role: 'parent', text: 'Haan ji, boliye.' },
  { role: 'agent',  text: 'Aaj Rahul school nahin aaya tha.' },
  { role: 'parent', text: 'Ji, tabiyat theek nahin thi.' },
];

async function sync() {
  return fetch(`${BASE}/api/attendance/transcript-sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-key': KEY },
    body: JSON.stringify({
      outreachId: ID,
      transcript,
      turnCount: transcript.length,
      callStatus: 'completed',
    }),
  }).then(r => r.status);
}

(async () => {
  console.log('[F9-002] Firing 2 concurrent terminal transcript-sync POSTs…');
  const [s1, s2] = await Promise.all([sync(), sync()]);
  console.log({ s1, s2 });

  // Wait for the fire-and-forget summary writes to land.
  await new Promise(r => setTimeout(r, 8000));

  // Check the doc via call-summary endpoint (needs a real user token; for
  // forensics use admin SDK or direct Firestore query). Here we just report.
  console.log('[F9-002] Now inspect parent_outreach/' + ID + ' — if generateCallSummary fired twice you will see two log lines in the server output and the final callSummary is whichever write landed last.');
})();
