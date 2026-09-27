/**
 * Class gate: the two regional deploy steps in cloudbuild.yaml must configure
 * the service identically.
 *
 * This repository has been burned by regional drift twice, and both times the
 * symptom was a feature that worked for half the users:
 *
 *   - The 11-day split-brain of 2026-08: the image was pushed only to the
 *     Singapore registry, so Mumbai kept serving a 2026-08-13 build.
 *   - DEMO_CALL_PEPPER / DEMO_CALL_ENC_KEY were bound in Singapore and missing
 *     in Mumbai, so the demo-call lead magnet was silently dead in one region.
 *
 * Both were a human keeping two long `--update-secrets` / `--update-env-vars`
 * lines in sync by eye. Adding a variable to one block and forgetting the other
 * is a one-character mistake that no other gate can see, because each region is
 * internally consistent and deploys cleanly.
 *
 * So the gate is on the class: whatever the two blocks configure, they configure
 * the same thing. Region, image and any region-scoped value are excluded by
 * name, and the test asserts those exclusions actually differ — otherwise a
 * copy-paste that pointed Mumbai at the Singapore image would pass.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const CLOUDBUILD = path.join(APP_ROOT, 'cloudbuild.yaml');

interface Step {
  id?: string;
  args?: string[];
}

/** Flag values keyed by name, e.g. { '--region': 'asia-south1' }. */
function flags(step: Step): Map<string, string> {
  const out = new Map<string, string>();
  for (const arg of step.args ?? []) {
    const eq = arg.indexOf('=');
    if (arg.startsWith('--') && eq !== -1) out.set(arg.slice(0, eq), arg.slice(eq + 1));
  }
  return out;
}

/** A comma-separated flag value parsed into a sorted list of KEY=VALUE pairs. */
function entries(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean).sort();
}

function deploySteps(): { singapore: Step; mumbai: Step } {
  const doc = yaml.load(readFileSync(CLOUDBUILD, 'utf8')) as { steps: Step[] };
  const byId = new Map((doc.steps ?? []).map((s) => [s.id, s]));
  const singapore = byId.get('deploy');
  const mumbai = byId.get('deploy-mumbai');
  if (!singapore || !mumbai) {
    throw new Error(
      `cloudbuild.yaml must keep steps id: deploy and id: deploy-mumbai — found ${[...byId.keys()].join(', ')}`,
    );
  }
  return { singapore, mumbai };
}

describe('cloudbuild.yaml keeps both regions in parity', () => {
  it('has a deploy step for each region, pointing at different regions', () => {
    const { singapore, mumbai } = deploySteps();
    const sg = flags(singapore);
    const mb = flags(mumbai);

    // If these ever match, the test below is comparing a region against itself
    // and proves nothing.
    expect(sg.get('--region')).toBe('asia-southeast1');
    expect(mb.get('--region')).toBe('asia-south1');
    expect(sg.get('--image')).not.toBe(mb.get('--image'));
  });

  it('binds the same secrets in both regions', () => {
    const { singapore, mumbai } = deploySteps();
    const sg = entries(flags(singapore).get('--update-secrets'));
    const mb = entries(flags(mumbai).get('--update-secrets'));

    expect(sg.length).toBeGreaterThan(0);
    expect(mb).toEqual(sg);
  });

  it('sets the same environment variables in both regions', () => {
    const { singapore, mumbai } = deploySteps();
    const sg = entries(flags(singapore).get('--update-env-vars'));
    const mb = entries(flags(mumbai).get('--update-env-vars'));

    expect(sg.length).toBeGreaterThan(0);
    expect(mb).toEqual(sg);
  });

  it('never reintroduces a plaintext credential as an env var', () => {
    // F1-04: Twilio credentials moved to Secret Manager because a plaintext env
    // var is readable by any principal holding run.services.get. The same
    // applies to the Vobiz credentials that joined them in 2026-09.
    const { singapore, mumbai } = deploySteps();
    const forbidden = /^(TWILIO_ACCOUNT_SID|TWILIO_AUTH_TOKEN|VOBIZ_AUTH_ID|VOBIZ_AUTH_TOKEN|SAHAYAKAI_REQUEST_SIGNING_KEY|FIREBASE_SERVICE_ACCOUNT_KEY|GOOGLE_GENAI_API_KEY)=/;

    for (const step of [singapore, mumbai]) {
      const plaintext = entries(flags(step).get('--update-env-vars')).filter((e) => forbidden.test(e));
      expect(plaintext).toEqual([]);
    }
  });
});
