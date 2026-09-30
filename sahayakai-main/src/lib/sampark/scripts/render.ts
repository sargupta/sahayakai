/**
 * Notice-script renderer: typed campaign facts + a reviewed template → the
 * exact text of every clip a notice call can play.
 *
 * Plan §1 principle 1 (facts from data, words from reviewed templates, no
 * model), §2 (at most two action keys plus 9), §4⑥ (spoken-form slots), §7
 * (a notice must fit one 60-second billing unit: body ≈ 28 s, menu ≈ 10 s).
 * Contract: docs/sampark/SLICE1_CONTRACT.md §4.
 *
 * The `message` clip is the message followed by the menu, because the keypad
 * gather wraps ONE audio file; the confirmation and common clips are separate.
 * Class-wide notices never name a child — there is no child slot in any of
 * these templates, and the class gate (gate 6) proves no `{…}` survives.
 */

import { purposeSpec } from '@/lib/sampark/catalogue';
import type { Campaign, CampaignFacts, ClipKind, ParentLanguage, PurposeId, SamparkSchool } from '@/types/sampark';

import { formatAudience, formatDate, formatTime, formatVenue, fillPattern } from './spoken';
import { callScripts, type CallScriptFile, type PurposeTemplate } from './templates';
import { ScriptRenderError, type AudienceLabel } from './types';

export type { AudienceLabel } from './types';
export { ScriptRenderError } from './types';

export type ScriptVariant = 'default' | 'today' | 'tomorrow';

export interface RenderedScript {
    clips: { kind: ClipKind; text: string }[];
    estimatedSeconds: number;
    warnings: string[];
}

export interface RenderNoticeInput {
    purpose: PurposeId;
    facts: CampaignFacts;
    school: SamparkSchool;
    language: ParentLanguage;
    variant: ScriptVariant;
    audience: AudienceLabel;
}

/** Plan §7: message body ≈ 28 s and menu ≈ 10 s, so message + menu must stay within 38 s. */
export const MESSAGE_AND_MENU_BUDGET_SECONDS = 38;
export const MESSAGE_BODY_BUDGET_SECONDS = 28;

/** Clip kinds shared by every purpose in a language (rendered once per language, not per variant). */
export const COMMON_CLIP_KINDS: readonly ClipKind[] = ['opt_out_confirm', 'opt_out_done', 'no_input', 'fallback_office'];

const LATIN = /[A-Za-z]/;

/** emergency_closure → today / tomorrow (chosen at dial time, plan §2 D4); everything else → default. */
export function variantsFor(purpose: PurposeId): ScriptVariant[] {
    return purpose === 'emergency_closure' ? ['today', 'tomorrow'] : ['default'];
}

/** One section → that section; anything else (whole school, several sections) → the school. */
export function audienceLabelFor(campaign: Pick<Campaign, 'audience'>): AudienceLabel {
    const sections = campaign.audience?.sections ?? [];
    if (sections.length === 1) return { kind: 'section', grade: sections[0].grade, section: sections[0].section };
    return { kind: 'school' };
}

/** Speaking-time estimate from the measured chars/second of the language's voice. */
export function estimateSeconds(text: string, language: ParentLanguage): number {
    const cps = callScripts(language)._meta.charsPerSecond;
    return Math.round((Array.from(text).length / cps) * 10) / 10;
}

function messageTemplate(tpl: PurposeTemplate, variant: ScriptVariant, purpose: PurposeId): string {
    if (typeof tpl.message === 'string') {
        if (variant !== 'default') throw new ScriptRenderError(`${purpose} has no "${variant}" variant`);
        return tpl.message;
    }
    if (variant === 'default') throw new ScriptRenderError(`${purpose} must be rendered as "today" or "tomorrow"`);
    return tpl.message[variant];
}

