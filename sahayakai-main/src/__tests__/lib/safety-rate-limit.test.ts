/** @jest-environment node */
import { maxRequestsPerWindow } from '@/lib/safety';

describe('per-teacher generation limit', () => {
    it('is 15 in production, whatever the env says', () => {
        expect(maxRequestsPerWindow({ NODE_ENV: 'production', NEXT_PUBLIC_SAHAYAK_RATE_LIMIT_PER_WINDOW: '200' })).toBe(15);
        expect(maxRequestsPerWindow({ NODE_ENV: 'production' })).toBe(15);
    });
    it('a local demo may raise it', () => {
        expect(maxRequestsPerWindow({ NODE_ENV: 'development', NEXT_PUBLIC_SAHAYAK_RATE_LIMIT_PER_WINDOW: '200' })).toBe(200);
        expect(maxRequestsPerWindow({ NODE_ENV: 'development', NEXT_PUBLIC_SAHAYAK_RATE_LIMIT_PER_WINDOW: 'x' })).toBe(15);
    });
});
