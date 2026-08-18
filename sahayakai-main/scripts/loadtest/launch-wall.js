/**
 * k6 load test — the "8 AM IST wall" traffic mix.
 *
 * India is one timezone; teachers prep before school, so launch load is a
 * 5-10x spike in a ~90-minute window, not a smooth daily average. This script
 * replays a realistic mix against a STAGING revision so launch day is not the
 * first time the system sees concurrency. The goal is to find the real knee
 * (where instance count saturates / Gemini 429s begin), then feed those
 * measured numbers back into docs/SCALING_AND_RELIABILITY.md, replacing the
 * estimated thresholds.
 *
 * RUN AGAINST STAGING ONLY. Pointing this at prod will burn real Gemini money
 * and can trip the budget kill-switch. Use a no-traffic tagged revision URL.
 *
 *   k6 run -e BASE_URL=https://dep-<sha>---sahayakai-hotfix-resilience-xxx.run.app \
 *          -e TOKEN=<firebase-id-token> \
 *          scripts/loadtest/launch-wall.js
 *
 * The mix (per the capacity model):
 *   70% browse/login   — cheap reads, the bulk of real traffic
 *   20% lesson-plan    — the heavy synchronous AI generation (the storm)
 *    5% directory      — teacher discovery (scrape-shaped, O(N) scan)
 *    5% image/visual   — the most expensive call ($0.04+, 25-90s)
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';

const rate429 = new Rate('http_429');
const rate5xx = new Rate('http_5xx');
const aiLatency = new Trend('ai_generation_latency', true);

// Ramp shape: a steep climb to simulate the morning spike, hold at the wall,
// then ease off. Tune the peak target up until you find the knee.
export const options = {
  scenarios: {
    morning_wall: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '2m', target: 50 },   // early prep
        { duration: '3m', target: 200 },  // the spike
        { duration: '5m', target: 400 },  // the wall — push until knee
        { duration: '3m', target: 400 },  // hold
        { duration: '2m', target: 0 },    // ease off
      ],
      gracefulStop: '30s',
    },
  },
  thresholds: {
    // Launch survival lines. If these break, the system falls over at the wall.
    http_429: ['rate<0.05'],          // <5% throttled
    http_5xx: ['rate<0.01'],          // <1% hard errors (AI should degrade to 503-as-handled, not crash)
    ai_generation_latency: ['p(95)<45000'],
  },
};

function authHeaders() {
  return TOKEN
    ? { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

function record(res) {
  rate429.add(res.status === 429);
  rate5xx.add(res.status >= 500);
  return res;
}

export default function () {
  const r = Math.random();

  if (r < 0.7) {
    // browse/login — cheap reads
    const res = record(http.get(`${BASE_URL}/api/health`));
    check(res, { 'health ok': (x) => x.status === 200 });
    sleep(1 + Math.random() * 2);
  } else if (r < 0.9) {
    // lesson-plan — the heavy AI storm
    const t0 = Date.now();
    const res = record(
      http.post(
        `${BASE_URL}/api/ai/lesson-plan`,
        JSON.stringify({
          topic: 'Photosynthesis',
          grade: '6',
          subject: 'Science',
          language: 'en',
          board: 'CBSE',
        }),
        { headers: authHeaders(), timeout: '120s' }
      )
    );
    aiLatency.add(Date.now() - t0);
    // 200 = generated, 503 = graceful degradation (acceptable under load),
    // 429 = throttled. A 500 is a real failure.
    check(res, { 'lesson-plan not 5xx-hard': (x) => x.status !== 500 });
    sleep(2 + Math.random() * 3);
  } else if (r < 0.95) {
    // directory — teacher discovery (scrape-shaped). Adjust path to the real
    // discovery endpoint/action if it is exposed over HTTP.
    const res = record(http.get(`${BASE_URL}/community`, { headers: authHeaders() }));
    check(res, { 'directory reachable': (x) => x.status < 500 });
    sleep(1 + Math.random() * 2);
  } else {
    // image/visual-aid — most expensive call
    const t0 = Date.now();
    const res = record(
      http.post(
        `${BASE_URL}/api/ai/visual-aid`,
        JSON.stringify({ concept: 'Water cycle diagram', grade: '5', language: 'en' }),
        { headers: authHeaders(), timeout: '120s' }
      )
    );
    aiLatency.add(Date.now() - t0);
    check(res, { 'visual-aid not 5xx-hard': (x) => x.status !== 500 });
    sleep(3 + Math.random() * 4);
  }
}

export function handleSummary(data) {
  const m = data.metrics;
  const line = (k) => (m[k] ? JSON.stringify(m[k].values) : 'n/a');
  return {
    stdout:
      '\n=== 8 AM-wall load test summary ===\n' +
      `429 rate:        ${line('http_429')}\n` +
      `5xx rate:        ${line('http_5xx')}\n` +
      `AI gen latency:  ${line('ai_generation_latency')}\n` +
      `http_req_dur:    ${line('http_req_duration')}\n` +
      'Feed p95 + the VU level where 429s begin back into\n' +
      'docs/SCALING_AND_RELIABILITY.md (capacity tables).\n',
  };
}
