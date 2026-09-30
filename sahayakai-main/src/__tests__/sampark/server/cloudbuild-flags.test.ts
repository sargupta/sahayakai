/** @jest-environment node */
/**
 * Sampark ships dark (plan §9 "Flags"): both regional deploy steps declare
 * SAMPARK_ENABLED=false and SAMPARK_LIVE_DIAL_ENABLED=false, so turning either
 * on is one reviewed PR, and a deploy can never inherit an ad-hoc value set on
 * the live service. They are env flags only: never NEXT_PUBLIC_ (shipped to
 * browsers) and never a Firestore feature flag (those default ON when missing).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

interface Step {
    id?: string;
    args?: string[];
}

function envVars(stepId: string): Map<string, string> {
    const doc = yaml.load(readFileSync(path.join(APP_ROOT, 'cloudbuild.yaml'), 'utf8')) as { steps: Step[] };
    const step = doc.steps.find((s) => s.id === stepId);
    if (!step) throw new Error(`cloudbuild.yaml has no step ${stepId}`);
    const arg = (step.args ?? []).find((a) => a.startsWith('--update-env-vars='));
    const out = new Map<string, string>();
    for (const pair of (arg ?? '').slice('--update-env-vars='.length).split(',')) {
        const eq = pair.indexOf('=');
        if (eq > 0) out.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    return out;
}

function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) {
            if (name !== '__tests__' && name !== 'node_modules') out.push(...sourceFiles(p));
        } else if (/\.(ts|tsx)$/.test(name)) out.push(p);
    }
    return out;
}

describe('Sampark deploy flags', () => {
    it.each(['deploy', 'deploy-mumbai'])('%s declares both Sampark flags false', (stepId) => {
        const env = envVars(stepId);
        expect(env.get('SAMPARK_ENABLED')).toBe('false');
        expect(env.get('SAMPARK_LIVE_DIAL_ENABLED')).toBe('false');
    });

    it('never declares a NEXT_PUBLIC_ Sampark flag', () => {
        for (const stepId of ['deploy', 'deploy-mumbai']) {
            expect([...envVars(stepId).keys()].filter((k) => /^NEXT_PUBLIC_SAMPARK/.test(k))).toEqual([]);
        }
    });

    it('reads the flags from process.env with an exact === "true" check, never from Firestore flags', () => {
        const roots = ['src/server/sampark', 'src/app/api/sampark', 'src/app/api/jobs', 'src/lib/sampark'].map((r) => path.join(APP_ROOT, r));
        const files = roots.flatMap(sourceFiles);
        const offenders: string[] = [];
        for (const f of files) {
            const src = readFileSync(f, 'utf8');
            if (/NEXT_PUBLIC_SAMPARK/.test(src)) offenders.push(`${f}: NEXT_PUBLIC_SAMPARK`);
            if (/SAMPARK_(ENABLED|LIVE_DIAL_ENABLED)/.test(src) && /isFeatureEnabled\(/.test(src)) offenders.push(`${f}: Firestore feature flag`);
            for (const m of src.matchAll(/process\.env\.(SAMPARK_ENABLED|SAMPARK_LIVE_DIAL_ENABLED)\s*(!==|===|==|!=)?\s*('[^']*')?/g)) {
                if (m[2] !== '===' && m[2] !== '!==') offenders.push(`${f}: ${m[0]}`);
                else if (m[3] !== "'true'") offenders.push(`${f}: ${m[0]}`);
            }
        }
        expect(offenders).toEqual([]);
    });
});
