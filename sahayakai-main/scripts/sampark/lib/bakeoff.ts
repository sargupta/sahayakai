/**
 * Voice bake-off core (docs/sampark/VOICE_BAKEOFF.md). Pure of I/O except the
 * optional audio directory, and driven entirely through injected ports, so
 * jest covers it with a fake synthesizer and a fake transcriber.
 *
 * For every candidate voice profile x the existing reviewed script set of its
 * language and purpose group, it renders each clip through a pluggable
 * `Synthesizer`, then runs the SAME gates production runs on a clip
 * (`synthesizeClip`: lead-in silence on the message, Chirp 2 transcribe-back at
 * similarity >= 0.85, runaway-length check, up to two re-renders) plus the
 * message-and-menu length budget, and emits a scorecard per language/profile.
 * Native-reviewer columns are left blank for people to fill.
 */

import fs from 'node:fs';
import path from 'node:path';

import { availablePurposes } from '@/lib/sampark/catalogue';
import { toSpeechConfig, type SpeechEngineConfig } from '@/lib/sampark/languages';
import type { Clock, SpeechVerifier } from '@/lib/sampark/ports';
import { MESSAGE_AND_MENU_BUDGET_SECONDS } from '@/lib/sampark/scripts/render';
import { SAMPLE_SCHOOL, SAMPLE_SECTION_AUDIENCE, sampleFactsFor } from '@/lib/sampark/scripts/samples';
import { MESSAGE_LEAD_IN_SECONDS, neededClips, synthesizeClip } from '@/lib/sampark/speech/render-job';
import { asSpeechSynthesizer, type Synthesizer } from '@/lib/sampark/speech/synthesizer';
import { VERIFY_THRESHOLD } from '@/lib/sampark/speech/verify';
import {
    allVoiceProfiles,
    languageOfCode,
    purposeGroup,
    VOICE_PURPOSE_GROUPS,
    type VoiceProfile,
    type VoicePurposeGroup,
} from '@/lib/sampark/voice-profile';
import type { ParentLanguage, ParentLanguageCode, PurposeId } from '@/types/sampark';

/** One billing unit of a call is 60 seconds; the message-and-menu budget (38 s) leaves room for the rest of the call. */
export const BILLING_UNIT_SECONDS = 60;

/** A profile in a bake-off: a production profile, or a benchmark-only one with provider "elevenlabs". */
export type BakeoffProfile = Omit<VoiceProfile, 'provider'> & { provider: VoiceProfile['provider'] | 'elevenlabs' };

/** Production profiles that are worth hearing: current and candidate (rejected ones are history). */
export function productionBakeoffProfiles(): BakeoffProfile[] {
    return allVoiceProfiles().filter((p) => p.status !== 'rejected');
}

// ── Clips ───────────────────────────────────────────────────────────────────

export interface BakeoffClip {
    purpose: PurposeId;
    variant: string;
    kind: string;
    text: string;
}

export interface ClipSet {
    clips: BakeoffClip[];
    /** Purposes in the group that could not be rendered (no sample facts, a script error): shown, never hidden. */
    problems: string[];
}

/** The existing reviewed scripts (available purposes only) for one language and purpose group. */
export function bakeoffClips(language: ParentLanguage, group: VoicePurposeGroup): ClipSet {
    const seen = new Set<string>();
    const clips: BakeoffClip[] = [];
    const problems: string[] = [];
    for (const spec of availablePurposes()) {
        if (purposeGroup(spec.id) !== group) continue;
        let needed;
        try {
            needed = neededClips(spec.id, sampleFactsFor(spec.id), SAMPLE_SCHOOL, SAMPLE_SECTION_AUDIENCE, [language]);
        } catch (err) {
            problems.push(`${spec.id}: ${err instanceof Error ? err.message : String(err)}`);
            continue;
        }
        for (const c of needed) {
            const k = `${c.kind}|${c.text}`;
            if (seen.has(k)) continue;
            seen.add(k);
            clips.push({ purpose: spec.id, variant: c.variant, kind: c.kind, text: c.text });
        }
    }
    return { clips, problems };
}

// ── Scorecard ───────────────────────────────────────────────────────────────

