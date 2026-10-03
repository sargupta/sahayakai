/**
 * Shared helpers for the test-call tests: a minimal STRICT XML parser (well-
 * formedness + element/attribute tree), a fake Vobiz fetch, and a local HTTP
 * client. No real network, no real Vobiz endpoint.
 */
import http from 'node:http';

export interface XmlNode {
    name: string;
    attrs: Record<string, string>;
    children: XmlNode[];
    text: string;
}

const UNESCAPE: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
const unescape = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (m) => UNESCAPE[m]);

/** Throws on anything not well-formed: bad nesting, unquoted attrs, raw & or <, multiple roots. */
export function parseXml(xml: string): XmlNode {
    const root: XmlNode = { name: '#doc', attrs: {}, children: [], text: '' };
    const stack: XmlNode[] = [root];
    let i = 0;
    while (i < xml.length) {
        if (xml[i] === '<') {
            const end = xml.indexOf('>', i);
            if (end === -1) throw new Error('unterminated tag');
            const raw = xml.slice(i + 1, end);
            i = end + 1;
            if (raw.startsWith('/')) {
                const top = stack.pop();
                if (!top || top.name !== raw.slice(1).trim()) throw new Error(`mismatched close ${raw}`);
                continue;
            }
            const selfClose = raw.endsWith('/');
            const body = selfClose ? raw.slice(0, -1) : raw;
            const m = /^([A-Za-z][A-Za-z0-9]*)((?:\s+[A-Za-z][A-Za-z0-9]*="[^"<]*")*)\s*$/.exec(body);
            if (!m) throw new Error(`bad tag <${raw}>`);
            const attrs: Record<string, string> = {};
            for (const a of m[2].matchAll(/([A-Za-z][A-Za-z0-9]*)="([^"]*)"/g)) {
                if (/&(?!(amp|lt|gt|quot|apos);)/.test(a[2])) throw new Error(`unescaped & in attribute ${a[1]}`);
                attrs[a[1]] = unescape(a[2]);
            }
            const node: XmlNode = { name: m[1], attrs, children: [], text: '' };
            stack[stack.length - 1].children.push(node);
            if (!selfClose) stack.push(node);
        } else {
            const next = xml.indexOf('<', i);
            const text = xml.slice(i, next === -1 ? xml.length : next);
            if (/&(?!(amp|lt|gt|quot|apos);)/.test(text)) throw new Error('unescaped & in text');
            stack[stack.length - 1].text += unescape(text);
            i = next === -1 ? xml.length : next;
        }
    }
    if (stack.length !== 1) throw new Error('unclosed element');
    if (root.children.length !== 1) throw new Error('need exactly one root');
    return root.children[0];
}

/** Fake provider fetch: records every call, accepts the dial, accepts the hangup. */
export function fakeFetch(opts: { dialStatus?: number; requestUuid?: string } = {}) {
    const calls: { url: string; method: string; body: Record<string, unknown> | null }[] = [];
    const impl = (async (url: string, init?: { method?: string; body?: string }) => {
        const method = init?.method ?? 'GET';
        calls.push({ url: String(url), method, body: init?.body ? JSON.parse(init.body) : null });
        if (method === 'POST') {
            const status = opts.dialStatus ?? 200;
            return { status, ok: status < 300, json: async () => ({ request_uuid: opts.requestUuid ?? 'req-uuid-1' }) };
        }
        return { status: 204, ok: true, json: async () => ({}) };
    }) as unknown as typeof fetch;
    return { impl, calls, dials: () => calls.filter((c) => c.method === 'POST'), hangups: () => calls.filter((c) => c.method === 'DELETE') };
}

export interface Resp { status: number; headers: http.IncomingHttpHeaders; body: Buffer; text: string }

export function request(
    port: number, method: string, pathAndQuery: string, form?: Record<string, string> | null,
): Promise<Resp> {
    return new Promise((resolve, reject) => {
        const payload = form ? new URLSearchParams(form).toString() : undefined;
        const req = http.request({
            host: '127.0.0.1', port, method, path: pathAndQuery,
            headers: payload ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) } : {},
        }, (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (c: Buffer) => chunks.push(c));
            res.on('end', () => {
                const body = Buffer.concat(chunks);
                resolve({ status: res.statusCode ?? 0, headers: res.headers, body, text: body.toString('utf8') });
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

/** Path+query of a full URL (the server is addressed by port, not by the public host). */
export function localPath(fullUrl: string): string {
    const u = new URL(fullUrl);
    return u.pathname + u.search;
}
