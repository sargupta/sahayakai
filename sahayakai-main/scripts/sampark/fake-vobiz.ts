/**
 * A local stand-in for Vobiz, so the whole Test-mode call path can be rehearsed
 * without a phone ringing: the dev server places the call here instead of at
 * api.vobiz.ai, and this server plays the part of the carrier and the person
 * who answers.
 *
 *   npx tsx scripts/sampark/fake-vobiz.ts                       # listens on :4800
 *   FAKE_VOBIZ_KEYS="9,9" npx tsx scripts/sampark/fake-vobiz.ts  # press 9, then 9 again
 *   FAKE_VOBIZ_ANSWER=no npx tsx …                              # ring out, never answer
 *
 * Point the dev server at it with VOBIZ_BASE_URL=http://localhost:4800/api/v1
 * and dummy VOBIZ_AUTH_ID / VOBIZ_AUTH_TOKEN / VOBIZ_FROM_NUMBER — never real
 * credentials. SAMPARK_PUBLIC_BASE_URL must still be an https origin that reaches
 * the dev server (e.g. a cloudflared quick tunnel); this server follows those
 * URLs exactly as Vobiz would, so the rehearsal also proves the tunnel.
 *
 * For each placed call, in order — the same sequence a real answered call makes:
 *   1. POST ring_url                    (Event=Ring)
 *   2. POST answer_url                  (Event=StartApp, CallUUID, From, To)
 *   3. GET every <Play> URL             (must be 200, audio/wav, RIFF header)
 *   4. if a <Gather>: POST its action with the next key from FAKE_VOBIZ_KEYS
 *      (an empty key = no input: continue with the elements after the Gather),
 *      then repeat 3–4 on the XML it returns
 *   5. POST hangup_url                  (HangupCause, Duration, BillDuration)
 * Every step is printed. Refuses to bind anywhere but localhost.
 */

import crypto from 'node:crypto';
import http from 'node:http';

const PORT = Number(process.env.FAKE_VOBIZ_PORT ?? 4800);
const KEYS = (process.env.FAKE_VOBIZ_KEYS ?? '1').split(',').map((k) => k.trim());
const ANSWER = (process.env.FAKE_VOBIZ_ANSWER ?? 'yes') !== 'no';

function out(line: string): void {
    process.stdout.write(`${new Date().toISOString()} ${line}\n`);
}

function attr(tag: string, name: string): string | null {
    const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
    return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'") : null;
}

function unescape(text: string): string {
    return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

async function post(url: string, fields: Record<string, string>): Promise<{ status: number; text: string }> {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields).toString(),
    });
    return { status: res.status, text: await res.text() };
}

function short(url: string): string {
    const u = new URL(url);
    return `${u.pathname}${u.search ? '?…' : ''}`;
}

async function fetchAudio(url: string): Promise<number> {
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    const riff = buf.subarray(0, 4).toString('ascii') === 'RIFF';
    // PCM16 mono 8 kHz: 16000 bytes per second after the 44-byte header.
    const seconds = buf.length > 44 ? (buf.length - 44) / 16000 : 0;
    out(`   play ${short(url)} → ${res.status} ${res.headers.get('content-type')} ${buf.length} B${riff ? '' : ' (NOT a WAV)'} ≈${seconds.toFixed(1)} s`);
    if (res.status !== 200 || !riff) throw new Error(`audio fetch failed for ${short(url)}`);
    return seconds;
}

