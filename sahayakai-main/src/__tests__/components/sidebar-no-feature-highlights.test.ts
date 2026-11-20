/**
 * CLASS GATE: the sidebar never promotes a feature.
 *
 * Founder request (2026-11-15): remove the "Start here! Create your first lesson plan" popup
 * next to Lesson Plan, and do not highlight any feature like that in the sidebar. The sidebar
 * may badge only real unread counts (messages, notifications), never a spotlight, tooltip,
 * pulse or "New" marker on a destination.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.join(process.cwd(), 'src/components/app-sidebar.tsx'), 'utf8');

it('uses no FeatureSpotlight / wrap on any nav item', () => {
    expect(SRC).not.toMatch(/FeatureSpotlight/);
    expect(SRC).not.toMatch(/\bwrap:/);
});

it('has no "Start here" copy and no "New" feature badge', () => {
    expect(SRC).not.toMatch(/message="Start here/);
    expect(SRC).not.toMatch(/t\("New"\)/);
});

it('the only badges are unread counts', () => {
    const badges = [...SRC.matchAll(/badge:\s*([^,\n]+)/g)].map((m) => m[1].trim());
    expect(badges.length).toBeGreaterThan(0);
    for (const b of badges) expect(b).toMatch(/^countBadge\(/);
});
