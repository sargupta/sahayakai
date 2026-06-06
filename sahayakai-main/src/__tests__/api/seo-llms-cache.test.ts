/**
 * F13-003 regression: /api/seo/llms and /api/seo/llms-full must NOT use
 * fs.readFileSync (blocks event loop) and SHOULD cache file contents in
 * memory across requests.
 *
 * This test asserts:
 *   1. No `readFileSync` reference in the route source.
 *   2. The module uses `fs/promises` (async readFile).
 *   3. A cache variable exists at module scope.
 */

import fs from 'fs';
import path from 'path';

const SEO_ROUTES = ['llms', 'llms-full'];

describe('F13-003: seo route uses async readFile + module-level cache', () => {
    for (const route of SEO_ROUTES) {
        const filePath = path.join(
            process.cwd(),
            'src',
            'app',
            'api',
            'seo',
            route,
            'route.ts',
        );

        describe(`/api/seo/${route}`, () => {
            const src = fs.readFileSync(filePath, 'utf-8');

            it('does not use fs.readFileSync', () => {
                expect(src).not.toMatch(/readFileSync/);
            });

            it('imports fs/promises', () => {
                expect(src).toMatch(/from\s+['"]fs\/promises['"]/);
            });

            it('declares a module-scope cache', () => {
                expect(src).toMatch(/let\s+cachedContent/);
            });
        });
    }
});
