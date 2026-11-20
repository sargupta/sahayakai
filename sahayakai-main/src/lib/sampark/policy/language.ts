/**
 * Which language a guardian is called in (plan §4④ "Language", §5).
 *
 * Precedence: the Sampark preferences registry (what the family told the
 * school) → the CRM's language → the school's chosen default. If none is set
 * the answer is null and the gate blocks with `language_unknown`: the family is
 * ASKED, never guessed — defaulting a Nepali-speaking hill family to Bengali is
 * not a neutral act in this region. A school only gets a default if it chose one.
 */

import type { GuardianPreferences, ParentLanguage, SamparkGuardian, SamparkSchool } from '@/types/sampark';
import { PARENT_LANGUAGES } from '@/types/sampark';

function asParentLanguage(value: unknown): ParentLanguage | null {
    return typeof value === 'string' && (PARENT_LANGUAGES as readonly string[]).includes(value)
        ? (value as ParentLanguage)
        : null;
}

export function resolveLanguage(
    guardian: SamparkGuardian,
    prefs: GuardianPreferences | null,
    school: SamparkSchool,
): ParentLanguage | null {
    return (
        asParentLanguage(prefs?.language) ??
        asParentLanguage(guardian.crmLanguage) ??
        asParentLanguage(school.defaultLanguage) ??
        null
    );
}
