/**
 * The per-session calling-provider chooser — an INTERNAL DEMO tool since 2026-11-15.
 *
 * The school owns its calling provider (`SamparkSchool.conversationProvider`, chosen when the
 * school switches on calls and changed by an admin in Settings → Calling provider, audited).
 * Every call path (single Riya call, class-wide batch, scheduled callback) uses it.
 *
 * Only when SAMPARK_PROVIDER_CHOOSER === 'true' (server-side; internal demos, the local launcher)
 * does the per-session chooser below run, and only then does a session choice override the
 * school's provider. Off by default: no middleware gate and a stale cookie has no effect.
 * The SahayakAI → SamparkAI LINK goes through the chooser only when its public twin (the same
 * name with the public prefix, read in src/lib/products.ts) is also 'true' — a public flag only
 * ever picks a link, never server behaviour. A demo deployment sets both.
 *
 * Demo mechanism: the person picks "ElevenLabs Calls" or "Vobiz Calls" on
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

type Env = Record<string, string | undefined>;

/**
 * Is the per-session demo chooser switched on? A server-side flag (read by the middleware and
 * the Riya server code, never shipped to the browser). Off unless exactly 'true'.
 */
export function providerChooserEnabled(env: Env = process.env): boolean {
    return env.SAMPARK_PROVIDER_CHOOSER === 'true';
}

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

/** The chooser URL used by "Switch provider" links: always shows the cards. */
export function switchProviderHref(chooserPath: string, here: string): string {
    return `${chooserPath}?next=${encodeURIComponent(here)}&${SWITCH_PARAM}=1`;
}

export const PROVIDER_LABEL: Record<ProviderChoice, string> = {
    elevenlabs: 'ElevenLabs Calls',
    vobiz: 'Vobiz Calls',
};
