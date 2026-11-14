/**
 * The calling-provider choice made at the SahayakAI → SamparkAI boundary.
 *
 * One authoritative mechanism: the person picks "ElevenLabs Calls" or "Vobiz Calls" on
 * /sampark/choose-provider every time they enter SamparkAI from SahayakAI. The server stores
 * the choice in an httpOnly, per-browser-session cookie (set only by POST /api/sampark/provider,
 * after sign-in, and only for a provider this deployment has configured). The Riya routes read it
 * server-side and `startRiyaCall` dials with it; every call record keeps the provider it used.
 * It is one person's session: it never changes the provider for another user or school, and it
 * never bypasses a gate — whichever provider is chosen, every Riya rule still applies.
 *
 * Edge-safe (used by middleware): no Node APIs here.
 */

export const PROVIDER_COOKIE = 'sampark_provider';
export const CHOOSER_SEGMENT = 'choose-provider';
export const PROVIDER_CHOICES = ['elevenlabs', 'vobiz'] as const;
export type ProviderChoice = (typeof PROVIDER_CHOICES)[number];

export function parseProviderChoice(value: string | null | undefined): ProviderChoice | null {
    return value === 'elevenlabs' || value === 'vobiz' ? value : null;
}

/** The choice from a request's Cookie header (route handlers receive a plain Request). */
export function providerChoiceFromCookieHeader(cookieHeader: string | null | undefined): ProviderChoice | null {
    for (const part of (cookieHeader ?? '').split(';')) {
        const [k, ...v] = part.trim().split('=');
        if (k === PROVIDER_COOKIE) return parseProviderChoice(decodeURIComponent(v.join('=')));
    }
    return null;
}

/**
 * Does this page (a path in the /sampark route tree) need a provider choice first?
 * The public website (/sampark) and the chooser itself do not; the signed-in workspace
 * (/sampark/workspace), every school (/sampark/<orgId>/…) and the demo school do.
 */
export function needsProviderChoice(samparkPath: string): boolean {
    if (samparkPath !== '/sampark' && !samparkPath.startsWith('/sampark/')) return false;
    const first = samparkPath.split('/')[2] ?? '';
    if (!first) return false;
    return first !== CHOOSER_SEGMENT;
}

/** A `next` target is only ever a path inside the /sampark tree (never another origin). */
export function safeNext(next: string | null | undefined, fallback: string): string {
    if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
    return next;
}

/** Query flag that asks the chooser to show even when a choice is already stored ("Switch"). */
export const SWITCH_PARAM = 'switch';

/**
 * Entering SamparkAI again in the same browser session should not re-ask a question the
 * person already answered. When the chooser is opened with a stored choice and without an
 * explicit `?switch=1`, this returns the (safe, relative) path to continue to; otherwise null
 * and the chooser renders. Never returns the chooser itself, so it cannot loop.
 */
export function skipChooserTarget(
    search: URLSearchParams,
    storedChoice: ProviderChoice | null,
): string | null {
    if (!storedChoice || search.has(SWITCH_PARAM)) return null;
    const next = safeNext(search.get('next'), '');
    if (!next) return null;
    const nextPath = next.split('?')[0];
    if (nextPath.endsWith(`/${CHOOSER_SEGMENT}`)) return null;
    return next;
}

/** The chooser URL used by "Switch provider" links: always shows the cards. */
export function switchProviderHref(chooserPath: string, here: string): string {
    return `${chooserPath}?next=${encodeURIComponent(here)}&${SWITCH_PARAM}=1`;
}

export const PROVIDER_LABEL: Record<ProviderChoice, string> = {
    elevenlabs: 'ElevenLabs Calls',
    vobiz: 'Vobiz Calls',
};
