/**
 * @jest-environment node
 *
 * The bake-off harness in dry-run: fake synthesizer + fake transcriber drive the REAL gates
 * (synthesizeClip: transcribe-back similarity, runaway length; plus the message budget).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createGoogleProfileSynthesizer } from '@/lib/sampark/speech/synthesizer';
import { fakeFetch, fakeMulawWav } from '../speech/helpers';

import {
    BILLING_UNIT_SECONDS,
    bakeoffClips,
    decideWinners,
    productionBakeoffProfiles,
    renderScorecardMarkdown,
    runBakeoff,
    summarise,
    writeScorecard,
    type BakeoffProfile,
    type Scorecard,
} from '../../../../scripts/sampark/lib/bakeoff';
import { createFakeSpeech } from '../../../../scripts/sampark/lib/fakes';
import { parseArgs, selectProfiles } from '../../../../scripts/sampark/voice-bakeoff';

const ALL = productionBakeoffProfiles();
const byId = (id: string) => ALL.find((p) => p.id === id)!;

function allProviders(synth: ReturnType<typeof createFakeSpeech>['synth']) {
    return { 'gemini-tts': synth, 'chirp3-hd': synth, 'sarvam-bulbul': synth };
}

describe('clip set', () => {
    it('is the existing reviewed scripts of the language, by purpose group', () => {
        const ptm = bakeoffClips('Nepali', 'ptm_event_invite');
        expect(ptm.clips.some((c) => c.purpose === 'ptm_invite' && c.kind === 'message')).toBe(true);
        expect(ptm.clips.some((c) => c.purpose === 'event_invite' && c.kind === 'message')).toBe(true);
        const closure = bakeoffClips('Nepali', 'closure_emergency');
        expect(closure.clips.filter((c) => c.kind === 'message').map((c) => c.variant).sort()).toEqual(['today', 'tomorrow']);
        // groups whose purposes have no reviewed scripts yet are empty, not an error
        expect(bakeoffClips('Hindi', 'fees_accounts').clips).toEqual([]);
        // no duplicates by kind + text
        const keys = ptm.clips.map((c) => `${c.kind}|${c.text}`);
        expect(new Set(keys).size).toBe(keys.length);
    });
});

describe('dry run over every production profile', () => {
    let cards: Scorecard[];
    const fake = createFakeSpeech();
    beforeAll(async () => {
        cards = await runBakeoff({ profiles: ALL, synthesizers: allProviders(fake.synth), verifier: fake.verifier, concurrency: 4 });
    });

    it('scores every profile that has scripts, and every clip passes with a faithful transcriber', () => {
        const ran = cards.filter((c) => !c.skipped);
        expect(ran.length).toBeGreaterThan(10);
        for (const c of ran) {
            expect(c.summary.gatePass).toBe(true);
            expect(c.summary.minSimilarity).toBe(1);
            expect(c.summary.maxMessageSeconds).toBeLessThanOrEqual(38);
            expect(c.summary.messageBillingUnitPercent).toBeCloseTo((c.summary.maxMessageSeconds / BILLING_UNIT_SECONDS) * 100, 0);
        }
    });

    it('each rendered clip went through the profile it was scored under', () => {
        expect(new Set(fake.calls.map((c) => c.provider))).toEqual(new Set(['gemini-tts', 'chirp3-hd', 'sarvam-bulbul']));
    });

    it('groups without scripts are reported as not run, once per current profile', () => {
        const skipped = cards.filter((c) => c.skipped);
        expect(skipped.every((c) => c.status === 'current' && /no reviewed scripts/.test(c.skipped!))).toBe(true);
        expect(skipped.map((c) => c.group)).toEqual(expect.arrayContaining(['fees_accounts', 'recognition', 'class_teacher_request']));
    });

    it('listening columns are blank for native reviewers', () => {
        for (const c of cards) {
            expect(c.listening).toEqual({ pronunciation: null, warmth: null, clarity: null, reviewer: '', date: '', verdict: '' });
        }
    });

    it('the markdown has the language sections, gate column, blank reviewer columns and the DRY-RUN banner', () => {
        const md = renderScorecardMarkdown(cards, { generatedAt: 'now', dryRun: true });
        expect(md).toMatch(/DRY-RUN mode/);
        expect(md).toMatch(/## Nepali \(ne\)/);
        expect(md).toMatch(/\| Pronunciation \| Warmth \| Phone clarity \| Reviewer \| Date \| Verdict \|/);
        expect(md).toMatch(/\| PASS \|  \|  \|  \|  \|  \|  \|/);
        expect(md).toMatch(/## Decision rule applied to this run/);
        expect(md).toMatch(/Not run:/);
    });

    it('writes scorecard.json and SCORECARD.md', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakeoff-'));
        try {
            const files = writeScorecard(dir, cards, { dryRun: true });
            const json = JSON.parse(fs.readFileSync(files.json, 'utf8'));
            expect(json.dryRun).toBe(true);
            expect(json.scorecards).toHaveLength(cards.length);
            expect(json.decisions.length).toBeGreaterThan(0);
            expect(fs.readFileSync(files.markdown, 'utf8')).toMatch(/# Sampark voice bake-off scorecard/);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('the gates actually bite', () => {
    const profiles = [byId('hi-ptm-event-invite-current')];

    it('a garbled transcript fails the transcribe-back gate', async () => {
        const fake = createFakeSpeech({ garble: (t) => t.length > 30 });
        const [card] = await runBakeoff({ profiles, synthesizers: allProviders(fake.synth), verifier: fake.verifier });
        expect(card.summary.gatePass).toBe(false);
        expect(card.clips.some((c) => c.verification === 'failed' && (c.similarity ?? 1) < 0.85)).toBe(true);
    });

    it('a message over 38 s fails the length budget; over 60 s is flagged as exceeding a billing unit', async () => {
        const fake = createFakeSpeech({ charsPerSecond: 3, stretch: () => 1 });
        const [card] = await runBakeoff({ profiles, synthesizers: allProviders(fake.synth), verifier: fake.verifier });
        const message = card.clips.find((c) => c.kind === 'message')!;
        expect(message.durationSeconds).toBeGreaterThan(60);
        expect(message.lengthOk).toBe(false);
        expect(message.overBillingUnit).toBe(true);
        expect(message.gatePass).toBe(false);
        expect(card.summary.messageBillingUnitPercent).toBeGreaterThan(100);
    });

    it('a runaway clip (voice adds words) fails even when the transcript is faithful', async () => {
        const fake = createFakeSpeech({ stretch: (t) => (t.length < 60 ? 4 : 1) });
        const [card] = await runBakeoff({ profiles, synthesizers: allProviders(fake.synth), verifier: fake.verifier });
        expect(card.clips.some((c) => c.verification === 'failed' && (c.similarity ?? 0) >= 0.85)).toBe(true);
        expect(card.summary.gatePass).toBe(false);
    });

    it('a synthesizer error is recorded per clip, not thrown', async () => {
        const fake = createFakeSpeech({ fail: (t) => t.length < 60 });
        const [card] = await runBakeoff({ profiles, synthesizers: allProviders(fake.synth), verifier: fake.verifier });
        const errors = card.clips.filter((c) => c.verification === 'error');
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].error).toMatch(/fake synthesizer failure/);
        expect(card.summary.gatePass).toBe(false);
    });

    it('a provider without a synthesizer is skipped with its reason, never silently scored', async () => {
        const fake = createFakeSpeech();
        const cards = await runBakeoff({
            profiles: [byId('hi-sarvam-priya')],
            synthesizers: { 'gemini-tts': fake.synth },
            verifier: fake.verifier,
            skipReasons: { 'sarvam-bulbul': 'flag off' },
        });
        expect(cards.length).toBeGreaterThan(0);
        for (const c of cards) {
            expect(c.skipped).toBe('flag off');
            expect(c.summary.gatePass).toBe(false);
        }
        expect(fake.calls).toHaveLength(0);
    });

    it('writes audio files when an audio dir is given', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakeoff-audio-'));
        try {
            const fake = createFakeSpeech();
            const [card] = await runBakeoff({ profiles: [byId('hi-closure-emergency-current')], synthesizers: allProviders(fake.synth), verifier: fake.verifier, audioDir: dir });
            expect(card.group).toBe('closure_emergency');
            for (const clip of card.clips) expect(fs.existsSync(path.join(dir, clip.file!))).toBe(true);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('language and group filters limit the run', async () => {
        const fake = createFakeSpeech();
        const cards = await runBakeoff({ profiles: ALL, synthesizers: allProviders(fake.synth), verifier: fake.verifier, languages: ['ne'], groups: ['closure_emergency'] });
        expect(new Set(cards.map((c) => `${c.language}/${c.group}`))).toEqual(new Set(['ne/closure_emergency']));
    });

    it('summarise handles an empty run', () => {
        expect(summarise([])).toMatchObject({ clips: 0, gatePass: false, meanSimilarity: null, maxMessageSeconds: 0 });
    });
});

describe('Google profile synthesizer reuses the production request', () => {
    it('sends the profile pace, locale and voice through Cloud TTS', async () => {
        const { impl, requests } = fakeFetch(() => ({ json: { audioContent: fakeMulawWav(1).toString('base64') } }));
        const synth = createGoogleProfileSynthesizer({ fetchImpl: impl, getAccessToken: async () => 't' });
        await synth.synthesize({ text: 'নমস্কার।', profile: byId('bn-chirp3-hd-kore-slow'), delivery: 'styled' });
        expect(requests[0].body).toEqual({
            input: { text: 'নমস্কার।' },
            voice: { languageCode: 'bn-IN', name: 'bn-IN-Chirp3-HD-Kore' },
            audioConfig: { audioEncoding: 'MULAW', sampleRateHertz: 8000, speakingRate: 0.9 },
        });
        await expect(synth.synthesize({ text: 'x', profile: byId('hi-sarvam-priya'), delivery: 'plain' })).rejects.toThrow(/cannot render provider/);
    });
});

describe('decision rule', () => {
    const card = (over: Partial<Scorecard> & { id: string; sim?: number; approved?: boolean; pass?: boolean }): Scorecard => ({
        profileId: over.id,
        language: over.language ?? 'hi',
        group: 'ptm_event_invite',
        provider: 'gemini-tts',
        model: null,
        voice: 'v',
        localeCode: 'hi-IN',
        speakingRate: null,
        stylePrompt: null,
        status: over.status ?? 'candidate',
        skipped: null,
        problems: [],
        clips: [],
        summary: { clips: 3, passed: 3, failed: 0, minSimilarity: over.sim ?? 0.95, meanSimilarity: over.sim ?? 0.95, maxDurationSeconds: 20, maxMessageSeconds: 20, messageBillingUnitPercent: 33, gatePass: over.pass ?? true },
        listening: { pronunciation: null, warmth: null, clarity: null, reviewer: over.approved ? 'Reviewer A' : '', date: '', verdict: over.approved ? 'approved' : '' },
    });

    it('all gates pass AND reviewer sign-off: a signed-off winner replaces the current', () => {
        const [d] = decideWinners([card({ id: 'cur', status: 'current', sim: 0.9 }), card({ id: 'new', sim: 0.97, approved: true })]);
        expect(d).toMatchObject({ winner: 'new', current: 'cur', changed: true });
    });
    it('a gate-passing candidate without sign-off never wins', () => {
        const [d] = decideWinners([card({ id: 'cur', status: 'current' }), card({ id: 'new', sim: 0.99 })]);
        expect(d).toMatchObject({ winner: 'cur', changed: false });
    });
    it('a signed-off candidate that fails a gate never wins', () => {
        const [d] = decideWinners([card({ id: 'cur', status: 'current' }), card({ id: 'new', approved: true, pass: false })]);
        expect(d).toMatchObject({ winner: 'cur', changed: false });
    });
    it('a signed-off candidate that is eligible but worse does not displace an eligible current', () => {
        const [d] = decideWinners([card({ id: 'cur', status: 'current', sim: 0.99, approved: true }), card({ id: 'new', sim: 0.9, approved: true })]);
        expect(d).toMatchObject({ winner: 'cur', changed: false });
    });
    it('Nepali stays on current unless a signed-off candidate strictly beats it', () => {
        const ne = (id: string, o: object) => card({ id, language: 'ne', ...o });
        expect(decideWinners([ne('cur', { status: 'current', sim: 0.97 }), ne('new', { sim: 0.97, approved: true })])[0]).toMatchObject({ winner: 'cur', changed: false });
        expect(decideWinners([ne('cur', { status: 'current', sim: 0.95 }), ne('new', { sim: 0.97, approved: false })])[0]).toMatchObject({ winner: 'cur', changed: false });
        expect(decideWinners([ne('cur', { status: 'current', sim: 0.95 }), ne('new', { sim: 0.97, approved: true })])[0]).toMatchObject({ winner: 'new', changed: true });
    });
    it('nothing run for a group is undecided, not changed', () => {
        const skipped = { ...card({ id: 'cur', status: 'current' }), skipped: 'no scripts' };
        expect(decideWinners([skipped])[0]).toMatchObject({ winner: null, changed: false });
    });
});

describe('CLI helpers', () => {
    it('parses flags and validates languages and groups', () => {
        const a = parseArgs(['--out', '/tmp/x', '--lang', 'ne,hi', '--groups', 'closure_emergency', '--dry-run', '--no-current', '--profiles', 'a,b', '--concurrency', '2']);
        expect(a).toMatchObject({ languages: ['ne', 'hi'], groups: ['closure_emergency'], dryRun: true, includeCurrent: false, profileIds: ['a', 'b'], concurrency: 2 });
        expect(() => parseArgs([])).toThrow(/usage/);
        expect(() => parseArgs(['--out', 'x', '--lang', 'xx'])).toThrow(/Unknown language/);
        expect(() => parseArgs(['--out', 'x', '--groups', 'nope'])).toThrow(/Unknown purpose group/);
    });
    it('selects profiles by id, optionally without the current ones', () => {
        expect(selectProfiles({ profileIds: ['hi-sarvam-priya'], includeCurrent: true }, ALL).map((p: BakeoffProfile) => p.id)).toEqual(['hi-sarvam-priya']);
        expect(() => selectProfiles({ profileIds: ['nope'], includeCurrent: true }, ALL)).toThrow(/Unknown profile/);
        expect(selectProfiles({ profileIds: undefined, includeCurrent: false }, ALL).every((p: BakeoffProfile) => p.status !== 'current')).toBe(true);
    });
});
