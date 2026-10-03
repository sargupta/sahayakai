/**
 * Voice profiles: which provider, model, voice, locale, pace and style hint
 * speaks each purpose group in each language. DATA, not code: the values live
 * in `voice-profiles.json`; this module types, validates and resolves them.
 *
 * Why this exists (plan section 5, docs/sampark/VOICE_BAKEOFF.md): the voice
 * choice is made per language by native listeners, and must be changeable
 * (and reviewable) without touching the renderer. The shipped behaviour is the
 * set of `status: "current"` profiles; every other entry is a bake-off
 * candidate or a rejected experiment.
 *
 * Hard rules enforced by `validateVoiceProfiles` (and so by the tests):
 *   - Nepali is only ever `ne-NP`, and only on a provider that lists ne-NP
 *     (Gemini-TTS). Sarvam Bulbul v3 has NO Nepali; Chirp 3 HD Nepali is not
 *     documented. Both are rejected, not warned about.
 *   - Pace is inside the provider's legal range (Gemini-TTS takes none; its
 *     delivery is steered by the style hint).
 *   - Exactly one `current` profile per language x purpose group, and it must
 *     run on a Google engine (the production renderer calls Cloud TTS only)
 *     and on a locale verified live.
 *   - Reviewer sign-off fields exist on every profile and start empty.
 *
 * Imports only types and the catalogue, so `languages.ts` can derive its
 * engine table from here without a cycle.
 */

import type { ParentLanguage, ParentLanguageCode, PurposeId } from '@/types/sampark';

import { purposeSpec } from './catalogue';
import raw from './voice-profiles.json';

export const VOICE_PROVIDERS = ['gemini-tts', 'chirp3-hd', 'sarvam-bulbul'] as const;
export type VoiceProvider = (typeof VOICE_PROVIDERS)[number];

/** Providers the production renderer can call today. */
export const PRODUCTION_PROVIDERS: readonly VoiceProvider[] = ['gemini-tts', 'chirp3-hd'];

export const VOICE_PURPOSE_GROUPS = [
    'class_teacher_request',
    'recognition',
    'fees_accounts',
    'closure_emergency',
    'ptm_event_invite',
] as const;
export type VoicePurposeGroup = (typeof VOICE_PURPOSE_GROUPS)[number];

/** `*` (candidates and rejected experiments only) = "evaluate for every group of this language". */
export type ProfileGroup = VoicePurposeGroup | '*';

export const VOICE_STATUSES = ['current', 'candidate', 'rejected'] as const;
export type VoiceStatus = (typeof VOICE_STATUSES)[number];

export const REVIEW_VERDICTS = ['', 'approved', 'needs_work', 'rejected'] as const;
export type ReviewVerdict = (typeof REVIEW_VERDICTS)[number];

/** Native-reviewer sign-off. Left empty until a person has listened. */
export interface VoiceReview {
    reviewer: string;
    /** ISO date (YYYY-MM-DD) of the listening session. */
    date: string;
    verdict: ReviewVerdict;
}

export interface VoiceProfile {
    id: string;
    language: ParentLanguageCode;
    group: ProfileGroup;
    status: VoiceStatus;
    provider: VoiceProvider;
    /** Pinned model id: required for gemini-tts and sarvam-bulbul, null for chirp3-hd. */
    model: string | null;
    voice: string;
    /** BCP-47 code sent to the TTS API (ne-NP for Nepali). */
    localeCode: string;
    /** BCP-47 code for the Chirp 2 transcribe-back check. */
    sttLanguageCode: string;
    /** Provider-native pace multiplier; null = do not send one (provider default). */
    speakingRate: number | null;
    /** Short delivery hint (Gemini-TTS only); null = none. */
    stylePrompt: string | null;
    notes: string;
    review: VoiceReview;
}

export interface VoiceProfileFile {
    schemaVersion: 1;
    profiles: VoiceProfile[];
}

// ── Provider facts ──────────────────────────────────────────────────────────

