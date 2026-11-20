/**
 * Class gate: no real calling-provider resource id is committed. The repository is public.
 *
 * The bug this catches: the develop work committed the real ElevenLabs agent ids (the unified
 * SARGVISION agent, the Riya clone and its source), an agent branch id and the phone-number ids
 * behind the company caller ID, in launchers, `.env.example`, docs and test fixtures. With the
 * agent's authentication off, anyone holding an agent id can talk to it on the company's
 * account. Real ids belong in the operator's shell (RIYA_REAL_AGENT_ID, RIYA_REAL_PHONE_NUMBER_ID,
 * RIYA_REAL_SOURCE_AGENT_ID, RIYA_STAGING_PHONE_NUMBER_ID) or in Secret Manager.
 *
 * The first version listed three prefixes (`agent_`, `phnum_`, `agtbrch_`), so the real version id
 * of the same agent (`agtvrsn_…`) stayed in three tracked files with the gate green, and any other
 * ElevenLabs id kind (conversation, batch call, tool, knowledge base) would have passed too.
 *
 * The gate scans every tracked text file in the monorepo (as the phone-number gate does) for an
 * ElevenLabs-shaped id in either form:
 *  - a known prefix (`agent_`, `phnum_`, `agtbrch_`, `agtvrsn_`) and 20 or more id characters;
 *  - ANY short lowercase prefix (2-10 letters) and the ElevenLabs id body: 4 digits (the creation
 *    time) then 16 or more lowercase base-36 characters, at least one of them a letter.
 * An id passes only if it is visibly made up: its body starts with one digit four times (0000,
 * 1111, …), fake, localtest, other, source or simulated.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const MONOREPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
/** Binary formats, by extension: they hold no text an id could be pasted into. */
const BINARY = /\.(png|jpe?g|gif|webp|ico|icns|ulaw|wav|mp3|mp4|m4a|webm|pdf|woff2?|ttf|otf|zip|gz|jar|keystore|jks|xlsx|pptx|docx|skill)$/i;
/** Generated files (lockfiles, build output): produced from scanned sources; their runs are hashes. */
const GENERATED = /(^|\/)package-lock\.json$|(^|\/)[^/]+\.lock$|\.g\.dart$|(^|\/)qa\/results\/playwright-report\/|(^|\/)public\/(sw|workbox-[^/]+)\.js$/;
/** Known ElevenLabs prefixes: any 20+ character body. */
const NAMED_ID = /(?<![0-9a-z])(agent|phnum|agtbrch|agtvrsn)_([0-9a-z]{20,})(?![0-9a-z])/g;
/** Any short lowercase prefix with the ElevenLabs body shape (time-prefixed base 36). */
const SHAPED_ID = /(?<![0-9a-z])([a-z]{2,10})_(\d{4}(?=[0-9a-z]*[a-z])[0-9a-z]{16,})(?![0-9a-z])/g;
const MADE_UP = /^(([0-9])\2{3}|fake|localtest|other|source|simulated)/;

/** Every provider-shaped id in `text`, once each, as [kind, body]. */
function providerIds(text: string): Array<[string, string]> {
    const seen = new Map<number, [string, string]>();
    for (const re of [NAMED_ID, SHAPED_ID]) for (const m of text.matchAll(re)) if (!seen.has(m.index!)) seen.set(m.index!, [m[1], m[2]]);
    return [...seen.values()];
}

function trackedTextFiles(): string[] {
    // Every tracked text file in the monorepo, as the phone-number gate scans: the repo is public.
    const out = execFileSync('git', ['ls-files', '-z'], { cwd: MONOREPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return out.split('\0').filter((f) => f && !BINARY.test(f) && !GENERATED.test(f));
}

describe('no real calling-provider id is committed', () => {
    const files = trackedTextFiles();

    it('scans the tracked files at all', () => {
        // A gate that scans nothing reports green forever.
        expect(files.length).toBeGreaterThan(4000);
        for (const dir of ['sahayakai-main/', 'sahayakai-agents/', 'mock-school-crm/', 'sahayakai-flutter/', 'docs/', '.github/']) expect(files.some((f) => f.startsWith(dir))).toBe(true);
        expect(files).toContain('sahayakai-main/.env.example');
    });

    it('recognises a real-shaped id of any ElevenLabs kind and lets a made-up one through', () => {
        const body = '1234m5abcdefghijklmnopqrstuv';
        const flagged = (text: string) => providerIds(text).map(([kind, b]) => `${kind}:${MADE_UP.test(b) ? 'made-up' : 'real'}`);
        expect(flagged(`"agent_${body}"`)).toEqual(['agent:real']);
        // The id the first version missed: an agent version, here on the same line as a made-up agent id.
        expect(flagged(`(agent_${'fakeagent1'.padEnd(28, '0')}, version agtvrsn_${body})`)).toEqual(['agent:made-up', 'agtvrsn:real']);
        // Any other kind, by the body shape alone, also when it follows an underscore.
        expect(flagged(`conv_${body} btcal_${body} source_tool_${body}`)).toEqual(['conv:real', 'btcal:real', 'tool:real']);
        expect(flagged(`agtvrsn_${'fakeversion'.padEnd(28, '0')} conv_${'0000'.padEnd(28, 'a')}`)).toEqual(['agtvrsn:made-up', 'conv:made-up']);
        // Not ids: workflow node names, snake case, a long digit run.
        expect(flagged('node_athithi_guest_feedback edge_route_to_safe_exit run_20261115123456789012')).toEqual([]);
    });

    it('every provider id in a tracked file is visibly made up', () => {
        const found: string[] = [];
        for (const file of files) {
            let text: string;
            try {
                text = readFileSync(path.join(MONOREPO_ROOT, file), 'utf8');
            } catch {
                continue; // a submodule or a file removed in the working tree
            }
            for (const [kind, body] of providerIds(text)) {
                if (MADE_UP.test(body)) continue;
                // Report the place and the kind, never the id itself (CI logs are public too).
                found.push(`${file}: ${kind}_…${body.slice(-2)}`);
            }
        }
        expect(found).toEqual([]);
    });
});
