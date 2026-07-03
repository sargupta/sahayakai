import { LABS_TOOLS, isLabsRoute } from '@/lib/labs';

describe('labs registry', () => {
    it('matches parked routes and their subroutes', () => {
        expect(isLabsRoute('/video-storyteller')).toBe(true);
        expect(isLabsRoute('/video-storyteller/history')).toBe(true);
        expect(isLabsRoute('/teacher-training')).toBe(true);
    });

    it('does not match spine tools or prefix look-alikes', () => {
        expect(isLabsRoute('/lesson-plan')).toBe(false);
        expect(isLabsRoute('/quiz-generator')).toBe(false);
        expect(isLabsRoute('/labs')).toBe(false);
        // startsWith must not bleed across path segments
        expect(isLabsRoute('/video-storyteller-pro')).toBe(false);
        expect(isLabsRoute(null)).toBe(false);
        expect(isLabsRoute(undefined)).toBe(false);
    });

    it('never parks the six spine tools', () => {
        const spine = ['/lesson-plan', '/worksheet-wizard', '/quiz-generator', '/exam-paper', '/rubric-generator', '/instant-answer'];
        for (const href of spine) {
            expect(LABS_TOOLS.some((tool) => tool.href === href)).toBe(false);
        }
    });
});
