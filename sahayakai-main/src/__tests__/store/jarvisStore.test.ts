/**
 * Unit tests for jarvisStore — focuses on the per-query staging fields
 * introduced by the 2026-05-19 NCERT-demo state-pollution fix.
 *
 * Three guarantees the OmniOrb client relies on:
 *
 *   1. `clearStructuredDataIfStale(currentPath)` wipes the structuredData
 *      payload when its publisher's `page` field does not match the
 *      current URL slug.
 *   2. `markQueryCompleted(path)` stamps both timestamp and path so the
 *      next query can decide whether to carry chat history.
 *   3. `resetContext()` also wipes the new per-query staging fields so
 *      tapping the "Clear Context" button gives a truly clean slate.
 */

import { useJarvisStore } from '@/store/jarvisStore';

describe('jarvisStore — per-query staging (NCERT demo fix)', () => {
    beforeEach(() => {
        // Each test starts from a clean slate. The store is a singleton,
        // so we explicitly reset the slice we care about. `resetContext`
        // wipes chat + structuredData + query-staging; `formSnapshots` is
        // not relevant for these assertions.
        useJarvisStore.getState().resetContext();
        useJarvisStore.setState({ structuredData: {} });
    });

    describe('clearStructuredDataIfStale', () => {
        it('keeps structuredData when its page slug matches the current path', () => {
            useJarvisStore.getState().setStructuredData({
                page: 'quiz-generator',
                topic: 'photosynthesis',
                gradeLevel: 'Class 7',
                subject: 'Science',
            });

            useJarvisStore.getState().clearStructuredDataIfStale('/quiz-generator');

            const sd = useJarvisStore.getState().structuredData;
            expect(sd.page).toBe('quiz-generator');
            expect(sd.topic).toBe('photosynthesis');
            expect(sd.gradeLevel).toBe('Class 7');
        });

        it('wipes structuredData when the publisher page does NOT match', () => {
            // Founder was on /quiz-generator (sync'd via useVidyaFormSync)
            // then navigated to /exam-paper (no sync). Without this clear
            // VIDYA would still see "Class 7 / Science / photosynthesis"
            // as the active form fields and bleed them into the next
            // intent's params.
            useJarvisStore.getState().setStructuredData({
                page: 'quiz-generator',
                topic: 'photosynthesis',
                gradeLevel: 'Class 7',
                subject: 'Science',
            });

            useJarvisStore.getState().clearStructuredDataIfStale('/exam-paper');

            expect(useJarvisStore.getState().structuredData).toEqual({});
        });

        it('wipes structuredData when no `page` field is present (orphan payload)', () => {
            useJarvisStore.getState().setStructuredData({
                topic: 'orphan',
                gradeLevel: 'Class 7',
            });

            useJarvisStore.getState().clearStructuredDataIfStale('/exam-paper');

            expect(useJarvisStore.getState().structuredData).toEqual({});
        });

        it('is a no-op when structuredData is already empty', () => {
            useJarvisStore.getState().clearStructuredDataIfStale('/exam-paper');
            expect(useJarvisStore.getState().structuredData).toEqual({});
        });

        it('matches case-insensitively so /Quiz-Generator still maps to quiz-generator', () => {
            useJarvisStore.getState().setStructuredData({
                page: 'quiz-generator',
                topic: 'photosynthesis',
            });

            useJarvisStore.getState().clearStructuredDataIfStale('/Quiz-Generator');
            expect(useJarvisStore.getState().structuredData.page).toBe('quiz-generator');
        });

        it('ignores trailing path segments when matching the slug', () => {
            useJarvisStore.getState().setStructuredData({
                page: 'quiz-generator',
                topic: 'photosynthesis',
            });

            // e.g. /quiz-generator/saved/abc123 — still the same page
            useJarvisStore.getState().clearStructuredDataIfStale('/quiz-generator/saved/abc123');
            expect(useJarvisStore.getState().structuredData.page).toBe('quiz-generator');
        });
    });

    describe('markQueryCompleted', () => {
        it('stamps both `lastQueryAt` and `lastQueryPath`', () => {
            const before = Date.now();
            useJarvisStore.getState().markQueryCompleted('/exam-paper');
            const { lastQueryAt, lastQueryPath } = useJarvisStore.getState();
            expect(lastQueryPath).toBe('/exam-paper');
            expect(lastQueryAt).not.toBeNull();
            expect(lastQueryAt!).toBeGreaterThanOrEqual(before);
        });
    });

    describe('resetContext', () => {
        it('wipes per-query staging fields alongside chat history', () => {
            // Simulate an active session
            useJarvisStore.getState().addMessage('user', 'make a Class 7 Science quiz');
            useJarvisStore.getState().addMessage('model', 'Sure, generating it now');
            useJarvisStore.getState().setStructuredData({
                page: 'quiz-generator',
                topic: 'photosynthesis',
            });
            useJarvisStore.getState().markQueryCompleted('/quiz-generator');

            // Clear context (founder taps trash in the VIDYA Memory drawer)
            useJarvisStore.getState().resetContext();

            const s = useJarvisStore.getState();
            expect(s.chatHistory).toEqual([]);
            expect(s.structuredData).toEqual({});
            expect(s.lastQueryAt).toBeNull();
            expect(s.lastQueryPath).toBeNull();
        });
    });
});

describe('jarvisStore — state-pollution scenario regression', () => {
    /**
     * Reproduces the exact NCERT-demo failure mode end-to-end at the
     * store layer:
     *
     *   1. Founder is on /quiz-generator → form sync publishes
     *      structuredData {page:'quiz-generator', topic, gradeLevel,
     *      subject}.
     *   2. Founder taps mic, says "make a Class 7 Science quiz on
     *      photosynthesis" → chat history accumulates, lastQueryAt
     *      stamped.
     *   3. Founder navigates to /exam-paper. exam-paper does NOT call
     *      useVidyaFormSync, so without the fix structuredData stays
     *      stale.
     *   4. Founder taps mic on /exam-paper. The next OmniOrb call should
     *      see structuredData wiped (because the publisher's page slug no
     *      longer matches the current path).
     */
    it('clears stale form-sync payload on navigation to a non-sync page', () => {
        useJarvisStore.getState().resetContext();

        // Step 1+2: a sync'd page publishes its form
        useJarvisStore.getState().setStructuredData({
            page: 'quiz-generator',
            topic: 'photosynthesis',
            gradeLevel: 'Class 7',
            subject: 'Science',
        });
        useJarvisStore.getState().addMessage('user', 'make a Class 7 Science quiz on photosynthesis');
        useJarvisStore.getState().addMessage('model', 'On it.');
        useJarvisStore.getState().markQueryCompleted('/quiz-generator');

        expect(useJarvisStore.getState().structuredData.topic).toBe('photosynthesis');

        // Step 3+4: navigate to /exam-paper, OmniOrb runs the clear
        useJarvisStore.getState().clearStructuredDataIfStale('/exam-paper');

        // After clear, the next voice query on /exam-paper does NOT see
        // the prior page's "Class 7 Science photosynthesis" in
        // structuredData. This is the bug-killer assertion.
        expect(useJarvisStore.getState().structuredData).toEqual({});

        // The chat history is intentionally preserved at the store level
        // — OmniOrb's `processTranscription` decides per-query whether to
        // forward it (same-page + <5 min) or to send [] (fresh intent).
        expect(useJarvisStore.getState().chatHistory.length).toBe(2);
    });
});
