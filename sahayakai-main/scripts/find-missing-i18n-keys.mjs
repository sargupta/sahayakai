#!/usr/bin/env node
/**
 * Gate 9 measurement: i18n keys the UI asks for that some locale cannot answer.
 *
 * The runtime (src/context/language-context.tsx) returns `dict[key] ?? key`, so a key missing
 * from one locale file shows English to everyone using that language. A key therefore counts as
 * MISSING unless it is present in EVERY src/locales/<language>.json (the ten Indic locales;
 * English has no file, because the key is the English text).
 *
 * WHAT COUNTS AS A USED KEY
 *   1. Literal calls, read with the TypeScript parser rather than a regex: t("…"), t('…') and
 *      t(`…`), whatever apostrophes or escapes the text holds and whatever arguments follow. The
 *      translator is `t` or any name bound from it (`const { t: translate } = useLanguage()`).
 *      The literal branches of t(cond ? "A" : "B") and the literal side of t(x ?? "A") or
 *      t(x || "A") count as literal calls too.
 *   2. Dynamic calls: any other argument, such as t(REFUSAL_TEXT[why]), t(r.label) or
 *      t(subject). A dynamic call does not say which keys it can receive, so each one must be
 *      declared in scripts/i18n-dynamic-keys.json. The declaration names the code constants its
 *      keys come from; this script reads those constants from source, and every string in them
 *      is a used key, checked against every locale exactly like a literal.
 *
 * WHY A REGISTRY RATHER THAN RESOLVING MAPS AUTOMATICALLY
 *   Automatic resolution can follow t(MAP[x]) when MAP is a literal object in reach. Most dynamic
 *   calls in this app are not that shape: t(r.label) inside BATCH_REASONS.map(...), a prop handed
 *   down from a parent (t(title)), a hook's return value (t(live.error)), or a runtime value whose
 *   vocabulary is a constant elsewhere (t(paper.subject) draws on SUBJECTS). A resolver that handles
 *   some shapes passes the rest in silence, which is the blindness this gate exists to remove.
 *   The registry fails closed: an undeclared dynamic call fails the gate, and so does a declaration
 *   that no longer matches the code. Each declaration says, in review, where the keys come from.
 *
 * OUTPUT (scripts/ci/check-i18n-ratchet.mjs parses the three counts)
 *   MISSING (used but not defined): N      keys absent from at least one locale
 *   UNREGISTERED DYNAMIC t() CALLS: N      dynamic calls with no registry entry
 *   REGISTRY ERRORS: N                     registry entries that do not match the code
 *
 * Flags:
 *   --no-write        report only; leave scripts/i18n-missing-keys.json untouched (Gate 9 uses it)
 *   --json            print the full report as JSON instead of text
 *   --app-root <dir>  resolve src/, src/locales/ and scripts/ against <dir> (default: cwd)
 *
 * Class gate for this script: src/__tests__/scripts/i18n-key-extractor.test.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let ts;
try {
    ts = require('typescript');
} catch {
    console.error('::error::Gate 9 — the i18n key scanner needs the `typescript` package. Run `npm ci` in sahayakai-main first.');
    process.exit(2);
}

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};

const APP_ROOT = path.resolve(option('--app-root') ?? process.cwd());
const SRC_DIR = path.join(APP_ROOT, 'src');
const LOCALES_DIR = path.join(SRC_DIR, 'locales');
const REGISTRY_PATH = path.join(APP_ROOT, 'scripts', 'i18n-dynamic-keys.json');
const SNAPSHOT_PATH = path.join(APP_ROOT, 'scripts', 'i18n-missing-keys.json');

const rel = (p) => path.relative(APP_ROOT, p).split(path.sep).join('/');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();

function parseFile(abs) {
    const kind = /\.tsx$/.test(abs) ? ts.ScriptKind.TSX : /\.jsx$/.test(abs) ? ts.ScriptKind.JSX : /\.js$/.test(abs) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
    return ts.createSourceFile(abs, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true, kind);
}

function lineOf(sf, node) {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

/** Strip wrappers that do not change the value: (x), x as T, x!, x satisfies T, <T>x. */
function unwrap(node) {
    while (
        ts.isParenthesizedExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isNonNullExpression(node) ||
        (ts.isSatisfiesExpression && ts.isSatisfiesExpression(node)) ||
        ts.isTypeAssertionExpression(node)
    ) {
        node = node.expression;
    }
    return node;
}