function slotValues(input: RenderNoticeInput, file: CallScriptFile, tpl: PurposeTemplate, schoolName: string): Record<string, string> {
    const { facts, language, school } = input;
    const base = { schoolName };
    switch (facts.kind) {
        case 'ptm_invite':
            return {
                ...base,
                audience: formatAudience(input.audience, language, schoolName),
                date: formatDate(facts.date, language),
                time: formatTime(facts.time, language),
                venue: formatVenue(facts.venueId, school.venues, language),
            };
        case 'event_invite': {
            const eventName = file.names.eventTypes[facts.eventType as keyof CallScriptFile['names']['eventTypes']];
            if (!eventName) throw new ScriptRenderError(`${language} has no name for event type "${String(facts.eventType)}"`);
            return {
                ...base,
                audience: formatAudience(input.audience, language, schoolName),
                eventName,
                date: formatDate(facts.date, language),
                time: formatTime(facts.time, language),
                venue: formatVenue(facts.venueId, school.venues, language),
            };
        }
        case 'emergency_closure': {
            const reason = file.names.closureReasons[facts.reason as keyof CallScriptFile['names']['closureReasons']];
            if (!reason) throw new ScriptRenderError(`${language} has no phrase for closure reason "${String(facts.reason)}"`);
            if (!tpl.buses) throw new ScriptRenderError(`${language} emergency_closure template has no bus sentences`);
            if (typeof facts.busesRunning !== 'boolean') throw new ScriptRenderError('emergency_closure needs busesRunning');
            return {
                ...base,
                reason,
                date: formatDate(facts.date, language),
                buses: facts.busesRunning ? tpl.buses.running : tpl.buses.notRunning,
            };
        }
        default:
            throw new ScriptRenderError(`Unsupported facts kind: ${String((facts as { kind?: unknown }).kind)}`);
    }
}

/**
 * Render every clip of a notice call. Throws ScriptRenderError for a purpose
 * that is not `available`, a variant the purpose does not have, or any fact
 * the template cannot say — it never falls back to a guess.
 */
export function renderNoticeScript(input: RenderNoticeInput): RenderedScript {
    const { purpose, facts, school, language, variant } = input;
    const spec = purposeSpec(purpose);
    if (spec.status !== 'available') throw new ScriptRenderError(`Purpose "${purpose}" is not available (status ${spec.status})`);
    if (spec.mode !== 'notice' || !spec.menu) throw new ScriptRenderError(`Purpose "${purpose}" is not a notice`);
    if (!facts || facts.kind !== purpose) throw new ScriptRenderError(`Facts of kind "${String(facts?.kind)}" do not match purpose "${purpose}"`);

    const file = callScripts(language);
    const tpl = file.purposes[purpose];
    if (!tpl) throw new ScriptRenderError(`No ${language} template for "${purpose}"`);

    const schoolName = school?.spokenName?.[language]?.trim().normalize('NFC');
    if (!schoolName) throw new ScriptRenderError(`The school has no spoken name in ${language}`);
    if (language !== 'English' && LATIN.test(schoolName)) {
        throw new ScriptRenderError(`The school's ${language} spoken name contains Latin letters; write it in the ${language} script`);
    }

    const values = slotValues(input, file, tpl, schoolName);
    const message = fillPattern(messageTemplate(tpl, variant, purpose), values);
    const menu = fillPattern(tpl.menu, values);

    const clips: { kind: ClipKind; text: string }[] = [{ kind: 'message', text: `${message} ${menu}` }];
    if (spec.menu.key1) {
        if (!tpl.confirm_1) throw new ScriptRenderError(`${language} "${purpose}" offers key 1 but has no confirm_1 clip`);
        clips.push({ kind: 'confirm_1', text: fillPattern(tpl.confirm_1, values) });
    }
    if (spec.menu.key2) {
        if (!tpl.confirm_2) throw new ScriptRenderError(`${language} "${purpose}" offers key 2 but has no confirm_2 clip`);
        clips.push({ kind: 'confirm_2', text: fillPattern(tpl.confirm_2, values) });
    }
    if (spec.menu.optOut) {
        clips.push({ kind: 'opt_out_confirm', text: fillPattern(file.common.opt_out_confirm, values) });
        clips.push({ kind: 'opt_out_done', text: fillPattern(file.common.opt_out_done, values) });
    }
    clips.push({ kind: 'no_input', text: fillPattern(file.common.no_input, values) });
    clips.push({ kind: 'fallback_office', text: fillPattern(file.common.fallback_office, values) });

    for (const clip of clips) {
        clip.text = clip.text.normalize('NFC').replace(/\s+/g, ' ').trim();
        if (/[{}]/.test(clip.text)) throw new ScriptRenderError(`Unfilled placeholder in ${language} ${clip.kind}: ${clip.text}`);
    }

    const estimatedSeconds = estimateSeconds(clips[0].text, language);
    const bodySeconds = estimateSeconds(message, language);
    const warnings: string[] = [];
    if (estimatedSeconds > MESSAGE_AND_MENU_BUDGET_SECONDS) {
        warnings.push(
            `${language}: message and menu run about ${estimatedSeconds} s, over the ${MESSAGE_AND_MENU_BUDGET_SECONDS} s budget — the call will cross into a second billed minute`,
        );
    }
    if (bodySeconds > MESSAGE_BODY_BUDGET_SECONDS) {
        warnings.push(`${language}: the message body runs about ${bodySeconds} s, over the ${MESSAGE_BODY_BUDGET_SECONDS} s guide`);
    }
    return { clips, estimatedSeconds, warnings };
}
