/**
 * Child-specific notice renderer (slice 2): typed facts + a reviewed template →
 * the exact text of every clip, in the LISTENER-CHECK-FIRST order.
 *
 *   1. listener_check — "a message for Riya's parent; if you are, press 1".
 *      Names the child. States NOTHING else: no amount, no date, no purpose.
 *   2. message (+ menu) — played only after key 1. Facts live here.
 *   3. confirm_1 / confirm_2 / opt-out / no-input clips.
 *   4. listener_no_input — if key 1 is never pressed, nothing about the child is said.
 *
 * Facts come from typed data and are turned into words by the reviewed lexicon,
 * never by a model (plan §1 principle 1). Concern purposes (A1/A3/A4) take NO
 * fact at all beyond the child's name; fee purposes take an amount and a date.
 * The renderer THROWS (ScriptRenderError) for a fact it cannot say reliably, a
 * missing spoken name, or a Latin letter inside an Indic text; it never guesses.
 *
 * Uses the slice-1 helpers `spoken.ts` (dates) and the slice-1 `common` clips
 * (opt-out, no-input, office fallback); it does not touch `render.ts`.
 */

import { purposeSpec } from '@/lib/sampark/catalogue';
import { isSayableAmount } from '@/lib/sampark/rules/evaluate-fees';
import type { ProposalFacts } from '@/lib/sampark/rules/types';
import { estimateSeconds } from '@/lib/sampark/scripts/render';
import { formatDate, fillPattern } from '@/lib/sampark/scripts/spoken';
import { callScripts } from '@/lib/sampark/scripts/templates';
import { ScriptRenderError } from '@/lib/sampark/scripts/types';
import type { ParentLanguage, SamparkSchool, SamparkStudent } from '@/types/sampark';

import { childScripts, isChildPurpose, type ChildPurposeId } from './child-templates';

export type ChildClipKind =
    | 'listener_check'
    | 'message'
    | 'confirm_1'
    | 'confirm_2'
    | 'opt_out_confirm'
    | 'opt_out_done'
    | 'no_input'
    | 'fallback_office'
    | 'listener_no_input';

export interface RenderedChildScript {
    /** Play in this order. `listener_check` first; `message` only after key 1. */
    clips: { kind: ChildClipKind; text: string }[];
    /** Seconds of message + menu (the 60-second billing unit budget, plan §7). */
    estimatedSeconds: number;
    warnings: string[];
}

export interface RenderChildInput {
    purpose: ChildPurposeId;
    language: ParentLanguage;
    school: Pick<SamparkSchool, 'spokenName'>;
    student: Pick<SamparkStudent, 'spokenFirstName'>;
    /** Fee purposes only. */
    facts: ProposalFacts;
}

export const CHILD_MESSAGE_AND_MENU_BUDGET_SECONDS = 38;
const LATIN = /[A-Za-z]/;

/**
 * "twelve thousand five hundred rupees" · "बारह हज़ार पाँच सौ रुपये" ·
 * "বারো হাজার পাঁচ শো টাকা" · "बाह्र हजार पाँच सय रुपैयाँ". Whole hundreds only,
 * thousands and lakhs up to 60 (the reviewed number lexicon); anything else throws.
 */
export function formatAmount(amountRupees: number, language: ParentLanguage): string {
    if (!isSayableAmount(amountRupees)) {
        throw new ScriptRenderError(`The amount ${String(amountRupees)} cannot be spoken reliably (whole hundreds, thousands and lakhs up to 60 only)`);
    }
    const numbers = callScripts(language).lexicon.numbers;
    const words = childScripts(language).amount;
    const lakhs = Math.floor(amountRupees / 100_000);
    const thousands = Math.floor((amountRupees % 100_000) / 1000);
    const hundreds = Math.floor((amountRupees % 1000) / 100);
    const part = (n: number, unit: string) => `${numbers[String(n)]} ${unit}`;
    const parts: string[] = [];
    if (lakhs > 0) parts.push(part(lakhs, words.lakh));
    if (thousands > 0) parts.push(part(thousands, words.thousand));
    if (hundreds > 0) parts.push(part(hundreds, words.hundred));
    return fillPattern(words.pattern, { words: parts.join(' ') });
}

