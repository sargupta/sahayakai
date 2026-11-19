/**
 * Contract gate: the web app and the voice engine (services/voice-server)
 * still agree, checked from the WEB side on every pull request.
 *
 * The engine's own contract tests run only when voice-server files change, so
 * a web-only change (a new token format, a different suppression key, an edited
 * request line) could drift silently. This runs in the Test Suite, which has
 * no path filter, and reads the engine's shared fixtures:
 *
 *   - tests/fixtures/stream_token_format.json — the one token spelling the
 *     engine accepts. A token minted with the REAL mintVobizToken must match it.
 *   - tests/fixtures/suppression_digest.json — the do-not-call key. The web
 *     module's phoneSuppressionId must produce it (once that module is on the
 *     branch; until then Node's sha256 of the trimmed number stands in).
 *   - src/call_lines.json — the request-to-talk line, which must equal the web
 *     app's locales/call-scripts copy when that file exists.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

jest.mock('@/lib/secrets', () => ({
    getSecret: async () => 'contract-test-signing-key-not-a-secret-000000',
}));

import { VOBIZ_DOMAINS, mintVobizToken, vobizTokenMessage } from '@/lib/vobiz/tokens';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const ENGINE = path.join(APP_ROOT, 'services', 'voice-server');
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

describe('web ↔ voice engine contract', () => {
    const format = readJson(path.join(ENGINE, 'tests', 'fixtures', 'stream_token_format.json'));

    it('a stream token minted by the real web code is the one spelling the engine accepts', async () => {
        const shape = new RegExp(`^(?:${format.outreach_id})\\.(?:${format.exp})\\.(?:${format.signature})$`);
        // A Firestore auto-id (20 characters), as parent_outreach ids are.
        const { token } = await mintVobizToken(VOBIZ_DOMAINS.STREAM, 'OutreachFs0000000001');
        expect(token).toMatch(shape);
        expect(VOBIZ_DOMAINS.STREAM).toBe(format.domain);
        expect(vobizTokenMessage(VOBIZ_DOMAINS.STREAM, 'x', 1)).toBe(`${format.domain}.x.1`);
    });

    it('the do-not-call key is the digest the engine writes', () => {
        const fixture = readJson(path.join(ENGINE, 'tests', 'fixtures', 'suppression_digest.json'));
        const modulePath = path.join(APP_ROOT, 'src', 'lib', 'call-suppression.ts');
        const digestOf: (e164: string) => string = existsSync(modulePath)
            ? require('@/lib/call-suppression').phoneSuppressionId
            : (e164: string) => createHash('sha256').update(e164.trim(), 'utf8').digest('hex');
        expect(fixture.cases.length).toBeGreaterThan(0);
        for (const c of fixture.cases) {
            expect(digestOf(c.phone)).toBe(c.digest);
        }
    });

    it('the engine speaks the same request-to-talk line as the web app', () => {
        const engine = readJson(path.join(ENGINE, 'src', 'call_lines.json')).lines;
        const webFile = path.join(APP_ROOT, 'src', 'locales', 'call-scripts', 'request-to-talk.json');
        expect(engine['en-IN'].request_to_talk).toBe(
            "Your child's class teacher would like to speak with you this week. Is there a good time for a short call?",
        );
        if (!existsSync(webFile)) return; // the web copy lands with its own PR
        const web = readJson(webFile).lines;
        const codes: Record<string, string> = {
            English: 'en-IN', Hindi: 'hi-IN', Kannada: 'kn-IN', Tamil: 'ta-IN', Telugu: 'te-IN',
            Malayalam: 'ml-IN', Bengali: 'bn-IN', Marathi: 'mr-IN', Gujarati: 'gu-IN', Punjabi: 'pa-IN',
        };
        for (const [language, code] of Object.entries(codes)) {
            expect([language, engine[code].request_to_talk]).toEqual([language, web[language]]);
        }
    });
});
