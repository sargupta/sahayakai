/**
 * Class gate: the live parent-call service has exactly one deploy definition,
 * and it never takes traffic by itself.
 *
 * The bug this catches: two engines declared the SAME Cloud Run service name,
 * `sahayakai-telephony`. Production runs the Pipecat app in
 * services/voice-server (deployed by hand, with no definition in the repo at
 * all); sahayakai-agents/deploy/telephony-service.yaml declared a different,
 * never-deployed engine under that name. `gcloud run services replace` on that
 * file would have silently swapped production for an engine that had never
 * taken a real call, at 100% traffic. The live service still carries env left
 * over from it.
 *
 * Renaming that one file fixes the instance. The class is "a second file can
 * deploy the live service", or "a deploy of it can take traffic straight away",
 * so this scans every tracked file for deploy definitions — Knative service
 * manifests, `gcloud run deploy` / `gcloud run services update` commands
 * (shell, YAML arg lists, workflows), Terraform Cloud Run resources — and
 * requires, for each protected service, exactly one definition, in the
 * expected file, with --no-traffic. A manifest can never carry --no-traffic
 * (`services replace` applies its own traffic block), so a manifest for a
 * protected service always fails.
 *
 * Text-based on purpose, like .github/scripts/check_playwright_runners.py.
 *
 * A shape scanner can always miss a shape (the independent review found ten:
 * flags before the name, `--project X name`, a zero-indent args list, a
 * GitHub Actions `${{ env.X }}`, the deploy-cloudrun action, a Makefile
 * `$(X)`, a multi-line argv list, a quoted or JSON manifest, a trailing
 * comment on an assignment). So the primary rule fails CLOSED on the name:
 * no tracked non-doc file except the one allowed source may mention the
 * protected service's bare name outside a comment. Any of those shapes still
 * has to contain the name somewhere. The shape scanner, hardened for all ten,
 * stays for the --no-traffic check on the allowed file.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const MONOREPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SELF = path.relative(MONOREPO_ROOT, __filename).split(path.sep).join('/');

/** Protected service → the one file allowed to deploy it. */
const PROTECTED: Record<string, string> = {
    'sahayakai-telephony': 'sahayakai-main/services/voice-server/cloudbuild.yaml',
};

const NOT_DEPLOY_CONFIG =
    /\.(md|mdx|txt|rst|html?|csv|ipynb|png|jpe?g|gif|webp|ico|svg|ulaw|wav|mp3|mp4|webm|pdf|woff2?|ttf|otf|zip|gz|lock|tsbuildinfo|map)$|package-lock\.json$/i;

/** Files other than the allowed source that may mention a protected name, each with its reason. */
const NAME_ALLOWLIST: Record<string, string> = {
    'sahayakai-agents/deploy/cloudbuild-riya-bridge.yaml': 'refusal guard: the Riya bridge build stops if its target is the live engine',
    'sahayakai-agents/deploy/cloudbuild-vidya-voice.yaml': 'refusal guard: the VIDYA voice build stops if its target is the live engine',
    'sahayakai-agents/deploy/monitoring/alert-policy.template.json': 'monitoring: an alert that reads the live engine logs, never a deploy',
    'sahayakai-agents/deploy/monitoring/parent-call-monitoring.sh': 'monitoring: a log filter on the live engine, never a deploy',
    'sahayakai-main/src/__tests__/deploy/vidya-live-production-config.test.ts': 'a test asserting the VIDYA voice URL is never the live engine',
};

interface DeployDefinition {
    file: string;
    service: string;
    how: 'manifest' | 'gcloud' | 'terraform' | 'action';
    noTraffic: boolean;
}

