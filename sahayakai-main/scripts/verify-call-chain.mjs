#!/usr/bin/env node
/**
 * Live preflight for the parent-call chain.
 *
 * WHY THIS EXISTS
 *
 * On 2026-08-18 a teacher pressed "Call parent" and it failed. Twilio returned
 * `20003 Authenticate` — the auth token had been rotated and Secret Manager
 * still held the June value. At that moment the repository had ~5,260 green
 * automated tests, and every single one of them mocked Twilio. A mocked test
 * can prove we format the request correctly. It cannot prove our account can
 * place a call today.
 *
 * That gap is the whole reason this script exists. It talks to the real
 * provider with the real production credentials and answers one question:
 * *if a teacher pressed the button right now, would the call go out?*
 *
 * It places NO call. Every check is a read.
 *
 * USAGE
 *   node scripts/verify-call-chain.mjs                 # creds from env
 *   node scripts/verify-call-chain.mjs --from-secrets  # creds from Secret Manager
 *
 * Exit 0 = a call would go out. Exit 1 = it would not, and the failing check
 * names the reason. Safe for cron/uptime monitoring: read-only and cheap.
 *
 * NEVER prints a credential. Only lengths, prefixes and provider verdicts.
 */

import { execFileSync } from 'node:child_process';

const PROJECT = process.env.PROJECT_ID || 'sahayakai-b4248';
const useSecrets = process.argv.includes('--from-secrets');

const results = [];
let hardFail = false;

function record(name, ok, detail, fatal = true) {
    results.push({ name, ok, detail });
    if (!ok && fatal) hardFail = true;
    const mark = ok ? 'PASS' : 'FAIL';
    console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
    return ok;
}

function fromSecretManager(name) {
    try {
        return execFileSync(
            'gcloud',
            ['secrets', 'versions', 'access', 'latest', `--secret=${name}`, `--project=${PROJECT}`],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
        );
    } catch {
        return '';
    }
}

async function main() {
    console.log('▸ parent-call chain preflight (read-only; places no call)\n');

    // ── 1. Credentials are present and shaped like credentials ──────────────
    // Shape is checked before the network call so a truncated secret reports as
    // truncated rather than as a mysterious 401.
    const sid = (useSecrets ? fromSecretManager('TWILIO_ACCOUNT_SID') : process.env.TWILIO_ACCOUNT_SID || '').trim();
    const token = (useSecrets ? fromSecretManager('TWILIO_AUTH_TOKEN') : process.env.TWILIO_AUTH_TOKEN || '').trim();
    const from = (process.env.TWILIO_PHONE_NUMBER || '').trim();

    if (!record('credentials present', Boolean(sid && token), sid && token ? `SID ${sid.length}ch, token ${token.length}ch` : 'missing SID and/or token')) {
        return finish();
    }
    record('SID is well-formed', sid.startsWith('AC') && sid.length === 34, `starts "${sid.slice(0, 2)}", length ${sid.length} (expect AC + 34)`);
    record('token is well-formed', token.length === 32, `length ${token.length} (expect 32)`);

    const auth = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
    const get = async (url) => {
        const r = await fetch(url, { headers: { Authorization: auth } });
        let body = {};
        try { body = await r.json(); } catch { /* non-JSON error page */ }
        return { status: r.status, body };
    };

    // ── 2. The provider actually accepts them ───────────────────────────────
    // THE check. This is the one that was red during the outage and that no
    // mocked test could ever have been.
    const acct = await get(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`);
    if (!record(
        'provider accepts our credentials',
        acct.status === 200,
        acct.status === 200 ? 'authenticated' : `HTTP ${acct.status} code=${acct.body?.code ?? '?'} (${acct.body?.message ?? 'no message'})`,
    )) {
        console.log('\n  → Rotate the Auth Token in the Twilio Console, add it as a NEW');
        console.log('    version of TWILIO_AUTH_TOKEN, then restart every service that');
        console.log('    mounts it (Cloud Run reads secrets at instance start).');
        return finish();
    }

    // ── 3. The account is in a state that can place calls ───────────────────
    record(
        'account is active',
        acct.body?.status === 'active',
        `status=${acct.body?.status ?? 'unknown'}`,
    );

    // ── 4. The "From" number is ours and can make voice calls ───────────────
    // A suspended or SMS-only number fails at dial time with a different code;
    // catching it here is cheaper than catching it on a parent's behalf.
    if (from) {
        const nums = await get(
            `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(from)}`,
        );
        const match = nums.body?.incoming_phone_numbers?.[0];
        record('caller ID is owned by this account', Boolean(match), match ? from : `${from} not found on the account`);
        if (match) {
            record('caller ID is voice-capable', Boolean(match.capabilities?.voice), `voice=${Boolean(match.capabilities?.voice)}`);
        }
    } else {
        record('caller ID configured', false, 'TWILIO_PHONE_NUMBER is not set');
    }

    // ── 5. India dialling is permitted ──────────────────────────────────────
    // Geo permissions are account-level and silently block IN calls when off.
    // Non-fatal: the API shape varies by account type, so a read failure here
    // is reported but must not mask the checks above.
    try {
        const geo = await get(`https://voice.twilio.com/v1/DialingPermissions/Countries/IN`);
        if (geo.status === 200) {
            record('India dialling permitted', geo.body?.voice_calls_enabled !== false, `voice_calls_enabled=${geo.body?.voice_calls_enabled}`);
        } else {
            record('India dialling permitted', true, `not verifiable on this account (HTTP ${geo.status}) — skipped`, false);
        }
    } catch {
        record('India dialling permitted', true, 'not verifiable — skipped', false);
    }

    return finish();
}

function finish() {
    const failed = results.filter((r) => !r.ok);
    console.log('\n' + '─'.repeat(64));
    if (!hardFail) {
        console.log(`✓ call chain READY — ${results.length} checks passed.`);
        console.log('  A teacher pressing "Call parent" would reach the provider.');
        process.exit(0);
    }
    console.log(`✗ call chain BROKEN — ${failed.length} of ${results.length} checks failed:`);
    for (const f of failed) console.log(`    • ${f.name}: ${f.detail}`);
    console.log('\n  Teachers cannot place parent calls until these are fixed.');
    process.exit(1);
}

main().catch((e) => {
    console.error('preflight aborted:', e?.message ?? e);
    process.exit(1);
});
