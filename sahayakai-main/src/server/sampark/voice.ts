/**
 * The Sampark voice runtime (contract §4): what happens on a real notice call
 * between "the phone was answered" and "the line went dead".
 *
 *   answer  → is this call still allowed to speak? If so, mark it answered and
 *             hand Vobiz the message + keypad menu. A call whose campaign was
 *             cancelled while it rang plays the withdrawn line instead (H4).
 *   gather  → one key from the parent: record it, play the matching clip. A key
 *             the menu does not offer replays the message once (H11, interim).
 *   status  → ring / hangup: move the call forward, then settle it.
 *   audio   → the WAV bytes behind every <Play>.
 *
 * Why the checks live HERE and not only at dial time: a call is placed minutes
 * before it is answered, and the world can change in between — the calling
 * window closes at 20:00, an admin flips the school back to practice, the
 * campaign is cancelled, someone presses the kill switch. The answer webhook is
 * the last moment we can still say nothing, so it re-checks everything that
 * decides whether a parent may hear a message, and refuses with a clean hangup.
 *
 * Rules every handler follows:
 *   - Vobiz does not sign callbacks, so each URL carries a domain-scoped signed
 *     token (voice/tokens.ts); a token for one endpoint opens no other.
 *   - Every event is applied through repo.mutateCall: ring, answer, keypad and
 *     hangup callbacks arrive concurrently, and the forward-only reducer only
 *     holds if each event is applied to the latest state.
 *   - Callbacks are retried, so everything is idempotent; keypad tokens are
 *     single-use (repo.burnToken), so a replayed URL cannot press 9 twice.
 *   - Only a clip whose transcribe-back check PASSED is ever put in a <Play>, and
 *     only one the campaign froze when it was scheduled (H4), so an edit to the
 *     school's settings never silences an answered call.
 *   - Every URL handed to Vobiz is built from SAMPARK_PUBLIC_BASE_URL, never
 *     from the request's Host header (plan §16 row 21; class gate (d)).
 *   - A 9 is never lost: a keypress that lands after the hangup still opts the
 *     family out.
 *   - Phone numbers (From / To) are never logged.
 */

import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { purposeSpec, type MenuSpec, type PurposeSpec } from '@/lib/sampark/catalogue';
import { recordOptOut, settleCall } from '@/lib/sampark/dispatch/settle';
import { applyCallEvent, isTerminal } from '@/lib/sampark/dispatch/state';
import { languageInfo } from '@/lib/sampark/languages';
import { suppressionApplies } from '@/lib/sampark/policy/gate';
import { pauseStopsPurpose } from '@/lib/sampark/policy/pause';
import { samparkWindowVerdict } from '@/lib/sampark/policy/window';
import type { AudioStore, Clock, SamparkRepo } from '@/lib/sampark/ports';
import { audienceLabelFor, renderNoticeScript } from '@/lib/sampark/scripts/render';
import { clipKey } from '@/lib/sampark/speech/clip-key';
import {
    mintSamparkVoiceToken,
    parseVoicePrincipal,
    SAMPARK_VOICE_TTL_SECONDS,
    tokenBurnKey,
    tokenExpiry,
    verifySamparkVoiceToken,
    voicePrincipal,
    type SamparkVoiceDomain,
} from '@/lib/sampark/voice/tokens';
import { hangupEventFromVobiz } from '@/lib/sampark/voice/vobiz-events';
import { EMPTY_HANGUP_XML, noticeAnswerXml, optOutConfirmXml, playThenHangupXml } from '@/lib/sampark/voice/xml';
import type { Campaign, CallOutcome, ClipKind, PurposeId, SamparkCall, SamparkSchool, SchoolPause } from '@/types/sampark';
import { mulawSamples } from '@/lib/sampark/speech/wav';
import { toPcm16Wav } from '@/server/sampark/audio-format';
import { clipKeySlot } from '@/server/sampark/campaigns';
import { samparkPublicBaseUrl } from '@/server/sampark/carrier';

const LOG = 'SAMPARK_VOICE';

/** Paths of the four webhooks, joined to SAMPARK_PUBLIC_BASE_URL. The carrier builds answer/status URLs from the same base. */
export const SAMPARK_VOICE_PATHS = {
    answer: '/api/webhooks/sampark-voice/answer',
    gather: '/api/webhooks/sampark-voice/gather',
    status: '/api/webhooks/sampark-voice/status',
    /** `${audio}/<token>.wav` — the URL must END in .wav (no query string): see the clip route. */
    audio: '/api/webhooks/sampark-voice/clip',
} as const;

