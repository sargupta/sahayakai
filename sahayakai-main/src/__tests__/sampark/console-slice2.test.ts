/**
 * @jest-environment node
 *
 * Adopt-on-touch gates for the slice-2 console (CLAUDE.md standing laws):
 *   - every interface string goes through t() and its key exists in ALL TEN locale files
 *     (no inline multi-language dictionary, no English-only literals);
 *   - no raw Tailwind palette class or raw hex colour (tokens only, docs/DESIGN_TOKENS.md);
 *   - nothing has a fixed width that would force horizontal scroll at 375 px;
 *   - the labels cover every rule, threshold, role and status the API can return;
 *   - the approver's evidence is shown to the approver only, never fed to a script.
 */
import fs from 'node:fs';
import path from 'node:path';

import { DEFAULT_THRESHOLDS } from '@/lib/sampark/rules/thresholds';
import { RULE_IDS } from '@/lib/sampark/rules/types';
import {
    ASSIGNABLE_ROLE_IDS,
    pageReasonLabel,
    proposalStatusLabel,
    purposeLabel,
    roleLabel,
    ruleDescription,
    thresholdLabel,
    type ProposalStatusLabelId,
} from '@/components/sampark/labels';

const ROOT = path.resolve(__dirname, '../../..');
const FILES = [
    'src/components/sampark/proposal-card.tsx',
    'src/components/sampark/rules-section.tsx',
    'src/components/sampark/backtest-section.tsx',
    'src/components/sampark/roles-section.tsx',
    'src/app/sampark/[orgId]/approvals/page.tsx',
    'src/app/sampark/[orgId]/rules/page.tsx',
];
const LOCALES = fs.readdirSync(path.join(ROOT, 'src/locales')).filter((f) => f.endsWith('.json'));
const locale = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/locales', f), 'utf8')) as Record<string, string>;
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Every t("…") literal in a source string (double-quoted, apostrophes allowed). */
function tKeys(code: string): string[] {
    return [...code.matchAll(/\bt\(\s*"((?:[^"\\\n]|\\.)+)"\s*\)/g)].map((m) => m[1].replace(/\\"/g, '"'));
}

const t = (key: string) => key; // identity translator: a label that returns its raw id is a missing label

describe('slice-2 console: i18n and tokens (adopt-on-touch)', () => {
    it('there are ten locale files', () => {
        expect(LOCALES).toHaveLength(10);
    });

    it('every t() key used by the new screens and labels exists in all ten locale files', () => {
        const sources = [...FILES, 'src/components/sampark/labels.ts', 'src/components/sampark/org-shell.tsx'];
        const keys = new Set(sources.flatMap((f) => tKeys(read(f))));
        expect(keys.size).toBeGreaterThan(100);
        const missing: string[] = [];
        for (const file of LOCALES) {
            const dict = locale(file);
            for (const key of keys) if (!(key in dict)) missing.push(`${file}: ${key}`);
        }
        expect(missing).toEqual([]);
    });

    it('Hindi and Bengali carry real translations for the new keys, not the English fallback', () => {
        const keys = new Set(FILES.flatMap((f) => tKeys(read(f))).filter((k) => /[a-z]{4}/.test(k) && k.length > 20));
        for (const file of ['hindi.json', 'bengali.json']) {
            const dict = locale(file);
            const untranslated = [...keys].filter((k) => dict[k] === k);
            expect(untranslated).toEqual([]);
        }
    });

    it('no screen holds an inline multi-language dictionary', () => {
        for (const f of FILES) {
            const code = read(f);
            expect(/Record<\s*(Parent)?Language\b/.test(code)).toBe(false);
            expect(/\b(hindi|bengali|nepali)\s*:\s*['"`]/i.test(code)).toBe(false);
        }
    });

    it('uses design tokens only: no raw palette class, no raw hex', () => {
        const PALETTE = /\b(?:bg|text|border|ring|from|to|via|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;
        for (const f of FILES) {
            const code = read(f);
            expect({ f, palette: PALETTE.exec(code)?.[0] ?? null }).toEqual({ f, palette: null });
            expect({ f, hex: /#[0-9a-fA-F]{3,8}\b/.exec(code)?.[0] ?? null }).toEqual({ f, hex: null });
        }
    });

    it('has no unprefixed fixed width that would scroll sideways at 375 px', () => {
        for (const f of FILES) {
            const classes = [...read(f).matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].flatMap((m) => (m[1] ?? m[2] ?? '').split(/\s+/));
            const fixed = classes.filter((c) => /^(?:min-)?w-(?:\d{2,}|\[)/.test(c) && !/^(?:min-)?w-(?:full|screen)$/.test(c));
            expect({ f, fixed }).toEqual({ f, fixed: [] });
        }
    });

    it('tables sit in a horizontally scrollable wrapper', () => {
        for (const f of FILES) {
            const code = read(f);
            if (code.includes('<table')) expect(code).toMatch(/overflow-x-auto/);
        }
    });

    it('touch targets: every action button is at least 44 px tall on the approval card', () => {
        const code = read('src/components/sampark/proposal-card.tsx');
        const buttons = code.split('<Button').slice(1).map((part) => part.split('</Button>')[0]);
        expect(buttons.length).toBeGreaterThanOrEqual(3);
        for (const b of buttons) expect(b).toMatch(/min-h-11/);
    });
});

describe('slice-2 console: labels cover everything the API can send', () => {
    it('every rule has a label and a description in plain words', () => {
        for (const id of RULE_IDS) {
            expect(purposeLabel(t, id)).not.toBe(id);
            expect(ruleDescription(t, id).length).toBeGreaterThan(40);
        }
    });
    it('every threshold key of every rule has a label', () => {
        for (const id of RULE_IDS) {
            for (const key of Object.keys(DEFAULT_THRESHOLDS[id])) expect({ id, key, label: thresholdLabel(t, key) }).not.toEqual({ id, key, label: key });
        }
    });
    it('every role, proposal status and page reason has a label', () => {
        for (const r of ASSIGNABLE_ROLE_IDS) expect(roleLabel(t, r)).not.toBe(r);
        const statuses: ProposalStatusLabelId[] = ['pending', 'approved', 'dismissed', 'handled_by_person', 'needs_attention', 'expired'];
        for (const s of statuses) expect(proposalStatusLabel(t, s)).not.toBe(s);
        expect(pageReasonLabel(t, 'parent_said_did_not_know')).toMatch(/pressed 2/);
        expect(pageReasonLabel(t, 'no_answer')).toMatch(/Nobody answered/);
    });
});

describe('slice-2 console: the evidence is for the approver, never for the parent', () => {
    it('the proposal card renders evidence in its own section and the script preview from the previews only', () => {
        const code = read('src/components/sampark/proposal-card.tsx');
        expect(code).toMatch(/Why \(for you only, never said to the parent\)/);
        // the parent-facing block reads only `preview.clips`; evidence is never interpolated into it
        const parentBlock = code.slice(code.indexOf('What the parent will hear'), code.indexOf('pending ?'));
        expect(parentBlock).not.toMatch(/evidence/);
    });
});