/** `verified` = rendered and transcribed back live (plan section 5); `unverified` = documented or reported, not yet proven by us. */
type LocaleSupport = 'verified' | 'unverified';

/**
 * Locales each provider can be asked for. A locale absent here is REJECTED.
 * Source: plan section 5 (voice test, 30 Sep 2026) and provider docs; update with evidence only.
 */
export const PROVIDER_LOCALES: Readonly<Record<VoiceProvider, Readonly<Record<string, LocaleSupport>>>> = Object.freeze({
    // bn-IN: absent at the voice test (only bn-BD); listed unverified because newer Flash TTS models are reported to list Bangla.
    'gemini-tts': { 'en-IN': 'verified', 'hi-IN': 'verified', 'ne-NP': 'verified', 'bn-IN': 'unverified' },
    // ne-NP is deliberately absent: Chirp 3 HD does not document Nepali.
    'chirp3-hd': { 'bn-IN': 'verified', 'en-IN': 'unverified', 'hi-IN': 'unverified' },
    // Bulbul v3 has NO Nepali. This table is the gate that keeps it that way.
    'sarvam-bulbul': { 'en-IN': 'unverified', 'hi-IN': 'unverified', 'bn-IN': 'unverified' },
});

/** Legal pace range per provider; null = the provider takes no pace parameter. */
export const PROVIDER_PACE_RANGE: Readonly<Record<VoiceProvider, { min: number; max: number } | null>> = Object.freeze({
    'gemini-tts': null,
    'chirp3-hd': { min: 0.25, max: 2.0 }, // Cloud TTS audioConfig.speakingRate
    'sarvam-bulbul': { min: 0.5, max: 2.0 }, // Bulbul v3 `pace` (v2 allowed 0.3-3; v3 narrowed). UNVERIFIED live.
});

/** The language each profile language code must use as the base of its locale. */
const LANGUAGE_LOCALES: Readonly<Record<ParentLanguageCode, readonly string[]>> = Object.freeze({
    en: ['en-IN'],
    hi: ['hi-IN'],
    bn: ['bn-IN'],
    ne: ['ne-NP'], // Nepali is ne-NP and nothing else
});

const CODE_TO_LANGUAGE: Readonly<Record<ParentLanguageCode, ParentLanguage>> = Object.freeze({
    en: 'English',
    hi: 'Hindi',
    bn: 'Bengali',
    ne: 'Nepali',
});

export const MAX_STYLE_PROMPT_WORDS = 12;

// ── Validation ──────────────────────────────────────────────────────────────