const isStringLike = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);

/**
 * Split a t() argument into literal keys and dynamic leaves: the branches of `a ? b : c` and both
 * sides of `a ?? b` / `a || b` are what t() can receive; the condition is not.
 */
function leaves(node, out) {
    node = unwrap(node);
    if (isStringLike(node)) out.literals.push(node.text);
    else if (ts.isConditionalExpression(node)) {
        leaves(node.whenTrue, out);
        leaves(node.whenFalse, out);
    } else if (
        ts.isBinaryExpression(node) &&
        (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
    ) {
        leaves(node.left, out);
        leaves(node.right, out);
    } else out.dynamic.push(node);
    return out;
}

// ── 1. Scan src/ for t() calls ────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', '.next', '__tests__', '__mocks__']);
const SOURCE_FILE = /\.(tsx?|jsx?)$/;
const NOT_APP_CODE = /\.(test|spec|stories)\.[jt]sx?$|\.d\.ts$/;

function listSources(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) listSources(p, out);
        } else if (SOURCE_FILE.test(entry.name) && !NOT_APP_CODE.test(entry.name)) out.push(p);
    }
    return out;
}

/** key → first few call sites */
const usedKeys = new Map();
function useKey(key, where) {
    if (!usedKeys.has(key)) usedKeys.set(key, []);
    const sites = usedKeys.get(key);
    if (sites.length < 3) sites.push(where);
}

/** { file, expr, line } for every dynamic leaf of every t() call */
const dynamicSites = [];

for (const abs of listSources(SRC_DIR)) {
    const text = fs.readFileSync(abs, 'utf8');
    if (!/\bt\b|\bt:/.test(text)) continue;
    const sf = parseFile(abs);
    const file = rel(abs);

    const translators = new Set(['t']);
    const findAliases = (node) => {
        if (ts.isObjectBindingPattern(node)) {
            for (const el of node.elements) {
                if (el.propertyName && ts.isIdentifier(el.propertyName) && el.propertyName.text === 't' && ts.isIdentifier(el.name)) {
                    translators.add(el.name.text);
                }
            }
        }
        node.forEachChild(findAliases);
    };
    findAliases(sf);

    const visit = (node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && translators.has(node.expression.text) && node.arguments.length > 0) {
            const { literals, dynamic } = leaves(node.arguments[0], { literals: [], dynamic: [] });
            const where = `${file}:${lineOf(sf, node)}`;
            for (const key of literals) useKey(key, where);
            for (const d of dynamic) dynamicSites.push({ file, expr: normalize(d.getText(sf)), line: lineOf(sf, d) });
        }
        node.forEachChild(visit);
    };
    visit(sf);
}

// ── 2. Resolve the registry's key sources ─────────────────────────────────────

const registryErrors = [];
let registry = { sources: {}, sites: {} };
if (fs.existsSync(REGISTRY_PATH)) {
    try {
        registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    } catch (err) {
        registryErrors.push(`${rel(REGISTRY_PATH)} is not valid JSON: ${err.message}`);
    }
}
const sources = registry.sources ?? {};
const sites = registry.sites ?? {};

const propName = (name) => (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : null);

/**
 * Strings a constant's initializer can hand to t(): string elements of arrays, string values of
 * object properties (only under `props` when given), both branches of conditionals. Property
 * names, call arguments, functions and templates with substitutions are not values.
 */