/** Seconds Vobiz waits for a key after the prompt has finished playing. */
export const GATHER_TIMEOUT_SECONDS = 8;

/** failureReason on a call that was answered but had no verified audio to play. */
export const AUDIO_UNAVAILABLE = 'audio_unavailable';

export interface VoiceDeps {
    repo: SamparkRepo;
    clock: Clock;
}

/** Which keypad prompt a gather callback answers; decided by the token's domain, never by a query parameter. */
export type VoiceStep = 'menu' | 'optout';

export type VoiceOutcome =
    | 'played'
    /** The campaign was cancelled while the phone rang: the withdrawn line was played (H4). */
    | 'withdrawn'
    /** A key the menu does not offer: the message and its menu were played again, once (H11). */
    | 'menu_repeated'
    | 'bad_token'
    | 'replayed'
    | 'disabled'
    | 'live_dial_disabled'
    | 'base_url_missing'
    | 'school_missing'
    | 'not_test_mode'
    | 'call_missing'
    | 'call_terminal'
    | 'campaign_closed'
    /** The campaign's pinned mode is not 'test' (or it has none): it was approved for another mode (H2). */
    | 'campaign_mode_mismatch'
    /** The school is paused, and the pause covers this call's purpose (H3). */
    | 'school_paused'
    | 'purpose_unknown'
    | 'window_closed'
    | 'suppressed'
    | 'audio_unavailable';

export interface VoiceXmlResult {
    xml: string;
    /** Why this document was returned; for logs and tests, never sent to Vobiz. */
    outcome: VoiceOutcome;
}

export type StatusOutcome = 'bad_token' | 'disabled' | 'call_missing' | 'unknown_kind' | 'ringing' | 'settled' | 'recorded';

// ── Flags and small helpers ─────────────────────────────────────────────────

/** SAMPARK_ENABLED: the whole feature. Off → answer/gather hang up, status/audio 404. */
export function samparkVoiceEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.SAMPARK_ENABLED === 'true';
}

/** SAMPARK_LIVE_DIAL_ENABLED: the kill switch. Off → nothing is played; what already happened is still recorded. */
function liveDialOn(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.SAMPARK_LIVE_DIAL_ENABLED === 'true';
}

function hangup(outcome: VoiceOutcome): VoiceXmlResult {
    return { xml: EMPTY_HANGUP_XML, outcome };
}

function specFor(purpose: SamparkCall['purpose']): PurposeSpec | null {
    try {
        return purposeSpec(purpose);
    } catch {
        return null;
    }
}

