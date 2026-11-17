#!/usr/bin/env node
/**
 * Local webhook gateway for REAL calls from a developer machine (Vobiz / ElevenLabs).
 *
 * The phone company must reach two local servers over public https tunnels. Tunnelling the
 * Next dev server itself would expose the whole app — including the development login
 * (`auth-token=dev-token` → the seeded school admin), so anyone with the tunnel URL could start
 * real calls. This gateway is what gets tunnelled instead. It forwards ONLY:
 *
 *   :APP_GATE  → 127.0.0.1:APP     /api/webhooks/vobiz-riya/*, /api/webhooks/sampark-voice/*,
 *                                  /api/webhooks/elevenlabs-riya   (Cookie headers stripped)
 *   :BRIDGE_GATE → 127.0.0.1:BRIDGE  /telephony/vobiz/stream (WebSocket upgrade and HTTP)
 *
 * Everything else answers 404. Each forwarded webhook is still verified by the app itself
 * (purpose-scoped HMAC tokens for Vobiz, signatures for ElevenLabs).
 *
 *   node scripts/sampark/webhook-gateway.mjs --app 3000 --app-gate 3010 --bridge 8091 --bridge-gate 8092
 */
import http from 'node:http';
import net from 'node:net';

const argv = process.argv.slice(2);
const opt = (f, d) => {
    const i = argv.indexOf(`--${f}`);
    return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : d;
};
const APP = opt('app', 3000);
const APP_GATE = opt('app-gate', 3010);
const BRIDGE = opt('bridge', 8091);
const BRIDGE_GATE = opt('bridge-gate', 8092);

export const APP_ALLOWED = [/^\/api\/webhooks\/vobiz-riya(\/|\?|$)/, /^\/api\/webhooks\/sampark-voice(\/|\?|$)/, /^\/api\/webhooks\/elevenlabs-riya(\/|\?|$)/];
export const BRIDGE_ALLOWED = [/^\/telephony\/vobiz\/stream(\?|$)/];
export const allowed = (rules, url) => rules.some((r) => r.test(url ?? ''));

const log = (s) => process.stdout.write(`${new Date().toISOString()} ${s}\n`);

function gate(name, listenPort, targetPort, rules, { stripCookies }) {
    const server = http.createServer((req, res) => {
        if (!allowed(rules, req.url)) {
            log(`${name} 404 ${req.method} ${String(req.url).split('?')[0]}`);
            res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
            return;
        }
        const headers = { ...req.headers, host: `127.0.0.1:${targetPort}` };
        if (stripCookies) delete headers.cookie;
        const up = http.request({ host: '127.0.0.1', port: targetPort, method: req.method, path: req.url, headers }, (r) => {
            res.writeHead(r.statusCode ?? 502, r.headers);
            r.pipe(res);
        });
        up.on('error', () => { if (!res.headersSent) res.writeHead(502).end('Bad gateway'); });
        req.pipe(up);
        log(`${name} → ${req.method} ${String(req.url).split('?')[0]}`);
    });
    // WebSocket (Vobiz media stream): raw upgrade pass-through for allowed paths only.
    server.on('upgrade', (req, socket, head) => {
        if (!allowed(rules, req.url)) { socket.end('HTTP/1.1 404 Not Found\r\n\r\n'); return; }
        const upstream = net.connect(targetPort, '127.0.0.1', () => {
            const lines = [`${req.method} ${req.url} HTTP/1.1`];
            for (let i = 0; i < req.rawHeaders.length; i += 2) {
                const k = req.rawHeaders[i];
                if (stripCookies && k.toLowerCase() === 'cookie') continue;
                lines.push(`${k}: ${k.toLowerCase() === 'host' ? `127.0.0.1:${targetPort}` : req.rawHeaders[i + 1]}`);
            }
            upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
            if (head?.length) upstream.write(head);
            upstream.pipe(socket);
            socket.pipe(upstream);
        });
        const close = () => { socket.destroy(); upstream.destroy(); };
        upstream.on('error', close);
        socket.on('error', close);
        log(`${name} ⇄ WS ${String(req.url).split('?')[0]}`);
    });
    server.listen(listenPort, '127.0.0.1', () => log(`${name} gateway :${listenPort} → 127.0.0.1:${targetPort} (allow-listed paths only)`));
    return server;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
    gate('app', APP_GATE, APP, APP_ALLOWED, { stripCookies: true });
    gate('bridge', BRIDGE_GATE, BRIDGE, BRIDGE_ALLOWED, { stripCookies: true });
}