export interface ClipResult extends BakeoffClip {
    file: string | null;
    chars: number;
    durationSeconds: number;
    similarity: number | null;
    transcript: string;
    /** Production transcribe-back + runaway gate. */
    verification: 'passed' | 'failed' | 'error';
    /** Message clips only: message + menu + lead-in within MESSAGE_AND_MENU_BUDGET_SECONDS. */
    lengthOk: boolean;
    /** Longer than one 60 s billing unit. */
    overBillingUnit: boolean;
    gatePass: boolean;
    error?: string;
}

/** Filled by native reviewers, never by the harness. Scores are 1-5. */
export interface ListeningColumns {
    /** Names, numbers and dates pronounced correctly. */
    pronunciation: number | null;
    warmth: number | null;
    /** Clear on a phone line (8 kHz, small speaker). */
    clarity: number | null;
    reviewer: string;
    date: string;
    verdict: '' | 'approved' | 'needs_work' | 'rejected';
}

export interface ScorecardSummary {
    clips: number;
    passed: number;
    failed: number;
    minSimilarity: number | null;
    meanSimilarity: number | null;
    maxDurationSeconds: number;
    maxMessageSeconds: number;
    /** Longest message clip as a percentage of one 60 s billing unit. */
    messageBillingUnitPercent: number;
    gatePass: boolean;
}

export interface Scorecard {
    profileId: string;
    language: ParentLanguageCode;
    group: VoicePurposeGroup;
    provider: string;
    model: string | null;
    voice: string;
    localeCode: string;
    speakingRate: number | null;
    stylePrompt: string | null;
    status: VoiceProfile['status'];
    /** Why nothing was rendered (no scripts for the group yet, provider disabled, ...). */
    skipped: string | null;
    problems: string[];
    clips: ClipResult[];
    summary: ScorecardSummary;
    listening: ListeningColumns;
}

export const BLANK_LISTENING: Readonly<ListeningColumns> = Object.freeze({
    pronunciation: null,
    warmth: null,
    clarity: null,
    reviewer: '',
    date: '',
    verdict: '',
});

const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

export function summarise(clips: ClipResult[]): ScorecardSummary {
    const sims = clips.map((c) => c.similarity).filter((s): s is number => typeof s === 'number');
    const messages = clips.filter((c) => c.kind === 'message');
    const maxMessage = messages.reduce((m, c) => Math.max(m, c.durationSeconds), 0);
    const passed = clips.filter((c) => c.gatePass).length;
    return {
        clips: clips.length,
        passed,
        failed: clips.length - passed,
        minSimilarity: sims.length ? Math.min(...sims) : null,
        meanSimilarity: sims.length ? round(sims.reduce((s, x) => s + x, 0) / sims.length) : null,
        maxDurationSeconds: round(clips.reduce((m, c) => Math.max(m, c.durationSeconds), 0), 2),
        maxMessageSeconds: round(maxMessage, 2),
        messageBillingUnitPercent: round((maxMessage / BILLING_UNIT_SECONDS) * 100, 1),
        gatePass: clips.length > 0 && passed === clips.length,
    };
}

/** The engine config handed to `synthesizeClip`. For a benchmark-only provider the engine id is a stand-in: only the STT code and the pass-through matter. */
export function standInSpeech(profile: BakeoffProfile): SpeechEngineConfig {
    return toSpeechConfig({ ...profile, provider: profile.provider as VoiceProfile['provider'] });
}

// ── Running ─────────────────────────────────────────────────────────────────

export interface BakeoffOptions {
    profiles: BakeoffProfile[];
    /** Synthesizer by provider id. A provider with none is reported as skipped, not failed. */
    synthesizers: Partial<Record<string, Synthesizer>>;
    verifier: SpeechVerifier;
    /** Limit to these languages / groups (default all). */
    languages?: ParentLanguageCode[];
    groups?: VoicePurposeGroup[];
    concurrency?: number;
    /** Write each rendered clip as <dir>/<lang>/<profile>/<group>/<purpose>-<variant>-<kind>.wav. */
    audioDir?: string;
    clock?: Clock;
    /** Why a provider has no synthesizer, for the skipped note. */
    skipReasons?: Partial<Record<string, string>>;
    onProgress?: (line: string) => void;
}

async function mapBounded<T>(items: readonly T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
    let next = 0;
    await Promise.all(
        Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
            while (next < items.length) await fn(items[next++]);
        }),
    );
}

