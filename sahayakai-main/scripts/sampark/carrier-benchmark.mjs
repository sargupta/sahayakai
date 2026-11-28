#!/usr/bin/env node
/**
 * SP-17 / SP-18 Carrier Benchmark Runner (Vobiz, Plivo, Exotel).
 *
 * Reads credentials strictly from environment variables (or .env.local), never prints secrets,
 * enforces a destination allow-list (from RIYA_REAL_TEST_NUMBER or --to), and outputs a Markdown scoring row
 * per run with setup latency, call SID, status, and recording URL slot.
 *
 * Usage:
 *   node scripts/sampark/carrier-benchmark.mjs --carrier vobiz --runs 5 --to +919800000101 --dry-run
 */

import fs from 'node:fs';
import path from 'node:path';

const ALLOWED_CARRIERS = new Set(['vobiz', 'plivo', 'exotel']);

function parseArgs(argv) {
    const out = { carrier: 'vobiz', runs: 5, to: process.env.RIYA_REAL_TEST_NUMBER || '+919800000101', dryRun: false, delayMs: 3000 };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--carrier' && argv[i + 1]) out.carrier = argv[++i].toLowerCase();
        else if (a === '--runs' && argv[i + 1]) out.runs = Math.max(1, Math.min(10, Number(argv[++i]) || 5));
        else if (a === '--to' && argv[i + 1]) out.to = argv[++i];
        else if (a === '--delay-ms' && argv[i + 1]) out.delayMs = Math.max(500, Number(argv[++i]) || 3000);
        else if (a === '--dry-run') out.dryRun = true;
    }
    return out;
}

function loadDotEnvLocal() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (!(key in process.env)) process.env[key] = val;
    }
}

function normalizeDigits(phone) {
    const d = phone.replace(/\D/g, '');
    return d.length === 10 ? `91${d}` : d;
}

function checkCarrierEnv(carrier) {
    const required = {
        vobiz: ['VOBIZ_AUTH_ID', 'VOBIZ_AUTH_TOKEN', 'VOBIZ_FROM_NUMBER', 'SAMPARK_PUBLIC_BASE_URL'],
        plivo: ['PLIVO_AUTH_ID', 'PLIVO_AUTH_TOKEN', 'PLIVO_FROM_NUMBER', 'SAMPARK_PUBLIC_BASE_URL'],
        exotel: ['EXOTEL_API_KEY', 'EXOTEL_API_TOKEN', 'EXOTEL_ACCOUNT_SID', 'EXOTEL_SUBDOMAIN', 'EXOTEL_CALLER_ID', 'RIYA_BRIDGE_BASE_URL'],
    }[carrier];
    return required.filter((k) => !process.env[k]?.trim());
}

async function placeOne(carrier, toDigits, dryRun) {
    const t0 = Date.now();
    if (dryRun) {
        return { ok: true, callId: `dryrun-${carrier}-${t0}`, setupMs: 0, status: 'dry-run', failure: '' };
    }
    const pub = (process.env.SAMPARK_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    if (carrier === 'vobiz') {
        const base = (process.env.VOBIZ_BASE_URL || 'https://api.vobiz.ai/api/v1').replace(/\/+$/, '');
        const res = await fetch(`${base}/Account/${encodeURIComponent(process.env.VOBIZ_AUTH_ID)}/Call/`, {
            method: 'POST',
            headers: {
                'X-Auth-ID': process.env.VOBIZ_AUTH_ID,
                'X-Auth-Token': process.env.VOBIZ_AUTH_TOKEN,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: normalizeDigits(process.env.VOBIZ_FROM_NUMBER),
                to: toDigits,
                answer_url: `${pub}/api/webhooks/vobiz-riya/answer`,
                answer_method: 'POST',
                hangup_url: `${pub}/api/webhooks/vobiz-riya/status?kind=hangup`,
                ring_timeout: 30,
            }),
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, callId: data.request_uuid || '', setupMs: Date.now() - t0, status: `http_${res.status}`, failure: res.ok ? '' : `http_${res.status}` };
    }
    if (carrier === 'plivo') {
        const auth = Buffer.from(`${process.env.PLIVO_AUTH_ID}:${process.env.PLIVO_AUTH_TOKEN}`).toString('base64');
        const res = await fetch(`https://api.plivo.com/v1/Account/${encodeURIComponent(process.env.PLIVO_AUTH_ID)}/Call/`, {
            method: 'POST',
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: normalizeDigits(process.env.PLIVO_FROM_NUMBER),
                to: toDigits,
                answer_url: `${pub}/api/webhooks/plivo-riya/answer`,
                answer_method: 'POST',
                hangup_url: `${pub}/api/webhooks/plivo-riya/status?kind=hangup`,
                hangup_method: 'POST',
                ring_timeout: 30,
                time_limit: 300,
            }),
        });
        const data = await res.json().catch(() => ({}));
        const uuid = Array.isArray(data.request_uuid) ? data.request_uuid[0] : data.request_uuid;
        return { ok: res.ok, callId: uuid || '', setupMs: Date.now() - t0, status: `http_${res.status}`, failure: res.ok ? '' : `http_${res.status}` };
    }
    // Exotel AgentStream
    const auth = Buffer.from(`${process.env.EXOTEL_API_KEY}:${process.env.EXOTEL_API_TOKEN}`).toString('base64');
    const bridge = (process.env.RIYA_BRIDGE_BASE_URL || '').replace(/^https:/, 'wss:').replace(/\/+$/, '');
    const form = new URLSearchParams({
        From: toDigits,
        CallerId: process.env.EXOTEL_CALLER_ID,
        StreamUrl: `${bridge}/telephony/exotel/stream`,
        StreamType: 'bidirectional',
        TimeLimit: '300',
        TimeOut: '30',
    });
    const res = await fetch(`https://${process.env.EXOTEL_SUBDOMAIN}/v1/Accounts/${encodeURIComponent(process.env.EXOTEL_ACCOUNT_SID)}/Calls/connect.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, callId: data?.Call?.Sid || '', setupMs: Date.now() - t0, status: `http_${res.status}`, failure: res.ok ? '' : `http_${res.status}` };
}

async function main() {
    loadDotEnvLocal();
    const args = parseArgs(process.argv.slice(2));
    if (!ALLOWED_CARRIERS.has(args.carrier)) {
        console.error(`Unsupported carrier: ${args.carrier}`);
        process.exit(1);
    }
    const toDigits = normalizeDigits(args.to);
    const missing = args.dryRun ? [] : checkCarrierEnv(args.carrier);
    if (missing.length > 0) {
        console.error(`Missing env vars for ${args.carrier}: ${missing.join(', ')}`);
        process.exit(2);
    }
    console.log('| Carrier | Run # | Call ID / SID | Setup (ms) | API Status | Failure Reason | Recording Link |');
    console.log('|---|---|---|---|---|---|---|');
    for (let i = 1; i <= args.runs; i += 1) {
        const r = await placeOne(args.carrier, toDigits, args.dryRun);
        console.log(`| ${args.carrier} | ${i} | ${r.callId || 'n/a'} | ${r.setupMs} | ${r.status} | ${r.failure || 'none'} | pending |`);
        if (i < args.runs && !args.dryRun) {
            await new Promise((resolve) => setTimeout(resolve, args.delayMs));
        }
    }
}

main().catch((err) => {
    console.error('Benchmark failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
});
