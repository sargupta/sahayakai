/**
 * Class gate: VIDYA's product knowledge must describe the REAL app.
 *
 * - Every manifest route resolves to an existing `src/app/**\/page.tsx`
 *   (VIDYA can never send a teacher to a 404 or describe an invented
 *   section).
 * - Every command-palette route has a manifest section, so a new nav entry
 *   cannot be added without VIDYA learning about it.
 */

import fs from 'fs';
import path from 'path';
import {
    VIDYA_CAPABILITIES,
    VIDYA_SECTIONS,
    VIDYA_WORKFLOWS,
    getSection,
    locateScreen,
    renderManifestForPrompt,
} from '@/lib/vidya/app-manifest';

const APP_DIR = path.join(process.cwd(), 'src', 'app');

function pageExists(route: string): boolean {
    const segments = route === '/' ? [] : route.replace(/^\//, '').split('/');
    const candidates = [
        path.join(APP_DIR, ...segments, 'page.tsx'),
        path.join(APP_DIR, '(marketing)', ...segments, 'page.tsx'),
    ];
    return candidates.some((p) => fs.existsSync(p));
}

describe('app manifest — matches the real application', () => {
    it.each(VIDYA_SECTIONS.map((s) => [s.id, s.route]))('section %s → %s has a page', (_id, route) => {
        expect(pageExists(route)).toBe(true);
    });

    it('covers every command-palette destination', () => {
        const palette = fs.readFileSync(path.join(process.cwd(), 'src/components/command-palette.tsx'), 'utf8');
        const paletteRoutes = [...palette.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
        expect(paletteRoutes.length).toBeGreaterThan(10);
        const manifestRoutes = new Set(VIDYA_SECTIONS.map((s) => s.route));
        expect(paletteRoutes.filter((r) => !manifestRoutes.has(r))).toEqual([]);
    });

    it('covers the mobile bottom-nav destinations', () => {
        const nav = fs.readFileSync(path.join(process.cwd(), 'src/components/mobile-bottom-nav.tsx'), 'utf8');
        const navRoutes = [...nav.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
        const manifestRoutes = new Set(VIDYA_SECTIONS.map((s) => s.route));
        expect(navRoutes.filter((r) => !manifestRoutes.has(r))).toEqual([]);
    });

    it('has unique ids and only references known sections', () => {
        const sectionIds = VIDYA_SECTIONS.map((s) => s.id);
        expect(new Set(sectionIds).size).toBe(sectionIds.length);
        const capIds = VIDYA_CAPABILITIES.map((c) => c.id);
        expect(new Set(capIds).size).toBe(capIds.length);
        for (const c of VIDYA_CAPABILITIES) expect(getSection(c.section)).toBeDefined();
        for (const w of VIDYA_WORKFLOWS) expect(getSection(w.section)).toBeDefined();
    });

    it('describes students as part of Attendance (there is no separate Students page)', () => {
        expect(getSection('attendance')?.purpose).toMatch(/students/i);
        expect(VIDYA_WORKFLOWS.find((w) => w.id === 'students.add')?.steps.join(' ')).toMatch(/Add Student/);
    });
});

describe('locateScreen', () => {
    it.each([
        ['/', 'home', 'home'],
        ['/my-library', 'my-library', 'my-library'],
        ['/attendance', 'attendance', 'attendance.classes'],
        ['/attendance/abc123', 'attendance', 'attendance.class'],
        ['/attendance/abc123/marks', 'attendance', 'attendance.marks'],
        ['/lesson-plan?topic=x', 'lesson-plan', 'lesson-plan'],
        ['/privacy-for-teachers', 'privacy', 'privacy'],
    ])('%s → section %s, screen %s', (pathname, sectionId, screenId) => {
        const loc = locateScreen(pathname);
        expect(loc.section?.id).toBe(sectionId);
        expect(loc.screenId).toBe(screenId);
    });

    it('does not treat unknown paths as Home', () => {
        expect(locateScreen('/does-not-exist').section).toBeNull();
    });
});

describe('renderManifestForPrompt', () => {
    it('names the Library location and the attendance workflow with real labels', () => {
        const text = renderManifestForPrompt();
        expect(text).toContain('My Library (/my-library)');
        expect(text).toContain('Submit Attendance');
        expect(text).toContain('All Present');
    });
});