function collectValues(node, props, prop, out) {
    node = unwrap(node);
    if (isStringLike(node)) {
        if (!props || props.includes(prop)) out.push(node.text);
    } else if (ts.isArrayLiteralExpression(node)) {
        for (const el of node.elements) collectValues(el, props, prop, out);
    } else if (ts.isObjectLiteralExpression(node)) {
        for (const p of node.properties) {
            if (ts.isPropertyAssignment(p)) collectValues(p.initializer, props, propName(p.name), out);
        }
    } else if (ts.isConditionalExpression(node)) {
        collectValues(node.whenTrue, props, prop, out);
        collectValues(node.whenFalse, props, prop, out);
    } else if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
        collectValues(node.left, props, prop, out);
        collectValues(node.right, props, prop, out);
    } else if (ts.isCallExpression(node)) {
        // [..].join("|"), [..].map(...), Object.freeze({..}): the receiver or the frozen value.
        const callee = node.expression;
        if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'Object' && node.arguments[0]) {
            collectValues(node.arguments[0], props, prop, out);
        } else if (ts.isPropertyAccessExpression(callee)) collectValues(callee.expression, props, prop, out);
    } else if (ts.isElementAccessExpression(node) || ts.isPropertyAccessExpression(node)) {
        // ({ DAILY: [..], WEEKLY: [..] })[freq]: every value the indexed literal holds.
        const target = unwrap(node.expression);
        if (ts.isObjectLiteralExpression(target) || ts.isArrayLiteralExpression(target)) collectValues(target, props, prop, out);
    }
    return out;
}

/** String-literal members of a union type: the alias itself, or the named properties of an interface or type literal. */
function collectTypeLiterals(sf, typeName, props) {
    let decl = null;
    const find = (node) => {
        if ((ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) && node.name.text === typeName) decl = node;
        node.forEachChild(find);
    };
    find(sf);
    if (!decl) return null;
    const out = [];
    const literals = (type) => {
        if (!type) return;
        if (ts.isParenthesizedTypeNode(type)) literals(type.type);
        else if (ts.isUnionTypeNode(type)) type.types.forEach(literals);
        else if (ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal)) out.push(type.literal.text);
    };
    if (!props) {
        if (ts.isTypeAliasDeclaration(decl)) literals(decl.type);
        return out;
    }
    const visit = (node) => {
        if (ts.isPropertySignature(node) && node.name && props.includes(propName(node.name))) literals(node.type);
        node.forEachChild(visit);
    };
    visit(decl);
    return out;
}

/** String literals passed as argument `index` to every call of `fn` in the file. */
function collectCallArgs(sf, fn, index, out) {
    const visit = (node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === fn) {
            const arg = node.arguments[index];
            if (arg) out.push(...leaves(arg, { literals: [], dynamic: [] }).literals);
        }
        node.forEachChild(visit);
    };
    visit(sf);
    return out;
}

/** Literal return values of a function (switch/if bodies included; nested functions are not). */
function collectReturns(fn, out) {
    if (fn.body && !ts.isBlock(fn.body)) {
        out.push(...leaves(fn.body, { literals: [], dynamic: [] }).literals);
        return out;
    }
    const visit = (node) => {
        if (node !== fn && (ts.isFunctionLike(node) || ts.isClassLike(node))) return;
        if (ts.isReturnStatement(node) && node.expression) out.push(...leaves(node.expression, { literals: [], dynamic: [] }).literals);
        node.forEachChild(visit);
    };
    visit(fn);
    return out;
}

