/**
 * Class gates on the prod Cloud Run deploy steps in cloudbuild.yaml.
 *
 * 1. Idle-instance leak (2026-09 billing). Warm capacity was set per revision
 *    (`minScale: 1`). Every deploy adds a `sha-*` tagged revision, and a tagged
 *    revision with a revision-level minimum keeps its own warm instance for as
 *    long as the tag exists. By 2026-10 that was 55 idle instances, about
 *    Rs 3k/day, for a site serving a few hundred AI calls a week. The class is
 *    "a revision-level minimum above zero", whatever value or step sets it, so
 *    the gate bans it everywhere and requires the service-level `--min`.
 *
 * 2. Unrecreatable service (2026-10-03 outage). The service was deleted in both
 *    regions. Its base config (boot secrets, service account, sizing) existed
 *    only on the live service, because these steps used `--update-*` and audit
 *    logs redact env. Restoring it meant reconstructing that config by hand
 *    while the site 404'd. The gate: every env var the app refuses to boot
 *    without (REQUIRED_ENV_VARS in src/instrumentation.ts, read from disk so a
 *    new required var is covered automatically) is bound here, and the service
 *    shape is declared.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

interface Step {
  id?: string;
  args?: string[];
}

function steps(): Step[] {
  const doc = yaml.load(readFileSync(path.join(APP_ROOT, 'cloudbuild.yaml'), 'utf8')) as { steps: Step[] };
  return doc.steps ?? [];
}

function flag(step: Step, name: string): string | undefined {
  const hit = (step.args ?? []).find((a) => a === name || a.startsWith(`${name}=`));
  if (hit === undefined) return undefined;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : '';
}

/** Every step that creates or mutates the prod Cloud Run service. */
function cloudRunSteps(): Step[] {
  return steps().filter((s) => {
    const a = s.args ?? [];
    return a[0] === 'run' && (a[1] === 'deploy' || (a[1] === 'services' && a[2] === 'update'));
  });
}

function prodDeploySteps(): Step[] {
  const byId = new Map(steps().map((s) => [s.id, s]));
  return ['deploy', 'deploy-mumbai'].map((id) => {
    const s = byId.get(id);
    if (!s) throw new Error(`cloudbuild.yaml must keep step id: ${id}`);
    return s;
  });
}

function requiredBootVars(): string[] {
  const src = readFileSync(path.join(APP_ROOT, 'src', 'instrumentation.ts'), 'utf8');
  const block = src.match(/REQUIRED_ENV_VARS[^=]*=\s*\{([\s\S]*?)\};/);
  if (!block) throw new Error('REQUIRED_ENV_VARS not found in src/instrumentation.ts');
  return [...block[1].matchAll(/^\s*([A-Z][A-Z0-9_]+)\s*:/gm)].map((m) => m[1]);
}

describe('cloudbuild.yaml: no revision-level warm instances', () => {
  it('finds the Cloud Run steps it is guarding', () => {
    expect(cloudRunSteps().length).toBeGreaterThanOrEqual(2);
  });

  it('never sets --min-instances above 0 on any Cloud Run step', () => {
    for (const step of cloudRunSteps()) {
      const v = flag(step, '--min-instances');
      if (v !== undefined) expect({ step: step.id, minInstances: v }).toEqual({ step: step.id, minInstances: '0' });
    }
  });

  it('declares warm capacity at the service level (--min >= 1) in both regions', () => {
    for (const step of prodDeploySteps()) {
      expect(Number(flag(step, '--min'))).toBeGreaterThanOrEqual(1);
      expect(flag(step, '--min-instances')).toBe('0');
    }
  });
});

describe('cloudbuild.yaml: either region can be recreated from this file alone', () => {
  it('reads a non-empty REQUIRED_ENV_VARS list', () => {
    expect(requiredBootVars()).toEqual(expect.arrayContaining(['GOOGLE_GENAI_API_KEY', 'FIREBASE_SERVICE_ACCOUNT_KEY']));
  });

  it('binds every boot-required env var as a secret in both regions', () => {
    const required = requiredBootVars();
    for (const step of prodDeploySteps()) {
      const bound = (flag(step, '--update-secrets') ?? '')
        .split(',')
        .map((e) => e.split('=')[0].trim())
        .filter(Boolean);
      expect({ step: step.id, missing: required.filter((v) => !bound.includes(v)) }).toEqual({ step: step.id, missing: [] });
    }
  });

  it('declares the service shape in both regions', () => {
    for (const step of prodDeploySteps()) {
      for (const name of ['--service-account', '--cpu', '--memory', '--concurrency', '--timeout', '--max-instances']) {
        expect({ step: step.id, name, set: Boolean(flag(step, name)) }).toEqual({ step: step.id, name, set: true });
      }
    }
  });
});