export class VoiceProfileError extends Error {
    constructor(readonly problems: string[]) {
        super(`Invalid voice profiles:\n - ${problems.join('\n - ')}`);
        this.name = 'VoiceProfileError';
    }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Problems with one profile in isolation (empty = fine). */
export function profileProblems(p: VoiceProfile): string[] {
    const out: string[] = [];
    const at = (msg: string) => out.push(`${p.id}: ${msg}`);

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id)) out.push(`${JSON.stringify(p.id)}: id must be kebab-case`);
    if (!(p.language in LANGUAGE_LOCALES)) at(`unknown language ${JSON.stringify(p.language)}`);
    if (p.group !== '*' && !(VOICE_PURPOSE_GROUPS as readonly string[]).includes(p.group)) at(`unknown purpose group ${JSON.stringify(p.group)}`);
    if (!(VOICE_STATUSES as readonly string[]).includes(p.status)) at(`unknown status ${JSON.stringify(p.status)}`);
    if (p.group === '*' && p.status === 'current') at('a current profile must name its purpose group, not "*"');
    if (!(VOICE_PROVIDERS as readonly string[]).includes(p.provider)) {
        at(`unknown provider ${JSON.stringify(p.provider)} (ElevenLabs is benchmark-only and never a profile provider)`);
        return out; // nothing below is meaningful
    }
    if (typeof p.voice !== 'string' || !p.voice.trim()) at('voice is required');

    // Locale: must belong to the language, and the provider must list it. This is where Nepali is fenced.
    const allowedLocales = LANGUAGE_LOCALES[p.language];
    if (allowedLocales && !allowedLocales.includes(p.localeCode)) {
        at(`locale ${JSON.stringify(p.localeCode)} is not allowed for language ${p.language} (allowed: ${allowedLocales.join(', ')})`);
    }
    if (p.language === 'ne') {
        if (p.localeCode !== 'ne-NP') at('Nepali must use locale ne-NP');
        if (p.sttLanguageCode !== 'ne-NP') at('Nepali transcribe-back must use ne-NP');
    }
    const support = PROVIDER_LOCALES[p.provider][p.localeCode];
    if (!support) {
        at(`provider ${p.provider} has no ${p.localeCode} (${p.language === 'ne' ? 'Nepali exists only on Gemini-TTS ne-NP; Sarvam Bulbul v3 and Chirp 3 HD have none' : 'not listed in PROVIDER_LOCALES'})`);
    } else if (p.status === 'current' && support !== 'verified') {
        at(`a current profile needs a locale verified live; ${p.provider} ${p.localeCode} is ${support}`);
    }
    if (typeof p.sttLanguageCode !== 'string' || !p.sttLanguageCode) at('sttLanguageCode is required');
    else if (allowedLocales && !allowedLocales.includes(p.sttLanguageCode)) at(`sttLanguageCode ${JSON.stringify(p.sttLanguageCode)} does not match language ${p.language}`);

    // Model
    if (p.provider === 'chirp3-hd') {
        if (p.model !== null) at('chirp3-hd takes no model (the voice name carries it)');
    } else if (typeof p.model !== 'string' || !p.model.trim()) {
        at(`${p.provider} needs a pinned model id`);
    } else if (p.provider === 'sarvam-bulbul' && p.model !== 'bulbul:v3') {
        at('sarvam-bulbul must be pinned to bulbul:v3');
    }

    // Pace
    if (p.speakingRate !== null) {
        const range = PROVIDER_PACE_RANGE[p.provider];
        if (typeof p.speakingRate !== 'number' || !Number.isFinite(p.speakingRate)) at('speakingRate must be a finite number or null');
        else if (!range) at(`${p.provider} takes no pace parameter; steer it with the style hint instead`);
        else if (p.speakingRate < range.min || p.speakingRate > range.max) at(`speakingRate ${p.speakingRate} is outside ${p.provider}'s legal range ${range.min}-${range.max}`);
    }

    // Style hint
    if (p.stylePrompt !== null) {
        if (p.provider !== 'gemini-tts') at(`${p.provider} ignores a style prompt; it must be null`);
        else if (typeof p.stylePrompt !== 'string' || !p.stylePrompt.trim()) at('stylePrompt must be non-empty text or null');
        else if (p.stylePrompt.trim().split(/\s+/).length > MAX_STYLE_PROMPT_WORDS) {
            at(`stylePrompt is over ${MAX_STYLE_PROMPT_WORDS} words; long prompts made Gemini-TTS read them aloud (2026-10-01)`);
        }
    }

    // Review
    if (!isObj(p.review) || typeof p.review.reviewer !== 'string' || typeof p.review.date !== 'string' || !(REVIEW_VERDICTS as readonly string[]).includes(p.review.verdict)) {
        at('review must be {reviewer, date, verdict} with verdict one of "", approved, needs_work, rejected');
    } else if (p.review.date && !/^\d{4}-\d{2}-\d{2}$/.test(p.review.date)) {
        at('review.date must be YYYY-MM-DD or empty');
    }
    return out;
}

