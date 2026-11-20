/**
 * The refusals of seed-sargvision-staging.ts, kept apart so the gate test can import them without
 * running the script (sargvision-staging-environment.test.ts).
 */

import { SAMPARK_NONPROD_DATABASE } from '@/lib/sampark/repo/factory';

export const STAGING_PROJECT = 'sahayakai-b4248';
/** The school whose admins also administer the Sargvision class on staging. */
export const ADMINS_FROM_ORG = 'sargvision-demo-school';

export function argValue(argv: string[], flag: string): string | undefined {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
}

/** Every reason to refuse before anything is read or written. Exported for the gate test. */
export function stagingSeedRefusal(argv: string[], env: Record<string, string | undefined>): string | null {
    if (argValue(argv, '--project') !== STAGING_PROJECT) return `--project must be ${STAGING_PROJECT}.`;
    const ambient = env.GOOGLE_CLOUD_PROJECT?.trim() || env.GCLOUD_PROJECT?.trim();
    if (ambient && ambient !== STAGING_PROJECT) return `GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT is ${ambient}, not ${STAGING_PROJECT}.`;
    const database = argValue(argv, '--database') ?? SAMPARK_NONPROD_DATABASE;
    if (database !== SAMPARK_NONPROD_DATABASE) return `the Sampark database must be ${SAMPARK_NONPROD_DATABASE}.`;
    if (env.FIRESTORE_EMULATOR_HOST?.trim()) return 'FIRESTORE_EMULATOR_HOST is set: use seed-emulator.ts --sargvision for the emulator.';
    if (env.SAMPARK_PII_KEY || env.SAMPARK_PHONE_PEPPER) {
        return 'SAMPARK_PII_KEY / SAMPARK_PHONE_PEPPER are set in this shell. Unset them: this script loads staging\'s own keys.';
    }
    if (!argValue(argv, '--owner')) return '--owner <uid> is required (your Firebase uid; it becomes adminUserId).';
    return null;
}

