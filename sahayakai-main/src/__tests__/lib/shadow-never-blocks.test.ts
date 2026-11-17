/**
 * Class gate: sidecar "shadow" mode never makes a teacher wait for the sidecar.
 *
 * The bug (production, 17 Nov 2026): every dispatcher's shadow branch did
 * `await Promise.all([runGenkitSafe(...), runSidecarSafe(...)])`, so the answer
 * went back only when BOTH had finished. While the agents service refused every
 * call in milliseconds this cost nothing; once its auth was fixed, a 15 s sidecar
 * made VIDYA's voice-to-text take 25 s and slowed every shadowed tool.
 *
 * Shadow exists to observe the sidecar, not to serve it. In every dispatcher, the
 * shadow branch may start the sidecar but must not await it before returning.
 * Behavioural check for one dispatcher: voice-to-text-dispatch.test.ts
 * ("answers as soon as Genkit does, even if the sidecar never answers").
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(__dirname, '../../lib/sidecar');

/** The body of `if (decision.mode === 'shadow') { … }`, up to its closing brace at the same indent. */
function shadowBranch(source: string): string | null {
    const m = /^([ \t]*)if \(decision\.mode === 'shadow'\) \{\n/m.exec(source);
    if (!m) return null;
    const close = source.indexOf(`\n${m[1]}}\n`, m.index + m[0].length);
    return close < 0 ? null : source.slice(m.index + m[0].length, close);
}

describe('shadow mode never awaits the sidecar', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('-dispatch.ts'));

    it('finds every dispatcher', () => {
        // A gate that scans nothing reports green forever.
        expect(files.length).toBeGreaterThanOrEqual(17);
    });

    it.each(files)('%s', (file) => {
        const branch = shadowBranch(readFileSync(path.join(DIR, file), 'utf8'));
        if (branch === null) return; // no shadow mode in this dispatcher
        expect(branch).not.toMatch(/await\s+Promise\.all\(/);
        expect(branch).not.toMatch(/await\s+runSidecarSafe\(/);
        expect(branch).not.toMatch(/await\s+sidecarShadow\b/);
        // It still runs the sidecar, so shadow keeps observing it.
        expect(branch).toMatch(/runSidecarSafe\(/);
    });

    it('the check itself catches the old pattern', () => {
        const old = "    if (decision.mode === 'shadow') {\n        const [genkit, sidecar] = await Promise.all([\n            runGenkitSafe(input),\n            runSidecarSafe(req),\n        ]);\n        return x;\n    }\n";
        expect(shadowBranch(old)).toMatch(/await\s+Promise\.all\(/);
    });
});
