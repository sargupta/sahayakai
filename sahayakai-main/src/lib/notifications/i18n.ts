/**
 * Localized notification message templates.
 *
 * Used by `createGroupPostAction` and `likeGroupPostAction` to write the
 * `message` field of a Notification in the recipient's preferred language.
 *
 * Conventions:
 *   - Placeholders: `{name}` (author/liker display name), `{group}` (group name).
 *   - The placeholder names are language-neutral; we substitute them after
 *     the template is selected so we never run a real ICU formatter for
 *     these short strings.
 *   - English is the canonical fallback used whenever the recipient's
 *     preferredLanguage is missing or unrecognised.
 *   - All 11 LANGUAGES from `src/types/index.ts` are present.
 */

import type { Language } from '@/types';

export type NotificationDictKey = 'group_post' | 'group_post_like';

type Dict = Record<NotificationDictKey, string>;

const NOTIFICATION_DICTS: Record<Language, Dict> = {
    English: {
        group_post: '{name} posted in {group}',
        group_post_like: '{name} liked your post',
    },
    Hindi: {
        group_post: '{name} ने {group} में पोस्ट किया',
        group_post_like: '{name} ने आपकी पोस्ट को पसंद किया',
    },
    Kannada: {
        group_post: '{name} ಅವರು {group} ನಲ್ಲಿ ಪೋಸ್ಟ್ ಮಾಡಿದ್ದಾರೆ',
        group_post_like: '{name} ಅವರು ನಿಮ್ಮ ಪೋಸ್ಟ್ ಅನ್ನು ಇಷ್ಟಪಟ್ಟಿದ್ದಾರೆ',
    },
    Tamil: {
        group_post: '{name} {group} இல் பதிவிட்டார்',
        group_post_like: '{name} உங்கள் இடுகையை விரும்பினார்',
    },
    Telugu: {
        group_post: '{name} {group} లో పోస్ట్ చేశారు',
        group_post_like: '{name} మీ పోస్ట్‌ను ఇష్టపడ్డారు',
    },
    Marathi: {
        group_post: '{name} यांनी {group} मध्ये पोस्ट केले',
        group_post_like: '{name} यांना तुमची पोस्ट आवडली',
    },
    Bengali: {
        group_post: '{name} {group}-এ পোস্ট করেছেন',
        group_post_like: '{name} আপনার পোস্ট পছন্দ করেছেন',
    },
    Gujarati: {
        group_post: '{name} એ {group} માં પોસ્ટ કર્યું',
        group_post_like: '{name} ને તમારી પોસ્ટ ગમી',
    },
    Punjabi: {
        group_post: '{name} ਨੇ {group} ਵਿੱਚ ਪੋਸਟ ਕੀਤਾ',
        group_post_like: '{name} ਨੂੰ ਤੁਹਾਡੀ ਪੋਸਟ ਪਸੰਦ ਆਈ',
    },
    Malayalam: {
        group_post: '{name} {group}-ൽ പോസ്റ്റുചെയ്തു',
        group_post_like: '{name} നിങ്ങളുടെ പോസ്റ്റ് ഇഷ്ടപ്പെട്ടു',
    },
    Odia: {
        group_post: '{name} {group}ରେ ପୋଷ୍ଟ କରିଛନ୍ତି',
        group_post_like: '{name} ଆପଣଙ୍କ ପୋଷ୍ଟ ପସନ୍ଦ କରିଛନ୍ତି',
    },
};

/**
 * Returns a localized notification message string with `{name}` and
 * `{group}` placeholders substituted. Falls back to English on missing
 * or unrecognised language.
 */
export function formatNotificationMessage(
    key: NotificationDictKey,
    language: Language | string | undefined | null,
    vars: { name: string; group?: string },
): string {
    const lookup = language
        ? (NOTIFICATION_DICTS as Record<string, Dict>)[language as string]
        : undefined;
    const dict: Dict = lookup ?? NOTIFICATION_DICTS.English;
    const template = dict[key] ?? NOTIFICATION_DICTS.English[key];
    return template
        .replace('{name}', vars.name ?? '')
        .replace('{group}', vars.group ?? '');
}
