/**
 * Compile-time class gate for the 2026-10 stuck-new-user bug (the /onboarding
 * wizard wrote onboardingPhase 'completed', which no reader recognised).
 *
 * Nothing imports this file; `npm run typecheck` (tsc --noEmit) checks it.
 * Each `@ts-expect-error` below must stay an error. If someone widens
 * `OnboardingPhase`, or loosens the profile-patch / profile types so a value
 * outside the union becomes writable, the directive is no longer needed and
 * tsc fails with "Unused '@ts-expect-error' directive".
 *
 * Runtime half of the gate: src/__tests__/lib/onboarding-phase.test.ts (the
 * reader contract + a source scan for phase literals outside the union).
 */
import type { OnboardingPhase } from './onboarding-phase';
import type { ProfileUpdatePatch } from './api/profile';
import type { UserProfile } from '@/types';

// @ts-expect-error — 'completed' is not an onboarding phase; write 'done'.
export const legacyCompletedIsNotAPhase: OnboardingPhase = 'completed';

// @ts-expect-error — a profile patch cannot carry a phase outside the union.
export const patchRejectsUnknownPhase: ProfileUpdatePatch = { onboardingPhase: 'completed' };

// @ts-expect-error — the stored profile type cannot hold a phase outside the union.
export const profileRejectsUnknownPhase: UserProfile['onboardingPhase'] = 'completed';

// Positive control: every canonical phase stays writable.
export const canonicalPhasesAreWritable: ProfileUpdatePatch[] = [
    { onboardingPhase: 'setup' },
    { onboardingPhase: 'first-generation' },
    { onboardingPhase: 'exploring' },
    { onboardingPhase: 'completing' },
    { onboardingPhase: 'done' },
];