function skippedCard(profile: BakeoffProfile, group: VoicePurposeGroup, reason: string, problems: string[] = []): Scorecard {
    return {
        profileId: profile.id,
        language: profile.language,
        group,
        provider: profile.provider,
        model: profile.model,
        voice: profile.voice,
        localeCode: profile.localeCode,
        speakingRate: profile.speakingRate,
        stylePrompt: profile.stylePrompt,
        status: profile.status,
        skipped: reason,
        problems,
        clips: [],
        summary: summarise([]),
        listening: { ...BLANK_LISTENING },
    };
}

export async function runBakeoff(opts: BakeoffOptions): Promise<Scorecard[]> {
    const clock: Clock = opts.clock ?? { now: () => new Date() };
    const cards: Scorecard[] = [];
    for (const profile of opts.profiles) {
        if (opts.languages && !opts.languages.includes(profile.language)) continue;
        const language = languageOfCode(profile.language);
        const groups = (profile.group === '*' ? [...VOICE_PURPOSE_GROUPS] : [profile.group]).filter((g) => !opts.groups || opts.groups.includes(g));
        for (const group of groups) {
            const { clips, problems } = bakeoffClips(language, group);
            if (clips.length === 0) {
                // The current profile of each group already reports "no scripts yet"; a '*' candidate stays quiet about it.
                if (profile.group === '*') continue;
                cards.push(skippedCard(profile, group, 'no reviewed scripts for this purpose group yet', problems));
                continue;
            }
            const synth = opts.synthesizers[profile.provider];
            if (!synth) {
                cards.push(skippedCard(profile, group, opts.skipReasons?.[profile.provider] ?? `no synthesizer available for ${profile.provider}`, problems));
                continue;
            }
            const speech = standInSpeech(profile);
            const deps = { synth: asSpeechSynthesizer(synth, profile), verifier: opts.verifier, clock };
            const results: ClipResult[] = [];
            await mapBounded(clips, opts.concurrency ?? 3, async (clip) => {
                const base = { ...clip, chars: Array.from(clip.text).length };
                try {
                    const out = await synthesizeClip(deps, { kind: clip.kind as never, text: clip.text, language, speech });
                    let file: string | null = null;
                    if (opts.audioDir) {
                        const dir = path.join(opts.audioDir, profile.language, profile.id, group);
                        fs.mkdirSync(dir, { recursive: true });
                        file = path.join(dir, `${clip.purpose}-${clip.variant}-${clip.kind}.wav`);
                        fs.writeFileSync(file, out.audio);
                        file = path.relative(opts.audioDir, file);
                    }
                    const isMessage = clip.kind === 'message';
                    const lengthOk = !isMessage || out.durationSeconds <= MESSAGE_AND_MENU_BUDGET_SECONDS;
                    const verified = out.verification.status === 'passed';
                    const result: ClipResult = {
                        ...base,
                        file,
                        durationSeconds: out.durationSeconds,
                        similarity: out.verification.similarity ?? null,
                        transcript: out.verification.transcript ?? '',
                        verification: verified ? 'passed' : 'failed',
                        lengthOk,
                        overBillingUnit: out.durationSeconds > BILLING_UNIT_SECONDS,
                        gatePass: verified && lengthOk,
                    };
                    results.push(result);
                    opts.onProgress?.(`${result.gatePass ? 'ok  ' : 'FAIL'} ${profile.id} ${group} ${clip.purpose}/${clip.variant}/${clip.kind} ${out.durationSeconds}s sim=${result.similarity}`);
                } catch (err) {
                    const error = err instanceof Error ? err.message : String(err);
                    results.push({ ...base, file: null, durationSeconds: 0, similarity: null, transcript: '', verification: 'error', lengthOk: false, overBillingUnit: false, gatePass: false, error });
                    opts.onProgress?.(`ERR  ${profile.id} ${group} ${clip.purpose}/${clip.variant}/${clip.kind}: ${error}`);
                }
            });
            const order = (r: ClipResult) => `${r.purpose}|${r.variant}|${['message', 'confirm_1', 'confirm_2'].indexOf(r.kind) + 1 || 9}|${r.kind}`;
            results.sort((a, b) => order(a).localeCompare(order(b)));
            cards.push({
                profileId: profile.id,
                language: profile.language,
                group,
                provider: profile.provider,
                model: profile.model,
                voice: profile.voice,
                localeCode: profile.localeCode,
                speakingRate: profile.speakingRate,
                stylePrompt: profile.stylePrompt,
                status: profile.status,
                skipped: null,
                problems,
                clips: results,
                summary: summarise(results),
                // The profile's own sign-off (data) pre-fills the verdict columns; scores stay blank for people.
                listening: { ...BLANK_LISTENING, reviewer: profile.review.reviewer, date: profile.review.date, verdict: profile.review.verdict },
            });
        }
    }
    return cards;
}

