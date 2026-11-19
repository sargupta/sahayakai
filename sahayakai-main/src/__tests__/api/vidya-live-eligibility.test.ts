/**
 * Class gate: a teacher is shown hands-free Live VIDYA only when the server would
 * actually start a Live session for them; everyone else keeps tap-to-talk VIDYA.
 *
 * The bug this prevents: Live VIDYA is switched on at build time
 * (NEXT_PUBLIC_VIDYA_LIVE_VOICE), but start-session serves only an allowlist.
 * With the flag baked into a production build, every teacher outside the
 * allowlist would have lost VIDYA's voice entirely ("Voice isn't available
 * right now", with no tap-to-talk fallback).
 *
 * Three guarantees:
 *  1. one decision (liveVoiceAccess) for start-session and the eligibility route;
 *  2. the eligibility route answers exactly that decision;
 *  3. no VIDYA surface reads the build flag directly: they all use the
 *     provider's server-decided `liveEnabled`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { liveVoiceAccess } from '@/lib/vidya-live/live-access';

const jsonSpy = jest.spyOn(NextResponse, 'json');

const SRC = path.resolve(__dirname, '../..');
const ON = { VIDYA_VOICE_LIVE_ENABLED: 'true', VIDYA_VOICE_LIVE_ALLOWED_UIDS: 'u-allowed, u-two', VIDYA_VOICE_STREAM_BASE_URL: 'https://voice.test', NODE_ENV: 'production' };

describe('liveVoiceAccess: one decision', () => {
    it('allows an allowlisted uid and names the voice service', () => {
        expect(liveVoiceAccess('u-allowed', ON)).toEqual({ ok: true, baseUrl: 'https://voice.test' });
        expect(liveVoiceAccess('u-two', ON).ok).toBe(true);
    });
    it('refuses a uid outside the allowlist', () => {
        expect(liveVoiceAccess('u-other', ON)).toEqual({ ok: false, reason: 'not_allowlisted' });
    });
    it('refuses everyone when the flag is off', () => {
        expect(liveVoiceAccess('u-allowed', { ...ON, VIDYA_VOICE_LIVE_ENABLED: 'false' })).toEqual({ ok: false, reason: 'disabled' });
    });
    it('ignores the * wildcard in production, honours it locally', () => {
        expect(liveVoiceAccess('anyone', { ...ON, VIDYA_VOICE_LIVE_ALLOWED_UIDS: '*' }).ok).toBe(false);
        expect(liveVoiceAccess('anyone', { ...ON, VIDYA_VOICE_LIVE_ALLOWED_UIDS: '*', NODE_ENV: 'development' }).ok).toBe(true);
    });
    it('refuses when no voice service is configured, and falls back to the agents URL', () => {
        const { VIDYA_VOICE_STREAM_BASE_URL: _drop, ...noStream } = ON;
        expect(liveVoiceAccess('u-allowed', noStream)).toEqual({ ok: false, reason: 'no_base_url' });
        expect(liveVoiceAccess('u-allowed', { ...noStream, NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL: 'https://agents.test' })).toEqual({ ok: true, baseUrl: 'https://agents.test' });
    });
});

describe('GET /api/vidya-voice/eligibility', () => {
    const saved = { ...process.env };
    afterEach(() => {
        process.env = { ...saved };
    });
    async function ask(uid: string | null) {
        const { GET } = await import('@/app/api/vidya-voice/eligibility/route');
        const req = { headers: { get: (k: string) => (k === 'x-user-id' ? uid : null) } } as any;
        const res = await GET(req);
        const calls = jsonSpy.mock.calls;
        return { status: res.status, body: calls[calls.length - 1]?.[0] };
    }
    it('answers exactly liveVoiceAccess for the signed-in uid', async () => {
        Object.assign(process.env, ON);
        await expect(ask('u-allowed')).resolves.toEqual({ status: 200, body: { live: true } });
        await expect(ask('u-other')).resolves.toEqual({ status: 200, body: { live: false } });
    });
    it('says no without a signed-in uid', async () => {
        Object.assign(process.env, ON);
        await expect(ask(null)).resolves.toEqual({ status: 401, body: { live: false } });
    });
});

describe('every surface uses the server-decided switch', () => {
    function files(dir: string): string[] {
        return readdirSync(dir).flatMap((name) => {
            const full = path.join(dir, name);
            if (name === '__tests__' || name === 'node_modules') return [];
            return statSync(full).isDirectory() ? files(full) : /\.(tsx?|jsx?)$/.test(name) ? [full] : [];
        });
    }
    const all = files(SRC);

    it('scans the source tree', () => {
        expect(all.length).toBeGreaterThan(500);
    });

    it.each(['NEXT_PUBLIC_VIDYA_LIVE_VOICE', 'VIDYA_LIVE_VOICE_ENABLED'])('only the provider reads %s', (flag) => {
        const readers = all
            .filter((f) => readFileSync(f, 'utf8').includes(flag))
            .map((f) => path.relative(SRC, f));
        expect(readers).toEqual([path.join('components', 'vidya', 'vidya-live-provider.tsx')]);
    });

    it('start-session decides access through liveVoiceAccess, with no allowlist of its own', () => {
        const route = readFileSync(path.join(SRC, 'app/api/vidya-voice/start-session/route.ts'), 'utf8');
        expect(route).toMatch(/liveVoiceAccess\(uid\)/);
        expect(route).not.toMatch(/VIDYA_VOICE_LIVE_ALLOWED_UIDS|parseAllowlist/);
    });
});
