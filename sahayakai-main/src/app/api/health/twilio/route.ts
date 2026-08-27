import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * GET /api/health/twilio — does the call provider still accept our credentials?
 *
 * WHY THIS EXISTS
 * Every attendance call failed `20003 Authenticate` from 2026-08-18 to
 * 2026-08-25. The token had been rotated on Twilio's side and never updated
 * here, and later the token was updated while the account SID was left on a
 * version belonging to a different account — so the pair did not match. Both
 * failures were invisible: two dead calls a day is far below any rate-based
 * alert threshold, and the route classifies provider failures correctly, so it
 * never looked like an outage. The only way to find out was to call a parent
 * and watch it fail.
 *
 * This asks Twilio the one question that matters — "are these credentials
 * valid?" — using the account-fetch endpoint, which places NO call, sends no
 * SMS, and costs nothing. Safe to poll.
 *
 * Deliberately reports the SID's first 9 characters only. That prefix is what
 * distinguishes one account from another, which is the exact failure this
 * endpoint exists to catch, and it is useless to an attacker without the token.
 * The token is never read into the response under any condition.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

type Verdict =
    | 'ok'
    | 'unconfigured'
    | 'malformed_credentials'
    | 'credentials_rejected'
    | 'from_number_not_owned'
    | 'trial_account_restricted'
    | 'account_suspended'
    | 'provider_unreachable';