// ── Decision rule ───────────────────────────────────────────────────────────

export interface Decision {
    language: ParentLanguageCode;
    group: VoicePurposeGroup;
    /** The profile that should speak this group, or null when no profile has run. */
    winner: string | null;
    current: string | null;
    changed: boolean;
    reason: string;
}

/**
 * The decision rule (VOICE_BAKEOFF.md section 6), mechanised:
 *   a profile is ELIGIBLE only if every clip passed every gate AND it carries a native
 *   reviewer's sign-off (reviewer named, verdict "approved");
 *   among eligible profiles the higher mean transcribe-back similarity wins, current on ties;
 *   NEPALI stays on its current profile unless an eligible candidate has a strictly higher
 *   mean similarity than the current one (it also needs the Nepali reviewer's sign-off, which
 *   eligibility already requires).
 * If nothing is eligible the current profile stays. A group whose current profile did not run
 * is reported as undecided, never silently changed.
 */
export function decideWinners(cards: Scorecard[]): Decision[] {
    const decisions: Decision[] = [];
    const keys = new Set(cards.map((c) => `${c.language}|${c.group}`));
    for (const key of keys) {
        const [language, group] = key.split('|') as [ParentLanguageCode, VoicePurposeGroup];
        const mine = cards.filter((c) => c.language === language && c.group === group && !c.skipped);
        const current = mine.find((c) => c.status === 'current') ?? null;
        const eligible = mine.filter((c) => c.summary.gatePass && c.listening.verdict === 'approved' && c.listening.reviewer.trim() !== '');
        const sim = (c: Scorecard) => c.summary.meanSimilarity ?? 0;
        if (mine.length === 0) {
            decisions.push({ language, group, winner: null, current: null, changed: false, reason: 'no profile has run for this group (no scripts yet or all skipped)' });
            continue;
        }
        const challengers = eligible.filter((c) => c.status !== 'current');
        const best = challengers.sort((a, b) => sim(b) - sim(a))[0];
        const currentEligible = current && eligible.includes(current);
        let winner = current;
        let reason = 'no eligible challenger: the current profile stays';
        if (best) {
            const beats = !currentEligible || sim(best) > sim(current!);
            if (beats) {
                winner = best;
                reason = `${best.profileId} passed every gate with reviewer sign-off (${best.listening.reviewer}) and ${currentEligible ? 'out-scored' : 'replaces a current profile that is not eligible:'} ${current?.profileId ?? 'the current profile'}`;
            } else {
                reason = `${best.profileId} is eligible but does not beat ${current!.profileId}: the current profile stays`;
            }
        }
        if (language === 'ne' && winner && winner !== current && !(current && sim(winner) > sim(current))) {
            winner = current;
            reason = 'Nepali stays on the current profile unless a candidate strictly beats it with Nepali reviewer sign-off';
        }
        decisions.push({
            language,
            group,
            winner: winner?.profileId ?? null,
            current: current?.profileId ?? null,
            changed: !!winner && !!current && winner.profileId !== current.profileId,
            reason,
        });
    }
    return decisions.sort((a, b) => `${a.language}${a.group}`.localeCompare(`${b.language}${b.group}`));
}

// ── Output ──────────────────────────────────────────────────────────────────

const cell = (v: unknown) => (v === null || v === undefined || v === '' ? '' : String(v).replace(/\|/g, '\\|').replace(/\n/g, ' '));

