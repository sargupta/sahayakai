/**
 * Class gate: every refusal, blocker and wait code the SamparkAI console can receive has its
 * own words, and those words exist in all ten locale files.
 *
 * WHAT HAPPENED (review finding #4, 2026-11-15)
 * f67bfb09f and 847fa7812 added the Riya refusals PAGING_REQUIRED and
 * ELEVENLABS_REQUEST_TO_TALK_UNVERIFIED. The Riya call panel got words for them; the callback
 * dialog's refusalLine() did not, and its `default: return code` showed staff the bare
 * identifier, in every language. Six older codes had the same gap there, the class-wide batch
 * showed the server's English blocker text through t(b.message), and PROVIDER_UNAVAILABLE
 * showed the server's English message.
 *
 * WHAT THIS GATE CATCHES
 * The class, not the two codes. All the maps live in src/components/sampark/refusal-labels.ts
 * (plus blockReasonLabel in labels.ts for GATE_BLOCKED). For each map this test reads the full
 * code list from the server source, the place a new code is added:
 *   RiyaRefusal, RiyaBlocker (server/sampark/conversation.ts), CallbackRefusal
 *   (server/sampark/callbacks.ts), BatchBlocker and every waiting / pause code the batch
 *   service sets (server/sampark/batch-calls.ts), BatchExclusionReason
 *   (lib/sampark/batch/types.ts), BlockReason (types/sampark.ts).
 * Every code must get its own label (not the map's generic fallback, never the code), built
 * from t() keys that exist in every src/locales/*.json. The union-typed maps also end in a
 * `never` check, so a missing case fails tsc before this test runs.
 * Finally, no other Sampark UI file may grow its own refusal switch: a `case` on a refusal
 * code outside refusal-labels.ts fails here, so a new screen reuses these maps.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { blockReasonLabel } from '@/components/sampark/labels';
import {
    batchBlockerLabel,
    batchExclusionLabel,
    batchPauseLabel,
    batchWaitingLabel,
    callbackRefusalLabel,
    refusalText,
    riyaBlockerLabel,
    type BatchBlockerCode,
    type CallbackRefusalCode,
    type RiyaBlockerCode,
    type RiyaRefusalView,
} from '@/components/sampark/refusal-labels';
import type { BatchExclusionReason } from '@/lib/sampark/batch/types';
import type { BlockReason } from '@/types/sampark';

const APP = path.resolve(__dirname, '..', '..', '..');
const SRC = path.join(APP, 'src');

function parse(rel: string): ts.SourceFile {
    return ts.createSourceFile(rel, fs.readFileSync(path.join(SRC, rel), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
    visit(node);
    node.forEachChild((c) => walk(c, visit));
}

/**
 * The codes of a union type alias: string-literal members (`'A' | 'B'`) and the literal `code`
 * of object members (`{ code: 'A' } | { code: 'B'; x: … }`). Members that name another type
 * are returned in `refs` so the caller must account for them.
 */
function unionCodes(rel: string, typeName: string): { codes: string[]; refs: string[] } {
    const sf = parse(rel);
    let alias: ts.TypeAliasDeclaration | undefined;
    walk(sf, (n) => {
        if (ts.isTypeAliasDeclaration(n) && n.name.text === typeName) alias = n;
    });
    if (!alias) throw new Error(`type ${typeName} not found in src/${rel}`);
    const codes: string[] = [];
    const refs: string[] = [];
    const members = ts.isUnionTypeNode(alias.type) ? alias.type.types : [alias.type];
    for (const m of members) {
        if (ts.isLiteralTypeNode(m) && ts.isStringLiteral(m.literal)) codes.push(m.literal.text);
        else if (ts.isTypeLiteralNode(m)) {
            const code = m.members.find((p): p is ts.PropertySignature => ts.isPropertySignature(p) && p.name.getText(sf) === 'code');
            if (!code?.type || !ts.isLiteralTypeNode(code.type) || !ts.isStringLiteral(code.type.literal)) {
                throw new Error(`${typeName}: member without a literal code: ${m.getText(sf)}`);
            }
            codes.push(code.type.literal.text);
        } else if (ts.isTypeReferenceNode(m)) refs.push(m.typeName.getText(sf));
        else throw new Error(`${typeName}: unexpected member ${m.getText(sf)}`);
    }
    return { codes, refs };
}