/** First keypad character, if it is a key (0–9, *, #). Vobiz sends one digit; anything longer is trimmed to its first. */
export function parseDigit(raw: string | null | undefined): string | null {
    const first = (raw ?? '').trim().charAt(0);
    return /^[0-9*#]$/.test(first) ? first : null;
}

/** A campaign whose calls may still speak: dispatchable and not past its expiry. */
function campaignOpen(campaign: Campaign | null, now: Date): campaign is Campaign {
    if (!campaign) return false;
    if (campaign.status !== 'scheduled' && campaign.status !== 'dispatching') return false;
    const expires = Date.parse(campaign.expiresAt);
    return Number.isFinite(expires) && expires > now.getTime();
}


const OPT_OUT_RANK: Record<CallOutcome['optOut'], number> = { none: 0, requested: 1, confirmed: 2 };

function strongerOptOut(a: CallOutcome['optOut'], b: CallOutcome['optOut']): CallOutcome['optOut'] {
    return OPT_OUT_RANK[b] > OPT_OUT_RANK[a] ? b : a;
}

async function auditQuietly(repo: SamparkRepo, orgId: string, action: string, callId: string, at: Date, detail: Record<string, unknown>): Promise<void> {
    try {
        await repo.appendAudit(orgId, { at: at.toISOString(), actor: 'carrier', action, target: `call/${callId}`, detail });
    } catch (err) {
        logger.error('Sampark voice audit write failed', err, LOG, { orgId, callId, action });
    }
}

// ── Audio lookup and URLs ───────────────────────────────────────────────────

/**
 * The clip keys a campaign without frozen keys (scheduled before 7 Oct 2026) would play: render
 * the script for the call's language and variant and hash each clip's text, the way the render
 * job did. A setting changed since rendering changes the text, so such a key misses.
 */
function reRenderedClipKeys(school: SamparkSchool, campaign: Campaign, call: SamparkCall): Partial<Record<ClipKind, string>> {
    try {
        const script = renderNoticeScript({
            purpose: campaign.purpose,
            facts: campaign.facts,
            school,
            language: call.language,
            variant: call.variant,
            audience: audienceLabelFor(campaign),
        });
        const speech = languageInfo(call.language).speech;
        return Object.fromEntries(script.clips.map((c) => [c.kind, clipKey(speech, c.text)]));
    } catch (err) {
        logger.warn('Sampark voice: the call script cannot be rendered', LOG, {
            orgId: call.orgId,
            callId: call.id,
            reason: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
        });
        return {};
    }
}

/**
 * The clip keys this call may play, by kind — ONLY clips that exist for this
 * org and whose transcribe-back check passed. The keys come from the campaign's
 * `clipKeys`, frozen when its audio passed (H4), so renaming a venue or the
 * school's spoken name after scheduling changes nothing a parent hears. Only a
 * campaign without frozen keys falls back to re-rendering the script.
 */
async function verifiedClipKeys(
    repo: SamparkRepo,
    school: SamparkSchool,
    campaign: Campaign,
    call: SamparkCall,
    kinds: readonly ClipKind[],
): Promise<Partial<Record<ClipKind, string>>> {
    const keys = campaign.clipKeys
        ? (campaign.clipKeys[clipKeySlot(call.language, call.variant)] ?? {})
        : reRenderedClipKeys(school, campaign, call);
    const found: Partial<Record<ClipKind, string>> = {};
    await Promise.all(
        kinds.map(async (kind) => {
            const key = keys[kind];
            if (!key) return;
            const clip = await repo.getClip(call.orgId, key);
            if (clip && clip.orgId === call.orgId && clip.verification?.status === 'passed') found[kind] = key;
        }),
    );
    return found;
}

async function audioUrl(base: string, orgId: string, key: string): Promise<string> {
    const token = await mintSamparkVoiceToken('sampark-audio', voicePrincipal(orgId, key));
    return `${base}${SAMPARK_VOICE_PATHS.audio}/${encodeURIComponent(token)}${CLIP_FILE_SUFFIX}`;
}

const CLIP_FILE_SUFFIX = '.wav';

/** `<token>.wav` (as routed, possibly still percent-encoded) → the token, or null. */
export function tokenFromClipFile(file: string | null | undefined): string | null {
    if (!file) return null;
    let decoded: string;
    try {
        decoded = decodeURIComponent(file);
    } catch {
        return null;
    }
    if (!decoded.endsWith(CLIP_FILE_SUFFIX)) return null;
    const token = decoded.slice(0, -CLIP_FILE_SUFFIX.length);
    return token || null;
}

async function gatherUrl(
    base: string,
    domain: Extract<SamparkVoiceDomain, 'sampark-gather-menu' | 'sampark-gather-optout'>,
    orgId: string,
    callId: string,
    ttlSeconds?: number,
): Promise<string> {
    const token = await mintSamparkVoiceToken(domain, voicePrincipal(orgId, callId), ttlSeconds);
    return `${base}${SAMPARK_VOICE_PATHS.gather}?t=${encodeURIComponent(token)}`;
}

// ── Answer ──────────────────────────────────────────────────────────────────

export interface AnswerInput {
    token: string | null;
    /** Vobiz's CallUUID for the live leg. */
    callUuid: string | null;
}

/**
 * The answer webhook. Plays the message only if EVERY condition still holds;
 * otherwise returns EMPTY_HANGUP_XML (always HTTP 200) and records why. Reads
 * are kept to school, call, campaign and two clips: Vobiz wants an answer
 * within 3 seconds.
 */
export async function handleSamparkAnswer(deps: VoiceDeps, input: AnswerInput): Promise<VoiceXmlResult> {
    const { repo, clock } = deps;
    const principal = await verifySamparkVoiceToken('sampark-answer', input.token);
    const ids = principal ? parseVoicePrincipal(principal) : null;
    if (!ids) {
        logger.warn('Sampark answer webhook rejected: bad or expired token', LOG);
        return hangup('bad_token');
    }
    if (!samparkVoiceEnabled()) return hangup('disabled');
    const { orgId, id: callId } = ids;
    const now = clock.now();

    const refuse = async (outcome: VoiceOutcome, detail: Record<string, unknown> = {}): Promise<VoiceXmlResult> => {
        logger.info('Sampark answer refused', LOG, { orgId, callId, outcome });
        await auditQuietly(repo, orgId, 'call.answer_refused', callId, now, { reason: outcome, ...detail });
        return hangup(outcome);
    };

    if (!liveDialOn()) return refuse('live_dial_disabled');
    const base = samparkPublicBaseUrl();
    if (!base) return refuse('base_url_missing');

    const [school, call] = await Promise.all([repo.getSchool(orgId), repo.getCall(orgId, callId)]);
    if (!school) return refuse('school_missing');
    if (school.mode !== 'test') return refuse('not_test_mode', { mode: school.mode });
    if (!call) return refuse('call_missing');
    if (isTerminal(call.state)) return refuse('call_terminal', { state: call.state });
    // A school pause (H3) covers a call that was already ringing when it was set.
    if (pauseStopsPurpose(school.pause, call.purpose)) return refuse('school_paused', { scope: school.pause?.scope ?? null });
    const campaign = call.campaignId ? await repo.getCampaign(orgId, call.campaignId) : null;
    const campaignStatus = campaign?.status ?? null;
    // Cancelled while the phone rang (H4): the parent has picked up, so they are told the
    // message was withdrawn rather than left in silence (checked below, after every other rule).
    const withdrawn = campaign?.status === 'cancelled';
    if (!campaign || (!withdrawn && !campaignOpen(campaign, now))) return refuse('campaign_closed', { status: campaignStatus });
    // The mode was pinned at approval (H2). Only a campaign approved for Test mode may speak on a
    // Test-mode call; one approved in Practice, or before modes were pinned, never does.
    if (campaign.mode !== 'test') return refuse('campaign_mode_mismatch', { campaignMode: campaign.mode ?? null, schoolMode: school.mode });
    const spec = specFor(call.purpose);
    if (!spec || !spec.menu) return refuse('purpose_unknown');
    const hours = samparkWindowVerdict(school, spec, now);
    if (!hours.allowed) return refuse('window_closed', { window: hours.reason });
    if ((call.destination ?? 'guardian') === 'guardian') {
        // A guardian number is re-checked against the suppression list: a 9 pressed on another call
        // since this one was dialled must silence it. (A test-phone call is never recorded against a parent.)
        if (suppressionApplies(await repo.getSuppression(orgId, call.phoneHash), spec)) return refuse('suppressed');
    }

    if (withdrawn) return answerWithdrawn(deps, { school, campaign, call, base, callUuid: input.callUuid, now, refuse });

    const clips = await verifiedClipKeys(repo, school, campaign, call, ['message', 'no_input']);
    const messageKey = clips.message;
    const noInputKey = clips.no_input;
    const playable = Boolean(messageKey && noInputKey);
    // Mint before writing anything: a signing-key fault must not leave a call half-answered.
    const urls = playable
        ? await Promise.all([
              audioUrl(base, orgId, messageKey as string),
              audioUrl(base, orgId, noInputKey as string),
              gatherUrl(base, 'sampark-gather-menu', orgId, callId),
          ])
        : null;

    const nowIso = now.toISOString();
    let failedHere = false;
    const updated = await repo.mutateCall(orgId, callId, (current) => {
        failedHere = false;
        if (isTerminal(current.state)) return null;
        let next = applyCallEvent(current, { type: 'answered', at: nowIso });
        if (input.callUuid && !next.vobizCallUuid) next.vobizCallUuid = input.callUuid;
        if (!playable) {
            // Never play unverified audio. The call ends here; billing stays unknown (null) until the
            // hangup callback reports what the carrier charged for the answered leg.
            next = { ...applyCallEvent(next, { type: 'place_failed', at: nowIso, reason: AUDIO_UNAVAILABLE }), billedSeconds: null };
            failedHere = true;
        }
        return next;
    });
    if (!updated) return refuse('call_missing');
    if (failedHere) {
        logger.warn('Sampark answer: no verified audio for this call; hanging up', LOG, { orgId, callId, language: call.language, variant: call.variant });
        await auditQuietly(repo, orgId, 'call.audio_unavailable', callId, now, {
            message: messageKey ? 'passed' : 'unavailable',
            noInput: noInputKey ? 'passed' : 'unavailable',
        });
        // Not retryable: the same clips would be missing on the next attempt, and each attempt rings the phone.
        await settleCall(deps, orgId, callId, { retryable: false });
        return hangup('audio_unavailable');
    }
    if (isTerminal(updated.state) || !urls) return refuse('call_terminal', { state: updated.state });

    const [messageAudioUrl, noInputAudioUrl, gatherAction] = urls;
    return {
        xml: noticeAnswerXml({ messageAudioUrl, gatherUrl: gatherAction, noInputAudioUrl, timeoutSeconds: GATHER_TIMEOUT_SECONDS }),
        outcome: 'played',
    };
}

/**
 * A call answered after its campaign was cancelled (H4). With a verified withdrawn clip, the
 * answer is recorded exactly as on the play path (so the hangup callback settles the call
 * normally) and the parent hears the withdrawn line, then goodbye. Without one (a campaign
 * rendered before the line existed), it hangs up as before, as 'campaign_closed'.
 */
async function answerWithdrawn(
    deps: VoiceDeps,
    o: {
        school: SamparkSchool;
        campaign: Campaign;
        call: SamparkCall;
        base: string;
        callUuid: string | null;
        now: Date;
        refuse: (outcome: VoiceOutcome, detail?: Record<string, unknown>) => Promise<VoiceXmlResult>;
    },
): Promise<VoiceXmlResult> {
    const { repo } = deps;
    const { orgId, id: callId } = o.call;
    const { withdrawn: withdrawnKey } = await verifiedClipKeys(repo, o.school, o.campaign, o.call, ['withdrawn']);
    if (!withdrawnKey) return o.refuse('campaign_closed', { status: o.campaign.status, withdrawnClip: 'unavailable' });
    // Mint before writing anything, as on the play path.
    const url = await audioUrl(o.base, orgId, withdrawnKey);
    const nowIso = o.now.toISOString();
    const updated = await repo.mutateCall(orgId, callId, (current) => {
        if (isTerminal(current.state)) return null;
        const next = applyCallEvent(current, { type: 'answered', at: nowIso });
        if (o.callUuid && !next.vobizCallUuid) next.vobizCallUuid = o.callUuid;
        return next;
    });
    if (!updated) return o.refuse('call_missing');
    if (isTerminal(updated.state)) return o.refuse('call_terminal', { state: updated.state });
    await auditQuietly(repo, orgId, 'call.withdrawn_played', callId, o.now, { campaignId: o.campaign.id });
    return { xml: playThenHangupXml(url), outcome: 'withdrawn' };
}

// ── Gather ──────────────────────────────────────────────────────────────────

export interface GatherInput {
    token: string | null;
    /** Vobiz `Digits`. */
    digits: string | null;
    callUuid: string | null;
}

async function verifyGatherToken(token: string | null): Promise<{ step: VoiceStep; orgId: string; callId: string } | null> {
    const menu = await verifySamparkVoiceToken('sampark-gather-menu', token);
    const principal = menu ?? (await verifySamparkVoiceToken('sampark-gather-optout', token));
    const ids = principal ? parseVoicePrincipal(principal) : null;
    if (!ids) return null;
    return { step: menu ? 'menu' : 'optout', orgId: ids.orgId, callId: ids.id };
}

/**
 * A key that arrived after the call had already ended. The reducer ignores it
 * (a terminal call is never rewritten), but a 9 must not be lost: the opt-out
 * it would have recorded is written directly, through the same recordOptOut the
 * settle step uses (which, for a test-phone call, only audits).
 */
async function recordLateDigit(repo: SamparkRepo, call: SamparkCall, digit: string, step: VoiceStep, menu: MenuSpec | null, now: Date): Promise<void> {
    await auditQuietly(repo, call.orgId, 'call.late_digit', call.id, now, { digit, step, state: call.state });
    if (digit !== '9' || !menu?.optOut) return;
    const optOut = strongerOptOut(call.outcome.optOut, step === 'menu' ? 'requested' : 'confirmed');
    await recordOptOut(repo, { ...call, outcome: { ...call.outcome, optOut } }, now, 'carrier');
}

type GatherPlan = { play: ClipKind } | { optOutPrompt: true } | { replay: true };

/** How many times a key the menu does not offer replays the message before the call ends (H11, interim). */
export const MENU_REPLAYS = 1;

/** Whether the menu offers this key: 1 and 2 only when the purpose has them, 9 when it allows an opt-out. */
function isMenuKey(digit: string, menu: MenuSpec): boolean {
    return (digit === '1' && menu.key1 !== null) || (digit === '2' && menu.key2 !== null) || (digit === '9' && menu.optOut);
}

/** Keys pressed on this call that the menu does not offer. Only the menu step records any key but 9, so they all came from it. */
export function unknownMenuKeys(digits: string, menu: MenuSpec): number {
    return [...digits].filter((d) => !isMenuKey(d, menu)).length;
}

function gatherPlan(step: VoiceStep, digit: string | null, menu: MenuSpec, unknownKeys: number): GatherPlan {
    if (step === 'optout') {
        // The first 9 already stands (plan §5.1: an unconfirmed opt-out is applied anyway), so whatever
        // follows the confirmation prompt, the parent is told the truth: these calls will stop.
        return { play: 'opt_out_done' };
    }
    if (digit === '1' && menu.key1) return { play: 'confirm_1' };
    if (digit === '2' && menu.key2) return { play: 'confirm_2' };
    if (digit === '9' && menu.optOut) return { optOutPrompt: true };
    // A parent who pressed a key the menu does not offer often missed the start of the message
    // (they said "Hello?" over it). Play it once more with its menu instead of hanging up; a second
    // such key gets the no-input goodbye. `unknownKeys` already counts this key.
    if (digit !== null && unknownKeys <= MENU_REPLAYS) return { replay: true };
    return { play: 'no_input' };
}

/**
 * The keypad webhook. Single-use: the token is burned before anything is
 * recorded, so a replayed URL (with Digits=9 or anything else) changes nothing
 * and hangs up. The key is recorded even when the kill switch is off — what a
 * parent pressed is a fact — but nothing more is played then.
 */
export async function handleSamparkGather(deps: VoiceDeps, input: GatherInput): Promise<VoiceXmlResult> {
    const { repo, clock } = deps;
    const verified = await verifyGatherToken(input.token);
    if (!verified || !input.token) {
        logger.warn('Sampark gather webhook rejected: bad or expired token', LOG);
        return hangup('bad_token');
    }
    if (!samparkVoiceEnabled()) return hangup('disabled');
    const { step, orgId, callId } = verified;
    const now = clock.now();

    const exp = tokenExpiry(input.token) ?? Math.floor(now.getTime() / 1000) + SAMPARK_VOICE_TTL_SECONDS['sampark-gather-menu'];
    if (!(await repo.burnToken(tokenBurnKey(input.token), new Date(exp * 1000).toISOString()))) {
        logger.warn('Sampark gather webhook replayed; ignoring', LOG, { orgId, callId, step });
        return hangup('replayed');
    }

    const digit = parseDigit(input.digits);
    // On the opt-out prompt only a second 9 means anything; a 1 there is not "I will attend".
    const applies = digit !== null && (step === 'menu' || digit === '9');
    const nowIso = now.toISOString();
    let wasTerminal = false;
    const updated = await repo.mutateCall(orgId, callId, (current) => {
        wasTerminal = isTerminal(current.state);
        if (wasTerminal) return null;
        let next: SamparkCall = applies && digit ? applyCallEvent(current, { type: 'digit', at: nowIso, digit }) : current;
        if (input.callUuid && !next.vobizCallUuid) next = { ...next, vobizCallUuid: input.callUuid };
        return next === current ? null : next;
    });
    if (!updated) {
        logger.warn('Sampark gather: call not found', LOG, { orgId, callId });
        return hangup('call_missing');
    }
    const menu = specFor(updated.purpose)?.menu ?? null;
    if (wasTerminal) {
        if (digit) await recordLateDigit(repo, updated, digit, step, menu, now);
        return hangup('call_terminal');
    }

    if (!liveDialOn()) return hangup('live_dial_disabled');
    const base = samparkPublicBaseUrl();
    if (!base) return hangup('base_url_missing');
    if (!menu) return hangup('purpose_unknown');

    const plan = gatherPlan(step, digit, menu, unknownMenuKeys(updated.outcome.digits, menu));
    const kinds: ClipKind[] = 'play' in plan ? [plan.play] : 'replay' in plan ? ['message', 'no_input'] : ['opt_out_confirm', 'opt_out_done'];
    const [school, campaign] = await Promise.all([
        repo.getSchool(orgId),
        updated.campaignId ? repo.getCampaign(orgId, updated.campaignId) : Promise.resolve(null),
    ]);
    if (!school || !campaign) return hangup('audio_unavailable');
    const clips = await verifiedClipKeys(repo, school, campaign, updated, kinds);
    if (kinds.some((k) => !clips[k])) {
        logger.warn('Sampark gather: no verified audio for the reply; hanging up', LOG, { orgId, callId, kinds });
        return hangup('audio_unavailable');
    }

    if ('play' in plan) {
        return { xml: playThenHangupXml(await audioUrl(base, orgId, clips[plan.play] as string)), outcome: 'played' };
    }
    if ('replay' in plan) {
        // The answer document again, with a fresh single-use menu token (this one is burned). A token
        // is fixed by its principal and its expiry in whole seconds, so one minted in the same second
        // as the answer's (a parent who pressed a key at once) would BE the burned token, and the
        // replay's keypad would be refused. One extra second of life per replay makes it distinct.
        const ttl = SAMPARK_VOICE_TTL_SECONDS['sampark-gather-menu'] + unknownMenuKeys(updated.outcome.digits, menu);
        const [messageAudioUrl, noInputAudioUrl, menuGather] = await Promise.all([
            audioUrl(base, orgId, clips.message as string),
            audioUrl(base, orgId, clips.no_input as string),
            gatherUrl(base, 'sampark-gather-menu', orgId, callId, ttl),
        ]);
        return {
            xml: noticeAnswerXml({ messageAudioUrl, gatherUrl: menuGather, noInputAudioUrl, timeoutSeconds: GATHER_TIMEOUT_SECONDS }),
            outcome: 'menu_repeated',
        };
    }
    const [promptAudioUrl, doneAudioUrl, optOutGather] = await Promise.all([
        audioUrl(base, orgId, clips.opt_out_confirm as string),
        audioUrl(base, orgId, clips.opt_out_done as string),
        gatherUrl(base, 'sampark-gather-optout', orgId, callId),
    ]);
    return {
        xml: optOutConfirmXml({ promptAudioUrl, gatherUrl: optOutGather, doneAudioUrl, timeoutSeconds: GATHER_TIMEOUT_SECONDS }),
        outcome: 'played',
    };
}

// ── Status (ring / hangup) ──────────────────────────────────────────────────

export interface StatusInput {
    token: string | null;
    /** `ring` or `hangup`, set by us when the carrier built the callback URLs. */
    kind: string | null;
    /** Callback fields (form, JSON or query), e.g. CallUUID, HangupCause, Status, Duration, BillDuration. */
    fields: Readonly<Record<string, string>>;
}

/**
 * Ring and hangup. Idempotent: a duplicated ring is ignored by the reducer, a
 * duplicated hangup finds the call terminal and settleCall finds it settled. A
 * hangup for a call that had already ended (the answer webhook failed it, or
 * the sweep gave up on it) still fills in what the carrier billed, if unknown.
 */
export async function handleSamparkStatus(deps: VoiceDeps, input: StatusInput): Promise<{ ok: true; outcome: StatusOutcome }> {
    const { repo, clock } = deps;
    const principal = await verifySamparkVoiceToken('sampark-status', input.token);
    const ids = principal ? parseVoicePrincipal(principal) : null;
    if (!ids) {
        logger.warn('Sampark status webhook rejected: bad or expired token', LOG);
        return { ok: true, outcome: 'bad_token' };
    }
    if (!samparkVoiceEnabled()) return { ok: true, outcome: 'disabled' };
    const { orgId, id: callId } = ids;
    const nowIso = clock.now().toISOString();
    const callUuid = input.fields.CallUUID?.trim() || null;

    if (input.kind === 'ring') {
        const updated = await repo.mutateCall(orgId, callId, (current) => {
            if (isTerminal(current.state)) return null;
            const next = applyCallEvent(current, { type: 'ringing', at: nowIso });
            if (callUuid && !next.vobizCallUuid) next.vobizCallUuid = callUuid;
            return next;
        });
        return { ok: true, outcome: updated ? 'ringing' : 'call_missing' };
    }

    if (input.kind !== 'hangup') {
        logger.warn('Sampark status webhook with an unknown kind', LOG, { orgId, callId, kind: String(input.kind).slice(0, 20) });
        return { ok: true, outcome: 'unknown_kind' };
    }

    const event = hangupEventFromVobiz(input.fields, nowIso);
    const updated = await repo.mutateCall(orgId, callId, (current) => {
        if (!isTerminal(current.state)) {
            const next = applyCallEvent(current, event);
            if (callUuid && !next.vobizCallUuid) next.vobizCallUuid = callUuid;
            return next;
        }
        const patch: Partial<SamparkCall> = {};
        if (current.billedSeconds === null || current.billedSeconds === undefined) patch.billedSeconds = event.billedSeconds;
        if (callUuid && !current.vobizCallUuid) patch.vobizCallUuid = callUuid;
        return Object.keys(patch).length > 0 ? { ...current, ...patch } : null;
    });
    if (!updated) {
        logger.warn('Sampark hangup for an unknown call', LOG, { orgId, callId });
        return { ok: true, outcome: 'call_missing' };
    }
    const settled = await settleCall(deps, orgId, callId);
    return { ok: true, outcome: settled === 'settled' ? 'settled' : 'recorded' };
}

// ── Audio ───────────────────────────────────────────────────────────────────

const CLIP_KEY = /^[A-Za-z0-9_-]{8,200}$/;

/**
 * The bytes behind a <Play>: 16-bit PCM WAV (never μ-law, so no decoder doubt
 * on the carrier side). Null — the route answers 404 — unless the token is a
 * valid audio token, the clip belongs to that org, its check passed, and the
 * kill switch is on.
 */
export async function readSamparkVoiceAudio(deps: { repo: SamparkRepo; store: AudioStore }, input: { token: string | null }): Promise<Buffer | null> {
    const principal = await verifySamparkVoiceToken('sampark-audio', input.token);
    const ids = principal ? parseVoicePrincipal(principal) : null;
    if (!ids || !CLIP_KEY.test(ids.id)) return null;
    if (!samparkVoiceEnabled() || !liveDialOn()) return null;
    const clip = await deps.repo.getClip(ids.orgId, ids.id);
    if (!clip || clip.orgId !== ids.orgId || clip.verification?.status !== 'passed') return null;
    const stored = await deps.store.get(ids.id);
    if (!stored) return null;
    try {
        // The stored 8 kHz G.711 μ-law WAV, as is: telephone audio's native format and HALF the
        // bytes of 16-bit PCM. Vobiz downloads a whole file before playing it, so size is delay:
        // on 7 Oct 2026 a 26 s message served as 16-bit PCM (~420 KB) left a parent hearing ~19 s
        // of silence over a slow uplink. (The console's browser preview still converts to PCM.)
        mulawSamples(stored.audio); // throws unless 8 kHz mono μ-law
        return stored.audio;
    } catch (err) {
        logger.error('Sampark voice audio is not a playable WAV', err, LOG, { orgId: ids.orgId, key: ids.id });
        return null;
    }
}

// ── HTTP plumbing shared by the four routes ─────────────────────────────────

/** The parts of a NextRequest the voice routes read. Structural, so tests can pass a plain object. */
export interface VoiceRequest {
    method?: string;
    headers: { get(name: string): string | null };
    nextUrl: { searchParams: URLSearchParams };
    text(): Promise<string>;
    formData(): Promise<FormData>;
}

function fieldsFromText(text: string, contentType: string): Record<string, string> {
    const trimmed = text.trim();
    if (!trimmed) return {};
    if (contentType.includes('json') || trimmed.startsWith('{')) {
        try {
            const parsed: unknown = JSON.parse(trimmed);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                const out: Record<string, string> = {};
                for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
                    if (typeof v === 'string') out[k] = v;
                    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
                }
                return out;
            }
        } catch {
            // Not JSON after all: fall through to form decoding.
        }
    }
    return Object.fromEntries(new URLSearchParams(trimmed));
}

