import type { AddressInfo } from 'node:net';
import { createServer, type IncomingMessage, type Server } from 'node:http';

import { generateState } from '../src/generate';
import { createCrmServer, type AppOptions, type CrmApp } from '../src/server';
import type { CrmState } from '../src/state';

export const API_KEY = 'test-key-123';

let cached: string | null = null;
/** A fresh deep copy of the default seed (generation is cached per test process). */
export function freshState(): CrmState {
    cached ??= JSON.stringify(generateState());
    return JSON.parse(cached) as CrmState;
}

export interface TestServer {
    baseUrl: string;
    app: CrmApp;
    close(): Promise<void>;
}

export async function startServer(overrides: Partial<AppOptions> = {}): Promise<TestServer> {
    const { server, app } = createCrmServer({ state: freshState(), statePath: null, apiKey: API_KEY, ...overrides });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    return {
        baseUrl: `http://127.0.0.1:${port}`,
        app,
        close: () => closeServer(server),
    };
}

export function closeServer(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.closeAllConnections?.();
        server.close((err) => (err ? reject(err) : resolve()));
    });
}

export function api(baseUrl: string, path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (!headers.has('authorization')) headers.set('authorization', `Bearer ${API_KEY}`);
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
    return fetch(`${baseUrl}${path}`, { ...init, headers });
}

export async function getJson<T = unknown>(baseUrl: string, path: string): Promise<T> {
    const res = await api(baseUrl, path);
    if (res.status !== 200) throw new Error(`${path} → ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
}

/** Follows nextCursor until the end, forwarding only `cursor` (and limit) on later pages. */
export async function crawl<T = Record<string, unknown>>(baseUrl: string, path: string, query: Record<string, string> = {}): Promise<{ records: T[]; pages: number }> {
    const records: T[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
        const params = new URLSearchParams(cursor ? { cursor, ...(query.limit ? { limit: query.limit } : {}) } : query);
        const page: { data: T[]; nextCursor: string | null } = await getJson(baseUrl, `${path}?${params.toString()}`);
        records.push(...page.data);
        cursor = page.nextCursor;
        pages += 1;
        if (pages > 10_000) throw new Error('crawl did not terminate');
    } while (cursor);
    return { records, pages };
}

export interface ReceivedHook {
    headers: IncomingMessage['headers'];
    body: string;
}

/** A local webhook receiver on an ephemeral port. */
export async function startReceiver(): Promise<{ url: string; received: ReceivedHook[]; close(): Promise<void> }> {
    const received: ReceivedHook[] = [];
    const server = createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
            received.push({ headers: req.headers, body: Buffer.concat(chunks).toString('utf8') });
            res.writeHead(204);
            res.end();
        });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    return { url: `http://127.0.0.1:${port}/hooks/crm`, received, close: () => closeServer(server) };
}

/** POST an x-www-form-urlencoded demo form; returns the redirect location. */
export async function submitDemo(baseUrl: string, action: string, fields: Record<string, string>): Promise<string> {
    const res = await fetch(`${baseUrl}/demo/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields).toString(),
        redirect: 'manual',
    });
    if (res.status !== 303) throw new Error(`demo ${action} → ${res.status} ${await res.text()}`);
    return res.headers.get('location') ?? '';
}