export function renderScorecardMarkdown(cards: Scorecard[], meta: { generatedAt: string; dryRun: boolean }): string {
    const lines: string[] = [];
    lines.push('# Sampark voice bake-off scorecard', '');
    lines.push(
        `Generated ${meta.generatedAt}${meta.dryRun ? ' in **DRY-RUN mode (fake synthesizer and fake transcriber): these numbers prove the harness, not any voice**' : ''}.`,
        '',
        `Gates: every clip transcribes back at similarity >= ${VERIFY_THRESHOLD} without a runaway length; every message clip (message + menu + ${MESSAGE_LEAD_IN_SECONDS} s lead-in) lasts <= ${MESSAGE_AND_MENU_BUDGET_SECONDS} s. The ${BILLING_UNIT_SECONDS} s column is the longest message as a share of one billing unit. Listening columns are blank for native reviewers (scores 1-5).`,
        '',
    );
    const langs = [...new Set(cards.map((c) => c.language))];
    for (const lang of langs) {
        lines.push(`## ${languageOfCode(lang)} (${lang})`, '');
        const ran = cards.filter((c) => c.language === lang && !c.skipped);
        const skipped = cards.filter((c) => c.language === lang && c.skipped);
        if (ran.length) {
            lines.push('| Profile | Group | Provider / model / voice | Rate | Clips ok | Min sim | Mean sim | Max msg (s) | % of 60 s | Gates | Pronunciation | Warmth | Phone clarity | Reviewer | Date | Verdict |');
            lines.push('|---|---|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---|---|---|');
            for (const c of ran) {
                const s = c.summary;
                lines.push(
                    `| ${cell(c.profileId)} (${c.status}) | ${c.group} | ${cell(`${c.provider} / ${c.model ?? '-'} / ${c.voice} / ${c.localeCode}`)} | ${cell(c.speakingRate)} | ${s.passed}/${s.clips} | ${cell(s.minSimilarity)} | ${cell(s.meanSimilarity)} | ${s.maxMessageSeconds} | ${s.messageBillingUnitPercent} | ${s.gatePass ? 'PASS' : 'FAIL'} | ${cell(c.listening.pronunciation)} | ${cell(c.listening.warmth)} | ${cell(c.listening.clarity)} | ${cell(c.listening.reviewer)} | ${cell(c.listening.date)} | ${cell(c.listening.verdict)} |`,
                );
            }
            lines.push('');
            const failing = ran.flatMap((c) => c.clips.filter((k) => !k.gatePass).map((k) => ({ c, k })));
            if (failing.length) {
                lines.push('Failing clips:', '');
                for (const { c, k } of failing) {
                    lines.push(`- ${c.profileId} ${c.group} ${k.purpose}/${k.variant}/${k.kind}: ${k.error ? `ERROR ${cell(k.error)}` : `similarity ${k.similarity}, ${k.durationSeconds} s${k.lengthOk ? '' : ' (over the message budget)'}, heard "${cell(k.transcript)}"`}`);
                }
                lines.push('');
            }
        }
        if (skipped.length) {
            lines.push('Not run:', '');
            for (const c of skipped) lines.push(`- ${c.profileId} / ${c.group}: ${c.skipped}`);
            lines.push('');
        }
    }
    const decisions = decideWinners(cards);
    lines.push('## Decision rule applied to this run', '');
    lines.push('| Language | Group | Current | Winner | Changed | Reason |', '|---|---|---|---|---|---|');
    for (const d of decisions) lines.push(`| ${d.language} | ${d.group} | ${cell(d.current)} | ${cell(d.winner)} | ${d.changed ? 'YES' : 'no'} | ${cell(d.reason)} |`);
    lines.push('');
    return lines.join('\n');
}

export function writeScorecard(outDir: string, cards: Scorecard[], meta: { dryRun: boolean }): { json: string; markdown: string } {
    fs.mkdirSync(outDir, { recursive: true });
    const generatedAt = new Date().toISOString();
    const json = path.join(outDir, 'scorecard.json');
    const markdown = path.join(outDir, 'SCORECARD.md');
    fs.writeFileSync(json, JSON.stringify({ generatedAt, dryRun: meta.dryRun, decisions: decideWinners(cards), scorecards: cards }, null, 2));
    fs.writeFileSync(markdown, renderScorecardMarkdown(cards, { generatedAt, dryRun: meta.dryRun }));
    return { json, markdown };
}