function nameFor(student: RenderChildInput['student'], language: ParentLanguage): string {
    const name = student.spokenFirstName?.[language]?.trim().normalize('NFC');
    if (!name) throw new ScriptRenderError(`The child has no reviewed spoken first name in ${language}`);
    if (language !== 'English' && LATIN.test(name)) {
        throw new ScriptRenderError(`The child's ${language} spoken name contains Latin letters; the school must supply it in the ${language} script`);
    }
    return name;
}

/** Whether this child can be addressed in this language at all (a reviewed spoken name exists). */
export function canNameChild(student: RenderChildInput['student'], language: ParentLanguage): boolean {
    try {
        nameFor(student, language);
        return true;
    } catch {
        return false;
    }
}

export function renderChildScript(input: RenderChildInput): RenderedChildScript {
    const { purpose, language, school, student, facts } = input;
    if (!isChildPurpose(purpose)) throw new ScriptRenderError(`"${String(purpose)}" has no child-specific template`);
    const spec = purposeSpec(purpose);
    if (spec.mode !== 'notice' || !spec.menu) throw new ScriptRenderError(`Purpose "${purpose}" is not a notice`);

    const file = childScripts(language);
    const tpl = file.purposes[purpose];
    if (!tpl) throw new ScriptRenderError(`No ${language} child template for "${purpose}"`);

    const schoolName = school?.spokenName?.[language]?.trim().normalize('NFC');
    if (!schoolName) throw new ScriptRenderError(`The school has no spoken name in ${language}`);
    if (language !== 'English' && LATIN.test(schoolName)) {
        throw new ScriptRenderError(`The school's ${language} spoken name contains Latin letters; write it in the ${language} script`);
    }
    const childName = nameFor(student, language);

    const base: Record<string, string> = { schoolName, childName };
    let values: Record<string, string> = base;
    if (purpose === 'fee_due' || purpose === 'fee_overdue') {
        if (!facts || facts.kind !== 'fee') throw new ScriptRenderError(`"${purpose}" needs fee facts (amount and due date)`);
        values = { ...base, amount: formatAmount(facts.amountRupees, language), date: formatDate(facts.dueDate, language) };
    } else if (facts) {
        throw new ScriptRenderError(`"${purpose}" takes no facts: a request to talk states nothing beyond the child's name`);
    }

    const common = callScripts(language).common;
    const clips: { kind: ChildClipKind; text: string }[] = [
        { kind: 'listener_check', text: fillPattern(tpl.listenerCheck, base) },
        { kind: 'message', text: `${fillPattern(tpl.message, values)} ${fillPattern(tpl.menu, values)}` },
    ];
    if (spec.menu.key1) {
        if (!tpl.confirm_1) throw new ScriptRenderError(`${language} "${purpose}" offers key 1 but has no confirm_1 clip`);
        clips.push({ kind: 'confirm_1', text: fillPattern(tpl.confirm_1, values) });
    }
    if (spec.menu.key2) {
        if (!tpl.confirm_2) throw new ScriptRenderError(`${language} "${purpose}" offers key 2 but has no confirm_2 clip`);
        clips.push({ kind: 'confirm_2', text: fillPattern(tpl.confirm_2, values) });
    }
    if (spec.menu.optOut) {
        clips.push({ kind: 'opt_out_confirm', text: fillPattern(common.opt_out_confirm, values) });
        clips.push({ kind: 'opt_out_done', text: fillPattern(common.opt_out_done, values) });
    }
    clips.push({ kind: 'no_input', text: fillPattern(common.no_input, values) });
    clips.push({ kind: 'fallback_office', text: fillPattern(common.fallback_office, values) });
    clips.push({ kind: 'listener_no_input', text: fillPattern(file.common.listener_no_input, values) });

    for (const clip of clips) {
        clip.text = clip.text.normalize('NFC').replace(/\s+/g, ' ').trim();
        if (/[{}]/.test(clip.text)) throw new ScriptRenderError(`Unfilled placeholder in ${language} ${clip.kind}: ${clip.text}`);
    }
    const message = clips.find((c) => c.kind === 'message')!;
    const estimatedSeconds = estimateSeconds(message.text, language);
    const warnings: string[] = [];
    if (estimatedSeconds > CHILD_MESSAGE_AND_MENU_BUDGET_SECONDS) {
        warnings.push(`${language}: message and menu run about ${estimatedSeconds} s, over the ${CHILD_MESSAGE_AND_MENU_BUDGET_SECONDS} s budget`);
    }
    return { clips, estimatedSeconds, warnings };
}