export async function GET(request: NextRequest) {
    // Same gate as the cron jobs: this is an operator probe, not a public one.
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }
    if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const token = process.env.TWILIO_AUTH_TOKEN?.trim();
    const from = process.env.TWILIO_PHONE_NUMBER?.trim();

    const body = (verdict: Verdict, detail: string, extra: Record<string, unknown> = {}) => ({
        verdict,
        ok: verdict === 'ok',
        detail,
        // Prefix only — enough to tell two accounts apart, useless on its own.
        accountSidPrefix: sid ? sid.slice(0, 9) : null,
        fromNumberConfigured: !!from,
        checkedAt: new Date().toISOString(),
        ...extra,
    });

    if (!sid || !token || !from) {
        const missing = [
            !sid && 'TWILIO_ACCOUNT_SID',
            !token && 'TWILIO_AUTH_TOKEN',
            !from && 'TWILIO_PHONE_NUMBER',
        ].filter(Boolean);
        logger.error(
            `Twilio preflight: not configured — missing ${missing.join(', ')}`,
            new Error('Twilio unconfigured'),
            'TWILIO_PREFLIGHT',
        );
        return NextResponse.json(body('unconfigured', `Missing: ${missing.join(', ')}`), { status: 503 });
    }

    // Shape check BEFORE asking Twilio, because the failure that actually
    // happened here was not a rotated key — it was the wrong value pasted into
    // the right secret. TWILIO_AUTH_TOKEN held, in successive versions, a
    // 20-char `PA…` identifier and then a 34-char `AC…` Account SID. Twilio
    // answers both with a flat 401, which reads as "your token is wrong" and
    // sends an operator off to rotate a key that was never the problem.
    //
    // Twilio's formats are fixed: an Account SID is `AC` + 32 hex (34 chars); an
    // auth token is 32 hex with no prefix. Checking that locally names the fault
    // exactly, and costs nothing.
    const SID_RE = /^AC[0-9a-f]{32}$/i;
    const TOKEN_RE = /^[0-9a-f]{32}$/i;
    const shapeProblems: string[] = [];

    if (!SID_RE.test(sid)) {
        shapeProblems.push(
            `TWILIO_ACCOUNT_SID is ${sid.length} chars starting "${sid.slice(0, 2)}" — expected 34 chars starting "AC".`,
        );
    }
    if (!TOKEN_RE.test(token)) {
        const looksLikeSid = /^AC/i.test(token);
        shapeProblems.push(
            `TWILIO_AUTH_TOKEN is ${token.length} chars starting "${token.slice(0, 2)}" — expected 32 hex chars.` +
                (looksLikeSid ? ' That is an Account SID, not an auth token — the SID was stored in the token secret.' : ''),
        );
    }

    if (shapeProblems.length > 0) {
        logger.error(
            `Twilio preflight: credentials are malformed — ${shapeProblems.join(' ')}`,
            new Error('Twilio credentials malformed'),
            'TWILIO_PREFLIGHT',
        );
        return NextResponse.json(body('malformed_credentials', shapeProblems.join(' ')), { status: 503 });
    }

    // Account fetch: read-only, places no call, sends nothing, costs nothing.
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`;
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');

    let res: Response;
    try {
        res = await fetch(url, {
            headers: { Authorization: `Basic ${auth}` },
            signal: AbortSignal.timeout(10_000),
        });
    } catch (err: any) {
        // Network trouble is not a credential verdict — say so rather than
        // reporting a false "rejected" and sending someone to rotate a key
        // that was fine.
        logger.error('Twilio preflight: provider unreachable', err, 'TWILIO_PREFLIGHT');
        return NextResponse.json(
            body('provider_unreachable', String(err?.message ?? err).slice(0, 200)),
            { status: 502 },
        );
    }

    if (res.status === 401) {
        // The 20003 case, caught before a teacher hits it. Almost always one of:
        // the token was rotated in Twilio and not here, or SID and token belong
        // to different accounts.
        logger.error(
            'Twilio preflight: credentials REJECTED (401) — calls will fail 20003',
            new Error('Twilio credentials rejected'),
            'TWILIO_PREFLIGHT',
            { accountSidPrefix: sid.slice(0, 9) },
        );
        return NextResponse.json(
            body(
                'credentials_rejected',
                'Twilio rejected the SID/token pair. Either the auth token was rotated in Twilio and not updated in Secret Manager, or the stored SID and token belong to different accounts.',
            ),
            { status: 502 },
        );
    }

    if (!res.ok) {
        return NextResponse.json(
            body('provider_unreachable', `Twilio returned HTTP ${res.status}`, { httpStatus: res.status }),
            { status: 502 },
        );
    }

    const account = (await res.json().catch(() => ({}))) as { status?: string; friendly_name?: string };

    // A live account can still be suspended or closed, in which case the
    // credentials are valid and calls still will not connect.
    if (account.status && account.status !== 'active') {
        logger.error(
            `Twilio preflight: account is ${account.status}`,
            new Error('Twilio account not active'),
            'TWILIO_PREFLIGHT',
        );
        return NextResponse.json(
            body('account_suspended', `Twilio account status is "${account.status}"`, {
                accountStatus: account.status,
            }),
            { status: 502 },
        );
    }

    // Credentials being valid is NOT the same as a call being placeable, and
    // conflating the two is exactly how this endpoint's first version gave a
    // confident "ok" while every call still failed. Twilio rejected the call
    // with 21210 — the configured FROM number belonged to a DIFFERENT account,
    // because phone numbers do not move when you switch accounts. Checking that
    // the variable was merely *set* proved nothing.
    const owned = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/IncomingPhoneNumbers.json?PageSize=100`,
        { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(10_000) },
    )
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

    const ownedNumbers: string[] = (owned?.incoming_phone_numbers ?? [])
        .map((n: any) => n?.phone_number)
        .filter(Boolean);

    if (ownedNumbers.length > 0 && !ownedNumbers.includes(from)) {
        logger.error(
            `Twilio preflight: FROM number ${from} is not owned by this account — calls will fail 21210`,
            new Error('Twilio from-number not owned'),
            'TWILIO_PREFLIGHT',
        );
        return NextResponse.json(
            body(
                'from_number_not_owned',
                `TWILIO_PHONE_NUMBER (${from}) is not owned by this account, so Twilio will reject every call with 21210. Numbers do not transfer between accounts. Owned: ${ownedNumbers.join(', ') || 'none'}.`,
                { ownedNumbers, accountStatus: account.status ?? 'unknown' },
            ),
            { status: 502 },
        );
    }

    // A trial account authenticates, owns its number, and still cannot call a
    // parent: it may only dial numbers that have been verified on it. Reporting
    // "ok" here would be true about the credentials and useless in practice.
    const isTrial = String((account as any).type ?? '').toLowerCase() === 'trial';
    if (isTrial) {
        const callerIds = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/OutgoingCallerIds.json?PageSize=100`,
            { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(10_000) },
        )
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);

        const verified: string[] = (callerIds?.outgoing_caller_ids ?? [])
            .map((c: any) => c?.phone_number)
            .filter(Boolean);

        logger.error(
            `Twilio preflight: account is a TRIAL — calls only reach verified numbers (${verified.length} verified)`,
            new Error('Twilio trial account'),
            'TWILIO_PREFLIGHT',
        );
        return NextResponse.json(
            body(
                'trial_account_restricted',
                `Credentials are valid and the FROM number is owned, but this is a TRIAL account: Twilio will only connect calls to numbers verified on it. Calls to real parents will be rejected. Verified: ${verified.join(', ') || 'none'}. Upgrade the account to call arbitrary numbers.`,
                { accountType: 'Trial', verifiedNumbers: verified, ownedNumbers, accountStatus: account.status ?? 'unknown' },
            ),
            { status: 502 },
        );
    }

    return NextResponse.json(
        body('ok', 'Twilio accepted the credentials, the FROM number is owned by this account, and the account is not on trial.', {
            accountStatus: account.status ?? 'unknown',
            ownedNumbers,
        }),
    );
}
