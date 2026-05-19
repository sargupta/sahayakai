/**
 * @jest-environment node
 */

import {
    getRegionalAnchors,
    renderRegionalContextBlock,
    SEEDED_STATE_COUNT,
    _getAnchorMapForTesting,
} from '../../lib/regional-examples';

describe('regional-examples — getRegionalAnchors', () => {
    it('resolves all seeded states case-insensitively', () => {
        const map = _getAnchorMapForTesting();
        for (const key of Object.keys(map)) {
            // exact lowercase
            expect(getRegionalAnchors(key).state).toBe(map[key].state);
            // mixed case
            const titled = key
                .split(' ')
                .map(w => w[0].toUpperCase() + w.slice(1))
                .join(' ');
            expect(getRegionalAnchors(titled).state).toBe(map[key].state);
        }
    });

    it('resolves common state aliases', () => {
        expect(getRegionalAnchors('TN').state).toBe('Tamil Nadu');
        expect(getRegionalAnchors('UP').state).toBe('Uttar Pradesh');
        expect(getRegionalAnchors('WB').state).toBe('West Bengal');
        expect(getRegionalAnchors('J&K').state).toBe('Jammu and Kashmir');
        expect(getRegionalAnchors('orissa').state).toBe('Odisha');
    });

    it('falls back to generic India for unknown/empty state', () => {
        expect(getRegionalAnchors('').state).toBe('India (generic)');
        expect(getRegionalAnchors(null).state).toBe('India (generic)');
        expect(getRegionalAnchors(undefined).state).toBe('India (generic)');
        expect(getRegionalAnchors('Atlantis').state).toBe('India (generic)');
    });

    it('every seeded state has all required anchor lists non-empty', () => {
        const map = _getAnchorMapForTesting();
        for (const [key, anchors] of Object.entries(map)) {
            expect(anchors.crops.length).toBeGreaterThan(0);
            expect(anchors.fruits.length).toBeGreaterThan(0);
            expect(anchors.trees.length).toBeGreaterThan(0);
            expect(anchors.festivals.length).toBeGreaterThan(0);
            expect(anchors.geography.length).toBeGreaterThan(0);
            expect(anchors.animals.length).toBeGreaterThan(0);
            expect(anchors.markets.length).toBeGreaterThan(0);
            expect(anchors.professions.length).toBeGreaterThan(0);
            expect(anchors.foods.length).toBeGreaterThan(0);
            expect(anchors.languages.length).toBeGreaterThan(0);
            expect(anchors.displayName.length).toBeGreaterThan(0);
            expect(anchors.state.length).toBeGreaterThan(0);
            // Sanity: key matches normalised state name
            expect(key.toLowerCase()).toBe(key);
        }
    });

    it('seeds at least 11 of the prompt-required states', () => {
        // The fix mandate covers KA, WB, TN, KL, PB, MH, GJ, UP+BR, AP/TG, OR, RJ
        expect(SEEDED_STATE_COUNT).toBeGreaterThanOrEqual(11);
    });
});

describe('regional-examples — renderRegionalContextBlock', () => {
    it('renders state-specific block when state is known', () => {
        const block = renderRegionalContextBlock('Karnataka', 'Science');
        expect(block).toContain('Karnataka');
        expect(block).toContain('coconut');
        expect(block).toContain('Western Ghats');
        expect(block).toContain('Mysore Dasara');
        expect(block).toContain('this lesson is on Science');
        // Must explicitly forbid Western defaults
        expect(block).toMatch(/Newton'?s apple|snowman|hamburger/i);
    });

    it('renders generic India block when state is missing', () => {
        const block = renderRegionalContextBlock(undefined);
        expect(block).toContain('Indian context');
        // Generic fallback should warn the model not to use district phrasing
        expect(block).toMatch(/State not specified/);
    });

    it('contains rupee mandate for money problems', () => {
        const block = renderRegionalContextBlock('Tamil Nadu');
        expect(block).toContain('₹');
        expect(block).toMatch(/dollars/i); // appears in the "Never X" rule
    });

    it('mandates kg / metres over imperial units', () => {
        const block = renderRegionalContextBlock('Punjab');
        expect(block).toMatch(/kilograms?/);
        expect(block).toMatch(/pounds?/);
    });
});
