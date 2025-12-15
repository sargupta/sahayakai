import { validateTopicSafety, checkRateLimit, SAFETY_CONFIG } from './safety';

describe('Safety Utilities', () => {

    describe('validateTopicSafety', () => {
        it('should allow safe topics', () => {
            expect(validateTopicSafety('Photosynthesis').safe).toBe(true);
            expect(validateTopicSafety('Ramayana').safe).toBe(true);
            expect(validateTopicSafety('Math 101').safe).toBe(true);
        });

        it('should reject unsafe topics', () => {
            expect(validateTopicSafety('how to make a bomb').safe).toBe(false);
            expect(validateTopicSafety('cheat exam papers').safe).toBe(false);
            expect(validateTopicSafety('suicide methods').safe).toBe(false);
        });

        it('should return a reason for unsafe topics', () => {
            const result = validateTopicSafety('gambling games');
            expect(result.reason).toBeDefined();
            expect(result.reason).toContain('Content Policy Violation');
        });
    });

    describe('checkRateLimit', () => {
        beforeEach(() => {
            // Clear localStorage before each test
            localStorage.clear();
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should allow initial requests', () => {
            const result = checkRateLimit();
            expect(result.allowed).toBe(true);
        });

        it('should block after reaching limit', () => {
            // Fill up the bucket
            for (let i = 0; i < SAFETY_CONFIG.MAX_REQUESTS_PER_WINDOW; i++) {
                checkRateLimit();
            }

            // Next request should fail
            const result = checkRateLimit();
            expect(result.allowed).toBe(false);
            expect(result.waitTime).toBeGreaterThan(0);
        });

        it('should allow requests again after window expires', () => {
            // Fill up the bucket
            for (let i = 0; i < SAFETY_CONFIG.MAX_REQUESTS_PER_WINDOW; i++) {
                checkRateLimit();
            }

            // Advance time past the window
            jest.advanceTimersByTime(SAFETY_CONFIG.WINDOW_MS + 1000);

            // Should be allowed now
            const result = checkRateLimit();
            expect(result.allowed).toBe(true);
        });
    });
});