const resolved = new Map(); // source id → keys
function resolveSource(id) {
    if (resolved.has(id)) return resolved.get(id);
    const spec = sources[id];
    let keys = [];
    const fail = (msg) => registryErrors.push(`source "${id}": ${msg}`);
    if (!spec || typeof spec !== 'object') fail('is not defined in "sources"');
    else if (typeof spec.runtime === 'string') {
        if (!spec.runtime.trim()) fail('"runtime" needs a reason');
    } else if (!spec.file || (!spec.name && !spec.calls && !spec.type)) fail('needs "file" and one of "name", "type" or "calls" (or "runtime": "<why the values cannot be listed>")');
    else {
        const abs = path.join(APP_ROOT, spec.file);
        if (!fs.existsSync(abs)) fail(`file ${spec.file} does not exist`);
        else if (spec.type) {
            keys = collectTypeLiterals(parseFile(abs), spec.type, spec.props ?? null);
            if (keys === null) fail(`${spec.file} declares no type or interface "${spec.type}"`);
            else if (keys.length === 0) fail(`no string literal types in "${spec.type}"${spec.props ? ` under ${spec.props.join(', ')}` : ''} (${spec.file})`);
            keys = keys ?? [];
        } else if (spec.calls) {
            keys = collectCallArgs(parseFile(abs), spec.calls, spec.arg ?? 0, []);
            if (keys.length === 0) fail(`no string literal is passed to ${spec.calls}() (argument ${spec.arg ?? 0}) in ${spec.file}`);
        } else {
            const sf = parseFile(abs);
            const decls = [];
            const find = (node) => {
                if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name && ts.isIdentifier(node.name) && node.name.text === spec.name) decls.push(node);
                node.forEachChild(find);
            };
            find(sf);
            if (decls.length === 0) fail(`${spec.file} declares no "${spec.name}"`);
            else if (decls.length > 1) fail(`${spec.file} declares "${spec.name}" ${decls.length} times; rename one`);
            else {
                const d = decls[0];
                const init = ts.isVariableDeclaration(d) ? d.initializer && unwrap(d.initializer) : d;
                if (!init) fail(`"${spec.name}" has no initializer`);
                else if (ts.isFunctionDeclaration(init) || ts.isArrowFunction(init) || ts.isFunctionExpression(init)) keys = collectReturns(init, []);
                else if (spec.take === 'keys') {
                    if (!ts.isObjectLiteralExpression(init)) fail(`"take": "keys" needs an object literal; "${spec.name}" is not one`);
                    else keys = init.properties.map((p) => (p.name ? propName(p.name) : null)).filter((k) => k !== null);
                } else keys = collectValues(init, spec.props ?? null, null, []);
                if (keys.length === 0) fail(`no string keys found in "${spec.name}" (${spec.file})${spec.props ? ` under ${spec.props.join(', ')}` : ''}`);
            }
        }
        if (spec.transform === 'capitalize') keys = keys.map((k) => k.charAt(0).toUpperCase() + k.slice(1));
        else if (spec.transform !== undefined) fail(`unknown transform "${spec.transform}"`);
        // Keys built from a value, e.g. `pillar.${id}.name`: "format": ["pillar.{}.name", …].
        if (spec.format !== undefined) {
            if (!Array.isArray(spec.format) || spec.format.some((f) => typeof f !== 'string' || !f.includes('{}'))) fail('"format" must be a list of strings containing {}');
            else keys = keys.flatMap((v) => spec.format.map((f) => f.split('{}').join(v)));
        }
    }
    keys = [...new Set(keys)];
    resolved.set(id, keys);
    return keys;
}

// ── 3. Match dynamic calls against the registry ───────────────────────────────

/**
 * A registry entry is either a list of source ids (it covers exactly one call) or
 * { sources: [...], count: N } (it covers N calls with the same argument text in that file).
 * The count is pinned so a NEW call that happens to read the same (often generic) expression,
 * say a second `t(f.label)` over a different list, cannot ride on the first call's entry.
 */
const entrySources = (entry) => (Array.isArray(entry) ? entry : entry?.sources);
const entryCount = (entry) => (Array.isArray(entry) ? 1 : entry?.count ?? 1);

const unregistered = [];
const siteCounts = new Map();
for (const s of dynamicSites) {
    const ids = entrySources(sites[s.file]?.[s.expr]);
    if (!Array.isArray(ids) || ids.length === 0) {
        unregistered.push(s);
        continue;
    }
    const k = `${s.file}\u0000${s.expr}`;
    siteCounts.set(k, (siteCounts.get(k) ?? 0) + 1);
    for (const id of ids) for (const key of resolveSource(id)) useKey(key, `${s.file}:${s.line} via ${id}`);
}

