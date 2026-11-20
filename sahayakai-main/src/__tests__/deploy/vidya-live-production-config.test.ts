/**
 * Class gate: production ships Live VIDYA the way staging does, in BOTH regions.
 *
 * The bug: staging baked NEXT_PUBLIC_VIDYA_LIVE_VOICE=1 and pointed the browser's
 * voice socket at a public voice service, but production's cloudbuild.yaml did
 * neither, so production silently ran the old tap-to-talk VIDYA (24 s
 * voice-to-text) while staging ran hands-free Live VIDYA. This gate reads the
 * production build config itself:
 *  - the image is built with the Live VIDYA flag;
 *  - both region deploys set the same voice-service URL, and it is the VIDYA
 *    voice service (never the parent-call engine or the IAM-only agents service);
 *  - both bind the Live allowlist from Secret Manager (uids stay out of the public repo).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const CONFIG = readFileSync(path.resolve(__dirname, '../../../cloudbuild.yaml'), 'utf8');

function envOf(line: string): Record<string, string> {
    const body = line.replace(/^\s*- --update-env-vars=/, '');
    return Object.fromEntries(body.split(',').map((kv) => [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)]));
}

const envLines = CONFIG.split('\n').filter((l) => /^\s*- --update-env-vars=/.test(l));
const secretLines = CONFIG.split('\n').filter((l) => /^\s*- --update-secrets=/.test(l));

describe('production cloudbuild.yaml: Live VIDYA', () => {
    it('deploys two regions', () => {
        expect(envLines).toHaveLength(2);
        expect(secretLines).toHaveLength(2);
    });

    it('builds the image with the Live VIDYA flag', () => {
        expect(CONFIG).toMatch(/^\s*- --build-arg=NEXT_PUBLIC_VIDYA_LIVE_VOICE=1\s*$/m);
    });

    it('points both regions at the same public VIDYA voice service', () => {
        const urls = envLines.map((l) => envOf(l).VIDYA_VOICE_STREAM_BASE_URL);
        expect(urls[0]).toMatch(/^https:\/\/sahayakai-vidya-voice-[a-z0-9.-]+\.run\.app$/);
        expect(urls[1]).toBe(urls[0]);
        for (const u of urls) expect(u).not.toMatch(/sahayakai-telephony|sahayakai-agents/);
        for (const l of envLines) expect(envOf(l).VIDYA_VOICE_LIVE_ENABLED).toBe('true');
    });

    it('binds the Live allowlist from Secret Manager in both regions', () => {
        for (const l of secretLines) expect(l).toMatch(/VIDYA_VOICE_LIVE_ALLOWED_UIDS=VIDYA_VOICE_LIVE_ALLOWED_UIDS:latest/);
        for (const l of envLines) expect(envOf(l).VIDYA_VOICE_LIVE_ALLOWED_UIDS).toBeUndefined();
    });
});
