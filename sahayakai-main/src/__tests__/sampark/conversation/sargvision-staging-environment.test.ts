/**
 * @jest-environment node
 *
 * Class gate: where the Sargvision test class (the team's own numbers, never parents) may exist.
 * The demo roster loader and the call path share ONE check (sargvisionRosterEnvironment): the
 * local emulator, or the Sampark staging Cloud Run service. Production must never match: its
 * build file never sets the roster flag or the non-production database, and its service name is
 * never roster mode, whatever else is set. Calls at any hour stay local-only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    SAMPARK_STAGING_SERVICE,
    sargvisionRosterEnvironment,
} from '@/server/sampark/sargvision-environment';
import { sargvisionAnytimeCalls, sargvisionRosterMode } from '@/server/sampark/conversation';
import { sargvisionRosterEnabled } from '@/server/sampark/sargvision';
import { SARGVISION_ORG_ID } from '@/lib/sampark/sargvision';
import type { SamparkSchool } from '@/types/sampark';
import { STAGING_PROJECT, stagingSeedRefusal } from '../../../../scripts/sampark/seed-sargvision-staging-guard';

const appRoot = join(__dirname, '..', '..', '..', '..');
const read = (p: string) => readFileSync(join(appRoot, p), 'utf8');

const PRODUCTION_SERVICE = 'sahayakai-hotfix-resilience';

const staging = (over: Record<string, string | undefined> = {}) => ({
    K_SERVICE: SAMPARK_STAGING_SERVICE,
    NODE_ENV: 'production',
    SAMPARK_SARGVISION_ROSTER: 'true',
    SAMPARK_FIRESTORE_DATABASE: 'sampark-nonprod',
    ...over,
});

const local = (over: Record<string, string | undefined> = {}) => ({
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    NODE_ENV: 'development',
    SAMPARK_SARGVISION_ROSTER: 'true',
    SAMPARK_FIRESTORE_DATABASE: 'sampark-nonprod',
    ...over,
});

const sv = { orgId: SARGVISION_ORG_ID, isDemo: false, mode: 'test' } as unknown as SamparkSchool;

describe('production can never run the Sargvision class', () => {
    const prodBuild = read('cloudbuild.yaml');

    it('the production build file is the production service', () => {
        expect(prodBuild).toMatch(new RegExp(`_SERVICE:\\s*${PRODUCTION_SERVICE}\\b`));
    });

    it('the production build never sets the roster flag or the non-production database', () => {
        expect(prodBuild).not.toMatch(/SAMPARK_SARGVISION_ROSTER/);
        expect(prodBuild).not.toMatch(/SAMPARK_SARGVISION_ANYTIME_CALLS/);
        expect(prodBuild).not.toMatch(/sampark-nonprod/);
    });

    it('the production service name is never roster mode, even with every other setting on', () => {
        const prod = staging({ K_SERVICE: PRODUCTION_SERVICE });
        expect(sargvisionRosterEnvironment(prod)).toBe(false);
        expect(sargvisionRosterEnabled(prod)).toBe(false);
        expect(sargvisionRosterMode(prod, sv)).toBe(false);
        expect(sargvisionRosterEnvironment({ ...prod, K_SERVICE: undefined })).toBe(false);
    });

    it('the staging service name is not the production one', () => {
        expect(SAMPARK_STAGING_SERVICE).not.toBe(PRODUCTION_SERVICE);
    });
});

describe('Sampark staging runs the class', () => {
    it('the staging build is the staging service and turns the roster on with the non-production database', () => {
        const build = read('cloudbuild-sampark-staging.yaml');
        expect(build).toMatch(new RegExp(`_SERVICE:\\s*${SAMPARK_STAGING_SERVICE}\\b`));
        expect(build).toMatch(/@SAMPARK_SARGVISION_ROSTER=true@/);
        expect(build).toMatch(/@SAMPARK_FIRESTORE_DATABASE=sampark-nonprod@/);
        const envLines = build.split(/\r?\n/).filter((l) => !l.trim().startsWith('#')).join('\n');
        expect(envLines).not.toMatch(/SAMPARK_SARGVISION_ANYTIME_CALLS/);
    });

    it('roster mode on staging needs the flag and the non-production database', () => {
        expect(sargvisionRosterEnvironment(staging())).toBe(true);
        expect(sargvisionRosterEnabled(staging())).toBe(true);
        expect(sargvisionRosterMode(staging(), sv)).toBe(true);
        expect(sargvisionRosterEnvironment(staging({ SAMPARK_SARGVISION_ROSTER: undefined }))).toBe(false);
        expect(sargvisionRosterEnvironment(staging({ SAMPARK_FIRESTORE_DATABASE: undefined }))).toBe(false);
        expect(sargvisionRosterEnvironment(staging({ SAMPARK_FIRESTORE_DATABASE: '(default)' }))).toBe(false);
    });

    it('only the Sargvision school, not a demo school, in Test mode', () => {
        expect(sargvisionRosterMode(staging(), { ...sv, orgId: 'sargvision-demo-school' } as SamparkSchool)).toBe(false);
        expect(sargvisionRosterMode(staging(), { ...sv, isDemo: true } as SamparkSchool)).toBe(false);
        expect(sargvisionRosterMode(staging(), { ...sv, mode: 'practice' } as SamparkSchool)).toBe(false);
    });

    it('calls at any hour stay local-only: staging keeps 10:00-19:00 IST even with the flag set', () => {
        expect(sargvisionAnytimeCalls(staging({ SAMPARK_SARGVISION_ANYTIME_CALLS: 'true' }), sv)).toBe(false);
        expect(sargvisionAnytimeCalls(local({ SAMPARK_SARGVISION_ANYTIME_CALLS: 'true' }), sv)).toBe(true);
    });
});

describe('the local launcher keeps working', () => {
    it('emulator + non-production build + flag + nonprod database', () => {
        expect(sargvisionRosterEnvironment(local())).toBe(true);
        expect(sargvisionRosterEnvironment(local({ NODE_ENV: 'production' }))).toBe(false);
        expect(sargvisionRosterEnvironment(local({ FIRESTORE_EMULATOR_HOST: undefined }))).toBe(false);
        expect(sargvisionRosterEnvironment(local({ SAMPARK_SARGVISION_ROSTER: undefined }))).toBe(false);
    });
});

describe('the staging seed refuses everything except staging', () => {
    const ok = ['--project', STAGING_PROJECT, '--owner', 'uid-owner'];

    it('runs only for project sahayakai-b4248, database sampark-nonprod, off the emulator', () => {
        expect(stagingSeedRefusal(ok, {})).toBeNull();
        expect(stagingSeedRefusal(['--project', 'another-project', '--owner', 'u'], {})).toMatch(/--project/);
        expect(stagingSeedRefusal(['--owner', 'u'], {})).toMatch(/--project/);
        expect(stagingSeedRefusal(ok, { GOOGLE_CLOUD_PROJECT: 'another-project' })).toMatch(/GOOGLE_CLOUD_PROJECT/);
        expect(stagingSeedRefusal([...ok, '--database', '(default)'], {})).toMatch(/sampark-nonprod/);
        expect(stagingSeedRefusal(ok, { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' })).toMatch(/emulator/);
        expect(stagingSeedRefusal(['--project', STAGING_PROJECT], {})).toMatch(/--owner/);
    });

    it('never encrypts with keys from the shell (they could be production’s)', () => {
        expect(stagingSeedRefusal(ok, { SAMPARK_PII_KEY: 'x' })).toMatch(/SAMPARK_PII_KEY/);
        expect(stagingSeedRefusal(ok, { SAMPARK_PHONE_PEPPER: 'x' })).toMatch(/SAMPARK_PHONE_PEPPER/);
    });

    it('reads only the staging secrets', () => {
        const src = read('scripts/sampark/seed-sargvision-staging.ts');
        expect(src.match(/secret\(sm, '([A-Z_]+)'\)/g)).toEqual(["secret(sm, 'SAMPARK_STAGING_PII_KEY')", "secret(sm, 'SAMPARK_STAGING_PHONE_PEPPER')"]);
    });
});