/**
 * Callback fields from a form body, a JSON body, or the query string. Vobiz
 * documents form-encoded callbacks but shows JSON examples, so the content type
 * decides and anything unexpected falls back gracefully. Never throws. Body
 * fields win over query fields; the token (`t`) and `kind` are read from the
 * query by the routes, never from here.
 */
export async function readVoiceFields(req: VoiceRequest): Promise<Record<string, string>> {
    const fields: Record<string, string> = Object.fromEntries(req.nextUrl.searchParams);
    const method = (req.method ?? 'POST').toUpperCase();
    if (method === 'GET' || method === 'HEAD') return fields;
    const contentType = (req.headers.get('content-type') ?? '').toLowerCase();
    try {
        if (contentType.includes('multipart/form-data')) {
            const form = await req.formData();
            form.forEach((value, key) => {
                if (typeof value === 'string') fields[key] = value;
            });
            return fields;
        }
        Object.assign(fields, fieldsFromText(await req.text(), contentType));
    } catch (err) {
        logger.warn('Sampark voice webhook body could not be read', LOG, { reason: err instanceof Error ? err.message.slice(0, 120) : 'unknown' });
    }
    return fields;
}

/** Call-control XML, always HTTP 200: a non-200 makes Vobiz retry a call that is already moving. */
export function voiceXmlResponse(xml: string): NextResponse {
    return new NextResponse(xml, { status: 200, headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'no-store' } });
}

export function voiceAudioResponse(wav: Buffer): NextResponse {
    return new NextResponse(new Uint8Array(wav), {
        status: 200,
        headers: {
            'Content-Type': 'audio/wav',
            'Content-Length': String(wav.length),
            'Cache-Control': 'private, max-age=300',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