const referenced = new Set();
for (const [file, exprs] of Object.entries(sites)) {
    for (const [expr, entry] of Object.entries(exprs)) {
        const ids = entrySources(entry);
        if (!Array.isArray(ids) || ids.length === 0) registryErrors.push(`site ${file} :: ${expr} lists no sources`);
        else ids.forEach((id) => referenced.add(id));
        const actual = siteCounts.get(`${file}\u0000${expr}`) ?? 0;
        if (actual === 0) registryErrors.push(`stale site: ${file} has no dynamic t() call on \`${expr}\` (update or remove the entry)`);
        else if (actual !== entryCount(entry)) registryErrors.push(`site ${file} :: ${expr} covers ${entryCount(entry)} call(s) but the file has ${actual}: check the new call reads the same sources, then set "count": ${actual} (or give it its own entry)`);
    }
}
for (const id of Object.keys(sources)) {
    if (!referenced.has(id)) registryErrors.push(`source "${id}" is not used by any site`);
    else resolveSource(id); // stale-site sources still get their file/name checked
}

// ── 4. Compare against every locale ───────────────────────────────────────────

const locales = fs
    .readdirSync(LOCALES_DIR)
    .filter((n) => n.endsWith('.json'))
    .sort()
    .map((n) => ({ name: n.replace(/\.json$/, ''), dict: JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, n), 'utf8')) }));
const dictUnion = new Set(locales.flatMap((l) => Object.keys(l.dict)));

const missing = [...usedKeys.keys()]
    .map((key) => ({ key, missingIn: locales.filter((l) => !Object.prototype.hasOwnProperty.call(l.dict, key)).map((l) => l.name), at: usedKeys.get(key) }))
    .filter((m) => m.missingIn.length > 0)
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
const orphans = [...dictUnion].filter((k) => !usedKeys.has(k)).sort();
const perLocale = Object.fromEntries(locales.map((l) => [l.name, missing.filter((m) => m.missingIn.includes(l.name)).length]));

const report = {
    usedKeys: usedKeys.size,
    locales: locales.map((l) => l.name),
    dictionaryKeys: dictUnion.size,
    dynamicCalls: dynamicSites.length,
    missing: missing.map(({ key, missingIn, at }) => ({ key, missingIn, at })),
    perLocale,
    unregistered: unregistered.map((s) => ({ file: s.file, line: s.line, expr: s.expr })),
    registryErrors,
    orphans: orphans.length,
};

if (flag('--json')) {
    console.log(JSON.stringify(report, null, 2));
} else {
    console.log('Used in code: ' + report.usedKeys + ' (literal and registered dynamic keys)');
    console.log('Locales: ' + locales.length + ' (' + report.locales.join(', ') + ')');
    console.log('In dictionary (union of locales): ' + report.dictionaryKeys);
    console.log('MISSING (used but not defined): ' + missing.length);
    console.log('UNREGISTERED DYNAMIC t() CALLS: ' + unregistered.length);
    console.log('REGISTRY ERRORS: ' + registryErrors.length);
    console.log('ORPHAN (defined but never used): ' + orphans.length);
    console.log('Missing per locale: ' + Object.entries(perLocale).map(([l, n]) => `${l} ${n}`).join(', '));
    console.log('');
    console.log('## Missing keys');
    for (const m of missing) {
        const where = m.missingIn.length === locales.length ? 'every locale' : m.missingIn.join(', ');
        console.log('- ' + JSON.stringify(m.key) + ' [missing in ' + where + '] @ ' + m.at.slice(0, 2).join(', '));
    }
    if (unregistered.length) {
        console.log('');
        console.log('## Unregistered dynamic t() calls (declare each in scripts/i18n-dynamic-keys.json)');
        for (const s of unregistered) console.log(`- ${s.file}:${s.line}  t(${s.expr})`);
    }
    if (registryErrors.length) {
        console.log('');
        console.log('## Registry errors (scripts/i18n-dynamic-keys.json)');
        for (const e of registryErrors) console.log('- ' + e);
    }
}

// --no-write: report only, leave the committed snapshot untouched (Gate 9 runs this way so a CI
// run never dirties the tree).
if (flag('--no-write')) {
    console.error('\n--no-write: snapshot scripts/i18n-missing-keys.json left untouched (' + missing.length + ' keys found)');
} else {
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(missing.map((m) => m.key), null, 2) + '\n');
    console.error('\nWrote scripts/i18n-missing-keys.json (' + missing.length + ' keys)');
}
