/**
 * F13-004 regression: hot AI routes must declare `export const maxDuration`
 * so Cloud Run / Vercel allow generations longer than the default 10s window.
 *
 * If any hot AI route stops declaring maxDuration, this test fails.
 */

import fs from 'fs';
import path from 'path';

const HOT_AI_ROUTES = [
    'lesson-plan',
    'quiz',
    'exam-paper',
    'virtual-field-trip',
    'assessment-scanner',
    'video-storyteller',
    'visual-aid',
];

describe('F13-004: hot AI routes declare maxDuration', () => {
    for (const route of HOT_AI_ROUTES) {
        it(`/api/ai/${route}/route.ts exports maxDuration >= 60`, () => {
            const filePath = path.join(
                process.cwd(),
                'src',
                'app',
                'api',
                'ai',
                route,
                'route.ts',
            );
            const src = fs.readFileSync(filePath, 'utf-8');
            const match = src.match(/export\s+const\s+maxDuration\s*=\s*(\d+)/);
            expect(match).not.toBeNull();
            const seconds = match ? parseInt(match[1], 10) : 0;
            expect(seconds).toBeGreaterThanOrEqual(60);
        });
    }
});
