/**
 * Where the Sargvision test class (the team's own consented numbers, never parents) may run.
 *
 * One check, used by both the demo roster loader (sargvisionRosterEnabled) and the call path
 * (sargvisionRosterMode), so the two can never disagree about where the class exists:
 *   - SAMPARK_SARGVISION_ROSTER=true, and
 *   - the Sampark data lives in the non-production database (sampark-nonprod), and
 *   - either the local Firestore emulator with a non-production NODE_ENV (the launcher), or the
 *     Sampark staging Cloud Run service. Cloud Run sets K_SERVICE itself, and the production web
 *     service is named sahayakai-hotfix-resilience, so production can never match.
 *
 * Gate: sargvision-staging-environment.test.ts (production cloudbuild.yaml never sets the roster
 * flag or the non-production database; the production service name is never roster mode).
 */

import { SAMPARK_NONPROD_DATABASE } from '@/lib/sampark/repo/factory';

type Env = Record<string, string | undefined>;

/** The Cloud Run service that runs Sampark staging (cloudbuild-sampark-staging.yaml). */
export const SAMPARK_STAGING_SERVICE = 'sahayakai-sampark-staging';

/** The local launcher: Firestore emulator and a non-production build. */
export function sargvisionLocalEmulator(env: Env): boolean {
    return Boolean(env.FIRESTORE_EMULATOR_HOST?.trim()) && env.NODE_ENV !== 'production';
}

/** Sampark staging on Cloud Run, identified by the service name Cloud Run itself sets. */
export function sargvisionStagingService(env: Env): boolean {
    return env.K_SERVICE?.trim() === SAMPARK_STAGING_SERVICE;
}

export function sargvisionRosterEnvironment(env: Env): boolean {
    return env.SAMPARK_SARGVISION_ROSTER?.trim() === 'true'
        && env.SAMPARK_FIRESTORE_DATABASE?.trim() === SAMPARK_NONPROD_DATABASE
        && (sargvisionLocalEmulator(env) || sargvisionStagingService(env));
}
