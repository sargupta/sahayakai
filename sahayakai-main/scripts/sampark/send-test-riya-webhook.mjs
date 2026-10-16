#!/usr/bin/env node
/**
 * Send ONE signed ElevenLabs-style post-call webhook to a LOCAL Sahayak server, to test the
 * Riya webhook receiver without placing a call.
 *
 * - Refuses any URL that is not http://localhost / 127.0.0.1 / [::1].
 * - Signs with ELEVENLABS_WEBHOOK_SECRET from this shell (the same value the local app has);
 *   the secret is never printed. Use a disposable local value, never the real one.
 * - Uses ELEVENLABS_AGENT_ID from this shell (the app's configured agent) unless --agent is given.
 *
 *   node scripts/sampark/send-test-riya-webhook.mjs [--conversation conv_test_1] [--type post_call|failure]
 *        [--bad-signature] [--stale] [--url http://localhost:3000/api/webhooks/elevenlabs-riya]
 *
 * Expected answers from the app: 401 bad/stale signature · 404 flags off · 503 unknown conversation
 * younger than 15 min (ElevenLabs would retry) · 200 applied/duplicate/ignored.
 */

import { createHmac } from 'node:crypto';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};

const url = opt('url', 'http://localhost:3000/api/webhooks/elevenlabs-riya');
const u = new URL(url);
if (u.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) {
    console.error('Refusing: this tool only posts to a local server (http://localhost…).');
    process.exit(2);
}
const secret = process.env.ELEVENLABS_WEBHOOK_SECRET?.trim();
if (!secret) {
    console.error('ELEVENLABS_WEBHOOK_SECRET is not set in this shell (use the same disposable local value the app uses).');
    process.exit(2);
}
const agentId = opt('agent', process.env.ELEVENLABS_AGENT_ID?.trim() || 'agent_localtestlocaltestlocaltest0');
const conversationId = opt('conversation', 'conv_local_test_1');
const now = Math.floor(Date.now() / 1000);
const ts = flag('stale') ? now - 3600 : now;

const body = JSON.stringify(
    opt('type', 'post_call') === 'failure'
        ? { type: 'call_initiation_failure', event_timestamp: ts, data: { agent_id: agentId, conversation_id: conversationId, failure_reason: 'no-answer', metadata: { type: 'sip', body: {} } } }
        : {
              type: 'post_call_transcription',
              event_timestamp: ts,
              data: {
                  agent_id: agentId,
                  conversation_id: conversationId,
                  status: 'done',
                  transcript: [{ role: 'agent', message: 'Hello (local test)', time_in_call_secs: 0 }],
                  metadata: { call_duration_secs: 12, termination_reason: 'local test' },
                  analysis: { call_successful: 'success', data_collection_results: { ptm_attendance: { value: 'can_attend' } } },
              },
          },
);
const sig = createHmac('sha256', flag('bad-signature') ? `${secret}-wrong` : secret).update(`${ts}.${body}`).digest('hex');

const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'elevenlabs-signature': `t=${ts},v0=${sig}` }, body });
console.log(`HTTP ${res.status} ${await res.text()}`);