/** Walk one XML document the way the carrier would; returns seconds of audio played. */
async function walk(xml: string, call: { uuid: string; from: string; to: string }, keys: string[]): Promise<number> {
    let played = 0;
    const body = xml.replace(/<\?xml[^>]*\?>/, '');
    const elements = body.match(/<Gather\b[^>]*>[\s\S]*?<\/Gather>|<Play\b[^>]*>[\s\S]*?<\/Play>|<Hangup\s*\/>|<Redirect\b[^>]*>[\s\S]*?<\/Redirect>/g) ?? [];
    for (const el of elements) {
        if (el.startsWith('<Play')) {
            played += await fetchAudio(unescape(el.replace(/<\/?Play[^>]*>/g, '').trim()));
        } else if (el.startsWith('<Gather')) {
            const open = el.match(/<Gather\b[^>]*>/)![0];
            const action = attr(open, 'action');
            for (const p of el.match(/<Play\b[^>]*>[\s\S]*?<\/Play>/g) ?? []) {
                played += await fetchAudio(unescape(p.replace(/<\/?Play[^>]*>/g, '').trim()));
            }
            const key = keys.shift() ?? '';
            if (!key) {
                out(`   gather: no input (timeout ${attr(open, 'executionTimeout')} s) — continuing`);
                continue;
            }
            if (!action) throw new Error('Gather without action');
            out(`   gather: press ${key} → POST ${short(action)}`);
            const res = await post(action, { CallUUID: call.uuid, From: call.from, To: call.to, InputType: 'dtmf', Digits: key });
            out(`   ← ${res.status} ${res.text.replace(/\s+/g, ' ').slice(0, 160)}`);
            return played + (await walk(res.text, call, keys));
        } else if (el.startsWith('<Hangup')) {
            out('   hangup element');
            return played;
        }
    }
    return played;
}

async function runCall(req: { to: string; from: string; answer_url: string; hangup_url: string; ring_url?: string }, requestUuid: string): Promise<void> {
    const call = { uuid: crypto.randomUUID(), from: req.from, to: req.to };
    out(`call ${requestUuid} → to …${req.to.slice(-4)} (CallUUID ${call.uuid})`);
    try {
        if (req.ring_url) {
            const r = await post(req.ring_url, { CallUUID: call.uuid, RequestUUID: requestUuid, Event: 'Ring', CallStatus: 'ringing' });
            out(` ring → ${r.status}`);
        }
        if (!ANSWER) {
            const h = await post(req.hangup_url, { Event: 'Hangup', CallUUID: call.uuid, RequestUUID: requestUuid, Status: 'no-answer', HangupCause: 'NO_ANSWER', Duration: '0', BillDuration: '0' });
            out(` hangup (no answer) → ${h.status} ${h.text.slice(0, 120)}`);
            return;
        }
        const started = Date.now();
        const a = await post(req.answer_url, { CallUUID: call.uuid, RequestUUID: requestUuid, From: req.from, To: req.to, Event: 'StartApp', CallStatus: 'in-progress', Direction: 'outbound' });
        out(` answer → ${a.status} ${a.text.replace(/\s+/g, ' ').slice(0, 200)}`);
        const played = await walk(a.text, call, [...KEYS]);
        const duration = Math.max(1, Math.round(played + (Date.now() - started) / 1000));
        const h = await post(req.hangup_url, {
            Event: 'Hangup',
            CallUUID: call.uuid,
            RequestUUID: requestUuid,
            Status: 'completed',
            HangupCause: 'NORMAL_CLEARING',
            Duration: String(duration),
            BillDuration: String(Math.ceil(duration / 60) * 60),
        });
        out(` hangup (${duration} s) → ${h.status} ${h.text.slice(0, 120)}`);
    } catch (err) {
        out(` FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
}

const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
        if (req.method !== 'POST' || !/^\/api\/v1\/Account\/[^/]+\/Call\/?$/.test(req.url ?? '')) {
            res.writeHead(404).end();
            return;
        }
        let body: { to: string; from: string; answer_url: string; hangup_url: string; ring_url?: string };
        try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
            res.writeHead(400).end();
            return;
        }
        const requestUuid = crypto.randomUUID();
        res.writeHead(201, { 'Content-Type': 'application/json' }).end(JSON.stringify({ request_uuid: requestUuid, message: 'call fired' }));
        // Like the real carrier, the call proceeds after the API has answered.
        setTimeout(() => void runCall(body, requestUuid), 500);
    });
});

server.listen(PORT, '127.0.0.1', () => out(`fake Vobiz on http://127.0.0.1:${PORT}/api/v1 — keys ${JSON.stringify(KEYS)}, answer=${ANSWER}`));
