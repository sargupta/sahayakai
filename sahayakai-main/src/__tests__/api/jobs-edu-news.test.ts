/**
 * @jest-environment node
 *
 * F12-P1-03: edu-news no longer forwards headers — it 301-redirects.
 */
jest.mock('@/lib/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('POST /api/jobs/edu-news', () => {
    it('returns 301 redirect to /api/jobs/daily-briefing', async () => {
        const mod = await import('@/app/api/jobs/edu-news/route');
        const req = {
            url: 'https://example.test/api/jobs/edu-news',
            method: 'POST',
            headers: { get: (_: string) => null },
        } as any;
        const res = await mod.POST(req);
        // jest.setup polyfill strips headers from Response — assert status only.
        expect(res.status).toBe(301);
    });

    it('does not forward caller headers via fetch (F12-P1-03)', async () => {
        // Assert the dangerous header-replay pattern (live code, ignoring block comments)
        // is gone — i.e. the route no longer makes any fetch() to daily-briefing.
        const fs = require('fs');
        const path = require('path');
        const src = fs.readFileSync(
            path.join(process.cwd(), 'src/app/api/jobs/edu-news/route.ts'),
            'utf8',
        );
        // Strip block comments so the historical docstring doesn't trip the matcher.
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
        expect(code).not.toMatch(/Object\.fromEntries\(request\.headers\)/);
        expect(code).not.toMatch(/fetch\(/);
    });
});