/** String literals the batch service stores as a waiting or pause reason. */
function batchReasonCodes(kind: 'waiting' | 'pause'): string[] {
    const sf = parse('server/sampark/batch-calls.ts');
    const fn = kind === 'waiting' ? 'setWaiting' : 'pauseFor';
    const field = kind === 'waiting' ? 'waitingReason' : 'pauseReason';
    const out = new Set<string>();
    walk(sf, (n) => {
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === fn) {
            const arg = n.arguments[2];
            if (arg && ts.isStringLiteral(arg)) out.add(arg.text);
        }
        if (ts.isPropertyAssignment(n) && n.name.getText(sf) === field && ts.isStringLiteral(n.initializer)) out.add(n.initializer.text);
        // Riya refusals that make a batch wait rather than fail (setWaiting(deps, c, waits.code)).
        if (kind === 'waiting' && ts.isVariableDeclaration(n) && n.name.getText(sf) === 'WAITING_REFUSALS' && n.initializer) {
            walk(n.initializer, (x) => {
                if (ts.isStringLiteral(x) && ts.isArrayLiteralExpression(x.parent)) out.add(x.text);
            });
        }
    });
    return [...out].sort();
}

const LOCALES_DIR = path.join(SRC, 'locales');
const LOCALES = fs
    .readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ name: f, dict: JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, f), 'utf8')) as Record<string, string> }));

/** A recording t(): the label must be exactly one translated key (placeholders filled by fmt). */
const used = new Set<string>();
const t = (key: string): string => {
    used.add(key);
    return `⟦${key}⟧`;
};
const WHOLE_KEY = /^⟦[^⟦⟧]+⟧$/;

function check(mapName: string, codes: readonly string[], label: (code: string) => string | null): string[] {
    const problems: string[] = [];
    const missingFrom = (key: string) => LOCALES.filter((l) => !(key in l.dict)).map((l) => l.name);
    // The generic line for a code from a newer server is user-visible too.
    used.clear();
    const fallback = label('__NOT_A_REAL_CODE__');
    for (const key of used) {
        const missing = missingFrom(key);
        if (missing.length) problems.push(`${mapName} fallback key ${JSON.stringify(key)} is missing from ${missing.join(', ')}`);
    }
    for (const code of codes) {
        used.clear();
        const text = label(code);
        if (text === null || !WHOLE_KEY.test(text)) {
            problems.push(`${mapName}(${code}) is not one translated label: ${JSON.stringify(text)}`);
            continue;
        }
        if (text === fallback) problems.push(`${mapName}(${code}) has no label of its own (it falls through to the generic line)`);
        for (const key of used) {
            const missing = missingFrom(key);
            if (missing.length) problems.push(`${mapName}(${code}) key ${JSON.stringify(key)} is missing from ${missing.join(', ')}`);
        }
    }
    return problems;
}

const riya = unionCodes('server/sampark/conversation.ts', 'RiyaRefusal');
const riyaBlockers = unionCodes('server/sampark/conversation.ts', 'RiyaBlocker');
const callback = unionCodes('server/sampark/callbacks.ts', 'CallbackRefusal');
const batchBlockers = unionCodes('server/sampark/batch-calls.ts', 'BatchBlocker');
const exclusions = unionCodes('lib/sampark/batch/types.ts', 'BatchExclusionReason');
const blockReasons = unionCodes('types/sampark.ts', 'BlockReason');

