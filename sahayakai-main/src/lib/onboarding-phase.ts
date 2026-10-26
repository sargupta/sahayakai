/**
 * Onboarding phase — the single source of truth for every value that may be
 * stored in `users/{uid}.onboardingPhase`.
 *
 * Progressive-disclosure state machine:
 *   setup → first-generation → exploring → completing → done
 *
 *   setup             no profile yet (or only the language picked)
 *   first-generation  /onboarding Step 1 saved (full mandatory profile)
 *   exploring         first generation recorded
 *   completing        5+ generations, profile-completion card shown
 *   done              onboarding finished — full navigation, no new-user UI
 *
 * Only `done` ends new-user mode, and the /onboarding wizard finish writes it.
 *
 * History (2026-10 stuck-new-user bug): from 2026-06-06 (bf9fd025f) the wizard
 * wrote `'completed'`, a value no reader recognised, so every teacher who
 * finished onboarding stayed in the reduced new-user navigation. Writers are
 * now typed against `OnboardingPhase`, the server rejects values outside it,
 * and readers normalise the legacy aliases below.
 */

export const ONBOARDING_PHASES = [
    'setup',
    'first-generation',
    'exploring',
    'completing',
    'done',
] as const;

export type OnboardingPhase = (typeof ONBOARDING_PHASES)[number];

/** Phase written when the /onboarding wizard finishes. */
export const ONBOARDING_FINISHED_PHASE = 'done' satisfies OnboardingPhase;

/** The phase slice of a profile patch. Writers must go through this type. */
export type OnboardingPhasePatch = { onboardingPhase?: OnboardingPhase };

/**
 * Values older clients wrote that must still be read correctly. Never write
 * these — `OnboardingPhase` excludes them on purpose.
 */
export const LEGACY_ONBOARDING_PHASE_ALIASES: Readonly<Record<string, OnboardingPhase>> = {
    // /onboarding wizard finish, 2026-06-06 until the 2026-10 fix.
    completed: 'done',
    // Step 0 marker named by the F11-3 prerequisite rules; accepted by the
    // server but never written by a client. Treat as not yet set up.
    'language-picked': 'setup',
};

/**
 * Progressive disclosure is a first-week experience. Whatever phase a teacher
 * is left in (a missed transition, an abandoned wizard), new-user mode ends
 * this many days after the account was created.
 */
export const NEW_USER_MODE_MAX_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isOnboardingPhase(value: unknown): value is OnboardingPhase {
    return typeof value === 'string' && (ONBOARDING_PHASES as readonly string[]).includes(value);
}

/**
 * Map a stored value to a canonical phase. Returns `undefined` for missing or
 * unrecognised values so the caller can apply its own fallback.
 */
export function normalizeOnboardingPhase(value: unknown): OnboardingPhase | undefined {
    if (isOnboardingPhase(value)) return value;
    if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_ONBOARDING_PHASE_ALIASES, value)) {
        return LEGACY_ONBOARDING_PHASE_ALIASES[value];
    }
    return undefined;
}

/**
 * Coerce the shapes a Firestore timestamp arrives in (client SDK Timestamp,
 * Admin Timestamp, the `{_seconds}` / `{seconds}` wire shape, the ISO string
 * produced by `dbAdapter.serialize`, a Date, epoch millis) to a Date.
 */
export function toDateOrNull(value: unknown): Date | null {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'string' || typeof value === 'number') {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === 'object') {
        const v = value as { toDate?: () => unknown; seconds?: unknown; _seconds?: unknown };
        if (typeof v.toDate === 'function') return toDateOrNull(v.toDate());
        const seconds = typeof v.seconds === 'number' ? v.seconds : v._seconds;
        if (typeof seconds === 'number') return new Date(seconds * 1000);
    }
    return null;
}

/**
 * True while an account is young enough for new-user mode. An unknown
 * creation date counts as young — the phase alone decides then.
 */
export function isWithinNewUserWindow(createdAt: unknown, now: Date = new Date()): boolean {
    const created = toDateOrNull(createdAt);
    if (!created) return true;
    return now.getTime() - created.getTime() <= NEW_USER_MODE_MAX_DAYS * DAY_MS;
}

/** New-user mode: onboarding not finished AND still inside the first-week window. */
export function isNewUserPhase(phase: OnboardingPhase, createdAt: unknown, now: Date = new Date()): boolean {
    return phase !== 'done' && isWithinNewUserWindow(createdAt, now);
}
