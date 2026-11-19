/**
 * Virtual Field Trip has one voice entry: VIDYA (the floating orb).
 * A second, in-form mic ("Speak your trip idea...") was removed on request
 * (2026-11-18) because two voice controls on one page confuse teachers.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const page = readFileSync(join(__dirname, '../../../app/virtual-field-trip/page.tsx'), 'utf8');

describe('Virtual Field Trip voice entry', () => {
    it('the page renders no in-form MicrophoneInput (VIDYA is the voice entry)', () => {
        expect(page).not.toMatch(/<MicrophoneInput\b/);
        expect(page).not.toMatch(/from ["']@\/components\/microphone-input["']/);
    });
});
