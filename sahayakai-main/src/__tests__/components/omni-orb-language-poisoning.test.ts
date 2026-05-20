/**
 * NCERT-demo 2026-05-19 regression: source-level guard against the
 * VIDYA language-poisoning bug returning.
 *
 * Rendering `OmniOrb` in isolation drags in Zustand persistence, the
 * Web Audio API, Firebase auth, microphone permissions, and the TTS
 * engine — none of which are realistically test-fixtureable in Jest
 * without a `jsdom` shim per dependency. The cost of a full mount test
 * outweighs the value when the only thing we need to pin is a single
 * forbidden line.
 *
 * Instead, we read the source and assert the line is gone. This is
 * fragile to refactors but is exactly the right kind of fragile — if
 * someone adds `updateTeacherProfile({ preferredLanguage: ... })` back
 * inside `executeAction`, the demo bug returns and this test fails.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('OmniOrb: language-poisoning guard (NCERT-demo regression)', () => {
    const source = readFileSync(
        resolve(__dirname, '../../components/omni-orb.tsx'),
        'utf8',
    );

    it('does NOT write VIDYA action.params.language into the persistent teacher profile', () => {
        // The bug line was:
        //   updateTeacherProfile({ preferredLanguage: action.params.language });
        // Anything matching that shape is a regression.
        const offending = /updateTeacherProfile\(\s*\{\s*preferredLanguage\s*:\s*action\.params\.language/;
        expect(source).not.toMatch(offending);
    });

    it('does NOT add action.params.language to the syncProfilePatch payload', () => {
        // Defensive: even if updateTeacherProfile is renamed, no path
        // should plumb action.params.language into the Firestore patch.
        const offending = /profilePatch\.preferredLanguage\s*=\s*action\.params\.language/;
        expect(source).not.toMatch(offending);
    });

    it('still learns gradeLevel and subject from action params (those are safe)', () => {
        // Sanity: we only removed `language` — grade and subject must
        // continue to flow into the profile so VIDYA stays personalised.
        expect(source).toMatch(/preferredGrade:\s*action\.params\.gradeLevel/);
        expect(source).toMatch(/preferredSubject:\s*action\.params\.subject/);
    });
});
