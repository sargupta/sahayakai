/**
 * Content guard for the public crawler files (access gate Phase 0).
 *
 * public/llms.txt and public/llms-full.txt are served to anyone at /llms.txt
 * and /llms-full.txt. They previously published the tech stack, the caching
 * and cost strategy, superseded prices and a wrong founder name. This test
 * fails if any of that comes back.
 */
import fs from 'fs';
import path from 'path';

const FILES = ['llms.txt', 'llms-full.txt'];

// Case-insensitive substrings that must never appear.
const FORBIDDEN: string[] = [
    // implementation
    'next.js', 'react', 'typescript', 'tailwind', 'firebase', 'firestore', 'genkit', 'gemini',
    'vercel', 'cloud run', 'sentry', 'razorpay', 'workbox', 'indexeddb', 'serwist',
    'semantic cach', 'stale-while-revalidate', 'cachefirst', 'rate limit', 'api route',
    'outbox', 'agent router', 'sidecar', 'pwa',
    // commercial internals
    'credit', 'rs 149', 'rs 349', '2,400', 'b2g', 'b2c', 'freemium', 'revenue',
    'fundrais', 'valuation', 'competitive landscape',
    // unverified traction and a wrong name
    'retention', 'nps', 'sarit arora',
    // positioning that must not be used
    'rural only', 'rural government school',
];

describe.each(FILES)('public/%s', (file) => {
    const text = fs.readFileSync(path.join(process.cwd(), 'public', file), 'utf8');
    const lower = text.toLowerCase();

    it.each(FORBIDDEN)('does not mention "%s"', (term) => {
        expect(lower).not.toContain(term);
    });

    it('states no price', () => {
        expect(text).not.toMatch(/(₹|\bRs\.?\s?|\bINR\s?)\d/i);
        expect(text).not.toMatch(/\d\s*\/\s*(teacher|month|year)/i);
    });

    it('names the founder, company and location correctly', () => {
        expect(text).toContain('Abhishek Gupta');
        expect(text).toContain('SARGVISION Intelligence');
        expect(text).toContain('Bengaluru');
    });

    it('points schools to a demonstration and to quoted pricing', () => {
        expect(text).toContain('https://www.sahayakai.com/for-schools');
        expect(text).toContain('https://www.sahayakai.com/school-pricing');
        expect(text).toContain('contact@sargvision.com');
        expect(lower).toContain('pricing is quoted per school');
    });

    it('describes the audience as all Indian teachers and schools', () => {
        expect(lower).toContain('cbse');
        expect(lower).toContain('icse');
        expect(lower).toContain('government');
        expect(lower).toContain('private');
    });
});