/** Validate a whole file. Throws VoiceProfileError listing every problem. */
export function validateVoiceProfiles(file: unknown): VoiceProfileFile {
    const problems: string[] = [];
    if (!isObj(file) || file.schemaVersion !== 1 || !Array.isArray(file.profiles)) {
        throw new VoiceProfileError(['file must be {schemaVersion: 1, profiles: []}']);
    }
    const profiles = file.profiles as VoiceProfile[];
    const ids = new Set<string>();
    for (const p of profiles) {
        if (!isObj(p)) {
            problems.push('every profile must be an object');
            continue;
        }
        if (ids.has(p.id)) problems.push(`${p.id}: duplicate id`);
        ids.add(p.id);
        problems.push(...profileProblems(p));
    }
    // Exactly one current profile per language x group, on an engine production can call.
    for (const language of Object.keys(LANGUAGE_LOCALES) as ParentLanguageCode[]) {
        for (const group of VOICE_PURPOSE_GROUPS) {
            const current = profiles.filter((p) => p.language === language && p.group === group && p.status === 'current');
            if (current.length !== 1) problems.push(`${language}/${group}: expected exactly 1 current profile, found ${current.length}`);
        }
    }
    for (const p of profiles) {
        if (p.status === 'current' && !(PRODUCTION_PROVIDERS as readonly string[]).includes(p.provider)) {
            problems.push(`${p.id}: current profiles must use a Google engine (${PRODUCTION_PROVIDERS.join(' or ')}); ${p.provider} is bake-off only until a production adapter ships`);
        }
    }
    if (problems.length) throw new VoiceProfileError(problems);
    return file as unknown as VoiceProfileFile;
}

// ── Loaded data and lookups ─────────────────────────────────────────────────

export const VOICE_PROFILE_FILE: VoiceProfileFile = validateVoiceProfiles(raw);

export function allVoiceProfiles(): readonly VoiceProfile[] {
    return VOICE_PROFILE_FILE.profiles;
}

/** The profile that speaks `group` in `language` today. */
export function currentProfile(language: ParentLanguageCode, group: VoicePurposeGroup, file: VoiceProfileFile = VOICE_PROFILE_FILE): VoiceProfile {
    const found = file.profiles.find((p) => p.language === language && p.group === group && p.status === 'current');
    if (!found) throw new Error(`No current voice profile for ${language}/${group}`);
    return found;
}

/**
 * Purpose -> voice group. Explicit for the purposes with their own voice
 * treatment; anything else (including purposes added later) falls back by
 * catalogue family, so a new purpose never lacks a profile.
 */
const GROUP_BY_PURPOSE: Readonly<Partial<Record<PurposeId, VoicePurposeGroup>>> = Object.freeze({
    attendance_talk: 'class_teacher_request',
    absence_today: 'class_teacher_request',
    academic_talk: 'class_teacher_request',
    conduct_talk: 'class_teacher_request',
    recognition: 'recognition',
    emergency_closure: 'closure_emergency',
    transport_notice: 'closure_emergency',
    early_dismissal: 'closure_emergency',
    illness_notice: 'closure_emergency',
    ptm_invite: 'ptm_event_invite',
    event_invite: 'ptm_event_invite',
});

export function purposeGroup(purpose: PurposeId): VoicePurposeGroup {
    const explicit = GROUP_BY_PURPOSE[purpose];
    if (explicit) return explicit;
    switch (purposeSpec(purpose).family) {
        case 'fees':
            return 'fees_accounts';
        case 'progress':
            return 'class_teacher_request';
        default:
            return 'ptm_event_invite'; // meeting + general notices
    }
}

/** Group used where only a language is known (call-time lookups that predate purpose awareness). */
export const BASELINE_GROUP: VoicePurposeGroup = 'ptm_event_invite';

export function languageCodeOf(language: ParentLanguage): ParentLanguageCode {
    for (const [code, name] of Object.entries(CODE_TO_LANGUAGE)) if (name === language) return code as ParentLanguageCode;
    throw new Error(`Unknown parent language ${language}`);
}

export function languageOfCode(code: ParentLanguageCode): ParentLanguage {
    return CODE_TO_LANGUAGE[code];
}