describe('every Sampark refusal code has words in every locale', () => {
    it('reads ten locale files and a non-trivial code list from each union', () => {
        expect(LOCALES).toHaveLength(10);
        expect(riya.codes).toEqual(expect.arrayContaining(['PAGING_REQUIRED', 'ELEVENLABS_REQUEST_TO_TALK_UNVERIFIED', 'PROVIDER_UNAVAILABLE']));
        expect(riya.refs).toEqual([]);
        // CallbackRefusal is RiyaRefusal plus its own codes; any other member type must be added here.
        expect(callback.refs).toEqual(['RiyaRefusal']);
        expect(callback.codes).toEqual(expect.arrayContaining(['TOO_SOON', 'TOO_FAR', 'CALLBACKS_PRACTICE_ONLY']));
        for (const u of [riyaBlockers, batchBlockers, exclusions, blockReasons]) {
            expect(u.refs).toEqual([]);
            expect(u.codes.length).toBeGreaterThan(3);
        }
        expect(batchReasonCodes('waiting')).toEqual(expect.arrayContaining(['OUTSIDE_CALLING_HOURS', 'SCHOOL_PAUSED', 'CONCURRENCY_FULL', 'PROVIDER_RATE_LIMITED']));
        expect(batchReasonCodes('pause')).toEqual(expect.arrayContaining(['PAUSED_BY_STAFF', 'PROVIDER_CHANGED']));
    });

    it('RiyaRefusal → refusalText (Riya panel, class-wide outreach)', () => {
        const label = (code: string) =>
            refusalText(t, {
                code,
                reason: 'no_consent',
                blocker: 'RIYA_DISABLED',
                message: 'English text from the server',
                problems: [],
                nextAllowedAt: '2026-11-16T04:30:00.000Z',
                language: 'Bengali',
            } as unknown as RiyaRefusalView);
        expect(check('refusalText', riya.codes, label)).toEqual([]);
    });

    it('RiyaBlocker → riyaBlockerLabel (PROVIDER_UNAVAILABLE, availability line)', () => {
        expect(check('riyaBlockerLabel', riyaBlockers.codes, (c) => riyaBlockerLabel(t, c as RiyaBlockerCode))).toEqual([]);
    });

    it('CallbackRefusal → callbackRefusalLabel (callback dialogs)', () => {
        const codes = [...new Set([...callback.codes, ...riya.codes])];
        expect(check('callbackRefusalLabel', codes, (c) => callbackRefusalLabel(t, c as CallbackRefusalCode))).toEqual([]);
    });

    it('BatchBlocker → batchBlockerLabel (class-wide preview)', () => {
        expect(check('batchBlockerLabel', batchBlockers.codes, (c) => batchBlockerLabel(t, c as BatchBlockerCode))).toEqual([]);
    });

    it('BatchExclusionReason → batchExclusionLabel', () => {
        expect(check('batchExclusionLabel', exclusions.codes, (c) => batchExclusionLabel(t, c as BatchExclusionReason))).toEqual([]);
    });

    it('every waiting and pause code the batch service sets → batchWaitingLabel / batchPauseLabel', () => {
        expect(check('batchWaitingLabel', batchReasonCodes('waiting'), (c) => batchWaitingLabel(t, c))).toEqual([]);
        expect(check('batchPauseLabel', batchReasonCodes('pause'), (c) => batchPauseLabel(t, c))).toEqual([]);
    });

    it('BlockReason → blockReasonLabel (GATE_BLOCKED)', () => {
        expect(check('blockReasonLabel', blockReasons.codes, (c) => blockReasonLabel(t, c as BlockReason))).toEqual([]);
    });

    it('no other Sampark UI file keeps its own switch over refusal codes', () => {
        const refusalCodes = new Set([...riya.codes, ...callback.codes, ...batchBlockers.codes]);
        const allowed = new Set(['components/sampark/refusal-labels.ts']);
        const offenders: string[] = [];
        const scan = (dir: string) => {
            for (const e of fs.readdirSync(path.join(SRC, dir), { withFileTypes: true })) {
                // Forward slashes on every OS, so the allow-list matches on Windows too.
                const rel = path.join(dir, e.name).split(path.sep).join('/');
                if (e.isDirectory()) scan(rel);
                else if (/\.tsx?$/.test(e.name) && !allowed.has(rel)) {
                    const src = fs.readFileSync(path.join(SRC, rel), 'utf8');
                    for (const m of src.matchAll(/\bcase\s+["']([A-Z][A-Z0-9_]+)["']\s*:/g)) {
                        if (refusalCodes.has(m[1])) offenders.push(`${rel}: case "${m[1]}"`);
                    }
                }
            }
        };
        scan('components/sampark');
        scan('app/sampark');
        expect(offenders).toEqual([]);
    });
});