/** Drop whole-line comments; comments are instructions to humans, not deploys. */
function stripComments(text: string): string[] {
    return text.split(/\r?\n/).filter((line) => {
        const t = line.trim();
        return !(t.startsWith('#') || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*'));
    });
}

/** Non-comment lines that name the service itself (not "<name>-agents", not a "<name>-xyz.run.app" host). */
export function nameMentions(text: string, service: string): string[] {
    const bare = new RegExp(`(?<![A-Za-z0-9_-])${service.replace(/[-]/g, '\\-')}(?![A-Za-z0-9_-])`);
    return stripComments(text).filter((line) => bare.test(line));
}

/** Normalise variable syntaxes to $NAME: GitHub `${{ env.X }}`, Make `$(X)`. */
function normaliseVars(line: string): string {
    return line
        .replace(/\$\{\{\s*(?:env|vars|inputs)\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, '$$$1')
        .replace(/\$\(([A-Za-z_][A-Za-z0-9_]*)\)/g, '$$$1');
}

/**
 * Logical command lines: shell continuations joined, and a YAML `args:` list
 * of plain scalars joined into one line (a block scalar such as `- |` ends the
 * join; its content is read as ordinary lines).
 */
function logicalLines(lines: string[]): string[] {
    const joined = lines.join('\n').replace(/\\\r?\n/g, ' ').split('\n').map(normaliseVars);
    const out: string[] = [];
    for (let i = 0; i < joined.length; i++) {
        const head = joined[i].match(/^(\s*)(?:-\s+)?args:\s*$/);
        if (!head) {
            out.push(joined[i]);
            continue;
        }
        const indent = head[1].length;
        const items: string[] = [];
        let j = i + 1;
        for (; j < joined.length; j++) {
            const line = joined[j];
            if (!line.trim()) continue;
            const item = line.match(/^(\s*)-\s+(.*)$/);
            // Items may sit at the same indent as `args:` (valid YAML, common in cloudbuild files).
            if (!item || item[1].length < indent) break;
            if (/^[|>][-+]?\s*$/.test(item[2].trim())) break;
            items.push(item[2]);
        }
        out.push(`args: ${items.join(' ')}`);
        i = j - 1;
    }
    return out;
}

function tokens(line: string): string[] {
    return line.replace(/[[\],'"`]/g, ' ').split(/\s+/).filter(Boolean);
}

/** `NAME=value`, `NAME: value` (cloudbuild substitutions), `NAME = "value"`. */
function assignments(lines: string[]): Map<string, string> {
    const vars = new Map<string, string>();
    for (const line of lines) {
        const m = line.match(
            /^\s*(?:export\s+|local\s+|readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?::=|\?=|[:=])\s*["']?([A-Za-z0-9-]+)["']?\s*(?:#.*)?$/,
        );
        if (m) vars.set(m[1], m[2]);
        const dflt = line.match(/([A-Za-z_][A-Za-z0-9_]*)=["']?\$\{\1:-([A-Za-z0-9-]+)\}/);
        if (dflt) vars.set(dflt[1], dflt[2]);
    }
    return vars;
}

function resolve(target: string, vars: Map<string, string>): string | null {
    const ref = target.match(/^\$\{?([A-Za-z_][A-Za-z0-9_]*)(?::-([A-Za-z0-9-]+))?\}?$/);
    if (ref) return vars.get(ref[1]) ?? ref[2] ?? null;
    return /^[a-z][a-z0-9-]*$/.test(target) ? target : null;
}

export function deployDefinitions(file: string, text: string): DeployDefinition[] {
    const found: DeployDefinition[] = [];
    const lines = stripComments(text);
    const body = lines.join('\n');

    // Knative service manifests (gcloud run services replace <file>), YAML or JSON, quoted or not.
    for (const doc of body.split(/^---\s*$/m)) {
        if (!/^["']?apiVersion["']?:\s*["']?serving\.knative\.dev\//m.test(doc)) continue;
        if (!/^["']?kind["']?:\s*["']?Service["']?\s*$/m.test(doc)) continue;
        const name = doc.match(/^["']?metadata["']?:\s*\n(?:[ \t]+.*\n)*?[ \t]+["']?name["']?:\s*["']?([A-Za-z0-9-]+)/m);
        if (name) found.push({ file, service: name[1], how: 'manifest', noTraffic: false });
    }
    if (/serving\.knative\.dev/.test(body) && file.endsWith('.json')) {
        try {
            const docs = ([] as unknown[]).concat(JSON.parse(text));
            for (const d of docs as Array<{ kind?: string; apiVersion?: string; metadata?: { name?: string } }>) {
                if (d?.kind === 'Service' && String(d?.apiVersion).startsWith('serving.knative.dev/') && d.metadata?.name) {
                    found.push({ file, service: d.metadata.name, how: 'manifest', noTraffic: false });
                }
            }
        } catch {
            // not JSON after all
        }
    }

    // The google-github-actions/deploy-cloudrun action.
    const vars0 = assignments(lines);
    for (const m of body.matchAll(/uses:\s*["']?google-github-actions\/deploy-cloudrun@[^\n]*\n((?:[ \t]+.*\n?){0,25})/g)) {
        const svc = m[1].match(/^\s*service:\s*["']?([^"'\s]+)/m);
        if (!svc) continue;
        const service = resolve(normaliseVars(svc[1]), vars0);
        if (service) {
            const noTraffic = /^\s*no_traffic:\s*["']?true/m.test(m[1]) || /--no-traffic/.test(m[1]);
            found.push({ file, service, how: 'action', noTraffic });
        }
    }

    // Terraform Cloud Run services.
    for (const m of body.matchAll(/resource\s+"google_cloud_run(?:_v2)?_service"\s+"[^"]+"\s*\{[\s\S]*?\bname\s*=\s*"([A-Za-z0-9-]+)"/g)) {
        found.push({ file, service: m[1], how: 'terraform', noTraffic: false });
    }

    // gcloud run deploy / gcloud run services update.
    const vars = assignments(lines);
    for (const line of logicalLines(lines)) {
        const t = tokens(line);
        for (let i = 0; i + 1 < t.length; i++) {
            let at = -1;
            if (t[i] === 'run' && t[i + 1] === 'deploy') at = i + 2;
            else if (t[i] === 'run' && t[i + 1] === 'services' && t[i + 2] === 'update') at = i + 3;
            if (at < 0) continue;
            // The service is a positional argument, but flags may come first and
            // some take a separate value (`--project X name`), so every
            // non-flag token after the verb is a candidate.
            const noTraffic = t.includes('--no-traffic');
            const seen = new Set<string>();
            for (const candidate of t.slice(at).filter((x) => !x.startsWith('-'))) {
                const service = resolve(candidate, vars);
                if (service && !seen.has(service)) {
                    seen.add(service);
                    found.push({ file, service, how: 'gcloud', noTraffic });
                }
            }
        }
    }
    return found;
}

function trackedFiles(): string[] {
    const out = execFileSync('git', ['ls-files', '-z'], {
        cwd: MONOREPO_ROOT,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });
    return out.split('\0').filter((f) => f && f !== SELF && !NOT_DEPLOY_CONFIG.test(f));
}

function allDefinitions(): DeployDefinition[] {
    const defs: DeployDefinition[] = [];
    for (const file of trackedFiles()) {
        const full = path.join(MONOREPO_ROOT, file);
        let text: string;
        try {
            if (statSync(full).size > 2 * 1024 * 1024) continue;
            text = readFileSync(full, 'utf8');
        } catch {
            continue; // a submodule or a file removed in the working tree
        }
        if (!/run|knative|google_cloud_run/.test(text)) continue;
        defs.push(...deployDefinitions(file, text));
    }
    return defs;
}

// ── The repository ───────────────────────────────────────────────────────────

describe('one deploy source per protected Cloud Run service', () => {
    const defs = allDefinitions();

    it('finds deploy definitions at all (a gate that scans nothing reports green forever)', () => {
        const services = new Set(defs.map((d) => d.service));
        expect(services).toContain('sahayakai-agents');
        expect(services).toContain('sahayakai-hotfix-resilience');
    });

    it.each(Object.entries(PROTECTED))('%s has exactly one definition, in %s', (service, expectedFile) => {
        const files = [...new Set(defs.filter((d) => d.service === service).map((d) => d.file))];
        expect(files).toEqual([expectedFile]);
    });

    it.each(Object.entries(PROTECTED))('no file but %s mentions it outside a comment (fails closed on the name)', (service, allowed) => {
        const offenders: string[] = [];
        for (const file of trackedFiles()) {
            if (file === allowed || NAME_ALLOWLIST[file]) continue;
            let text: string;
            try {
                text = readFileSync(path.join(MONOREPO_ROOT, file), 'utf8');
            } catch {
                continue;
            }
            if (!text.includes(service)) continue;
            const lines = nameMentions(text, service);
            if (lines.length) offenders.push(`${file}: ${lines[0].trim().slice(0, 120)}`);
        }
        expect(offenders).toEqual([]);
    });

    it('every name-allowlist entry still exists and says why', () => {
        for (const [file, reason] of Object.entries(NAME_ALLOWLIST)) {
            expect(reason.length).toBeGreaterThan(20);
            expect(() => statSync(path.join(MONOREPO_ROOT, file))).not.toThrow();
        }
    });

    it.each(Object.keys(PROTECTED))('every definition of %s deploys with --no-traffic', (service) => {
        const offenders = defs
            .filter((d) => d.service === service && !d.noTraffic)
            .map((d) => `${d.file} (${d.how})`);
        expect(offenders).toEqual([]);
    });
});

// ── The scanner itself ───────────────────────────────────────────────────────
// Samples are assembled from pieces so this file never reads as a deploy.

const SVC = ['sahayakai', 'telephony'].join('-');
const RUN_DEPLOY = ['run', 'deploy'].join(' ');

describe('deployDefinitions recognises every shape a deploy can take', () => {
    it('a cloudbuild args list, with comments between the items', () => {
        const yaml = [
            'steps:',
            '  - id: deploy',
            '    entrypoint: gcloud',
            '    args:',
            '      - run',
            '      - deploy',
            `      - ${SVC}`,
            '      # never takes traffic',
            '      - --no-traffic',
            '      - --tag=candidate',
        ].join('\n');
        expect(deployDefinitions('a.yaml', yaml)).toEqual([
            { file: 'a.yaml', service: SVC, how: 'gcloud', noTraffic: true },
        ]);
    });

    it('a shell command split over lines, without --no-traffic', () => {
        const sh = `gcloud ${RUN_DEPLOY} ${SVC} \\\n  --source . \\\n  --region asia-southeast1\n`;
        expect(deployDefinitions('d.sh', sh).filter((d) => d.service === SVC)).toEqual([
            { file: 'd.sh', service: SVC, how: 'gcloud', noTraffic: false },
        ]);
    });

    it('a target held in a variable or a cloudbuild substitution', () => {
        const sh = `SERVICE="\${SERVICE:-${SVC}}"\ngcloud ${RUN_DEPLOY} "$SERVICE" --no-traffic\n`;
        expect(deployDefinitions('v.sh', sh).map((d) => [d.service, d.noTraffic])).toEqual([[SVC, true]]);
        const cb = `substitutions:\n  _SERVICE: ${SVC}\nsteps:\n  - args: [run, deploy, '\${_SERVICE}', --region=x]\n`;
        expect(deployDefinitions('c.yaml', cb).map((d) => [d.service, d.noTraffic])).toEqual([[SVC, false]]);
    });

    it('a Knative manifest, which can never be traffic-free', () => {
        const manifest = `apiVersion: serving.knative.dev/v1\nkind: Service\nmetadata:\n  name: ${SVC}\nspec: {}\n`;
        expect(deployDefinitions('m.yaml', manifest)).toEqual([
            { file: 'm.yaml', service: SVC, how: 'manifest', noTraffic: false },
        ]);
    });

    it('gcloud run services update, and Terraform', () => {
        const sh = `gcloud run services update ${SVC} --update-env-vars=A=1\n`;
        expect(deployDefinitions('u.sh', sh)[0]).toMatchObject({ service: SVC, noTraffic: false });
        const tf = `resource "google_cloud_run_v2_service" "x" {\n  name = "${SVC}"\n}\n`;
        expect(deployDefinitions('t.tf', tf)[0]).toMatchObject({ service: SVC, how: 'terraform' });
    });

    // The ten shapes the independent review found the first scanner missed.
    const missedBefore: Record<string, string> = {
        'flags before the name': `gcloud ${RUN_DEPLOY} --region=asia-southeast1 --source . ${SVC}\n`,
        '--project X name': `gcloud ${RUN_DEPLOY} --project sahayakai-b4248 ${SVC}\n`,
        'flag value item before the name': `steps:\n  - args:\n      - run\n      - deploy\n      - --region\n      - asia-southeast1\n      - ${SVC}\n`,
        'GitHub Actions env expression': `jobs:\n  d:\n    env:\n      SERVICE: ${SVC}\n    steps:\n      - run: gcloud ${RUN_DEPLOY} \${{ env.SERVICE }} --region x\n`,
        'deploy-cloudrun action': `steps:\n  - uses: google-github-actions/deploy-cloudrun@v2\n    with:\n      service: ${SVC}\n      region: asia-southeast1\n`,
        'zero-indent args list': `steps:\n- name: gcr.io/x\n  args:\n  - run\n  - deploy\n  - ${SVC}\n`,
        'Makefile variable': `SERVICE := ${SVC}\ndeploy:\n\tgcloud ${RUN_DEPLOY} $(SERVICE) --region x\n`,
        'quoted manifest apiVersion': `apiVersion: "serving.knative.dev/v1"\nkind: Service\nmetadata:\n  name: ${SVC}\n`,
        'trailing comment on the assignment': `SERVICE=${SVC}  # live\ngcloud ${RUN_DEPLOY} "$SERVICE"\n`,
    };

    it.each(Object.entries(missedBefore))('now catches: %s', (_shape, text) => {
        expect(deployDefinitions('x', text).map((d) => d.service)).toContain(SVC);
    });

    it('a JSON manifest', () => {
        const json = JSON.stringify({ apiVersion: 'serving.knative.dev/v1', kind: 'Service', metadata: { name: SVC } });
        expect(deployDefinitions('m.json', json).map((d) => d.service)).toEqual([SVC]);
    });

    it('the name rule catches what no shape does (a multi-line argv list), and nothing else', () => {
        const argv = `subprocess.run([\n    "gcloud", "run", "deploy",\n    "${SVC}",\n])\n`;
        expect(nameMentions(argv, SVC)).toHaveLength(1);
        expect(nameMentions(`# gcloud ${RUN_DEPLOY} ${SVC}\n`, SVC)).toEqual([]);
        expect(nameMentions(`url: https://${SVC}-zwydpvyuca-as.a.run.app\n`, SVC)).toEqual([]);
        expect(nameMentions(`name: ${SVC}-agents\n`, SVC)).toEqual([]);
    });

    it('ignores comments, URLs and look-alike names', () => {
        const text = [
            `# gcloud ${RUN_DEPLOY} ${SVC} --source .`,
            `      - --set-env-vars=VOBIZ_STREAM_BASE_URL=https://${SVC}-zwydpvyuca-as.a.run.app`,
            `gcloud run services update-traffic ${SVC} --to-tags=candidate=100`,
            `gcloud ${RUN_DEPLOY} ${SVC}-agents --no-traffic`,
        ].join('\n');
        expect(deployDefinitions('x.yaml', text).map((d) => d.service)).toEqual([`${SVC}-agents`]);
    });
});
