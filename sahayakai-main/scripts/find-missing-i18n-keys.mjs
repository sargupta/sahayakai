#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');
const DICT_PATH = path.resolve(process.cwd(), 'src/context/language-context.tsx');

const TFN_RE = /\bt\(\s*(["'])([^"'\n]{1,200})\1\s*\)/g;
const usedKeys = new Set();
const usedKeyLocations = new Map();

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.next') continue;
            walk(p);
        } else if (/\.(tsx|jsx|ts|js)$/.test(entry.name)) {
            const src = fs.readFileSync(p, 'utf8');
            let m;
            while ((m = TFN_RE.exec(src)) !== null) {
                const key = m[2];
                usedKeys.add(key);
                if (!usedKeyLocations.has(key)) usedKeyLocations.set(key, []);
                const lineNo = src.slice(0, m.index).split('\n').length;
                usedKeyLocations.get(key).push(path.relative(process.cwd(), p) + ':' + lineNo);
            }
        }
    }
}
walk(ROOT);

const dictSrc = fs.readFileSync(DICT_PATH, 'utf8');
const dictKeys = new Set();
const KEY_RE = /^    "([^"]+)":\s*\{$/gm;
let km;
while ((km = KEY_RE.exec(dictSrc)) !== null) dictKeys.add(km[1]);

const missing = [...usedKeys].filter(k => !dictKeys.has(k)).sort();
const orphan = [...dictKeys].filter(k => !usedKeys.has(k)).sort();

console.log('Used in code: ' + usedKeys.size);
console.log('In dictionary: ' + dictKeys.size);
console.log('MISSING (used but not defined): ' + missing.length);
console.log('ORPHAN (defined but never used): ' + orphan.length);
console.log('');
console.log('## Missing keys');
for (const k of missing) {
    console.log('- ' + JSON.stringify(k) + ' @ ' + usedKeyLocations.get(k).slice(0, 2).join(', '));
}

fs.writeFileSync('scripts/i18n-missing-keys.json', JSON.stringify(missing, null, 2));
console.error('\nWrote scripts/i18n-missing-keys.json (' + missing.length + ' keys)');
