/** @jest-environment node */
/**
 * SamparkAI demo planning: callbacks only at permitted times (with the next
 * permitted time offered, never moved silently), the calendar built from
 * SamparkAI's own event builders, the seeded campaigns and callbacks covering
 * every state the pages show, and the role scope (a teacher sees only their
 * classes; whole-school notices reach everyone).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { demoCalendarEvents } from '@/lib/sampark/demo/calendar';
import { checkCallbackTime, nextAllowed } from '@/lib/sampark/demo/rules';
import { getDemoSchool } from '@/lib/sampark/demo/school';
import { buildSeedCalls } from '@/lib/sampark/demo/seed-calls';
import { buildSeedCallbacks, buildSeedCampaigns, demoHolidays, istAt, istDate } from '@/lib/sampark/demo/seed-planning';

// Wednesday 28 Oct 2026, 15:00 IST.
const NOW = new Date('2026-10-28T09:30:00Z');

describe('callback times', () => {
    const at = (iso: string) => new Date(iso);

    it('accepts a weekday inside calling hours', () => {
        expect(checkCallbackTime(at('2026-10-29T12:30:00+05:30'), NOW, [])).toEqual({ ok: true });
    });

    it.each([
        ['2026-10-28T08:00:00+05:30', 'past'],
        ['2026-10-29T21:00:00+05:30', 'outside_hours'],
        ['2026-10-29T09:30:00+05:30', 'outside_hours'],
        ['2026-11-01T11:00:00+05:30', 'sunday'],
        ['2026-12-15T11:00:00+05:30', 'too_far'],
    ])('refuses %s (%s) and offers a permitted time', (iso, why) => {
        const r = checkCallbackTime(at(iso), NOW, []);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.why).toBe(why);
        if (why !== 'too_far') {
            expect(r.next).not.toBeNull();
            expect(checkCallbackTime(r.next!, NOW, [])).toEqual({ ok: true });
        }
    });

    it('never offers a holiday, and skips to the next school day', () => {
        const r = checkCallbackTime(at('2026-10-30T11:00:00+05:30'), NOW, ['2026-10-30', '2026-10-31']);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.why).toBe('holiday');
        // Friday and Saturday are holidays, Sunday is never called: Monday 10:00.
        expect(r.next?.toISOString()).toBe(new Date('2026-11-02T10:00:00+05:30').toISOString());
    });

    it('rolls an evening request to the next morning', () => {
        expect(nextAllowed(at('2026-10-28T20:30:00+05:30'), NOW, [])?.toISOString()).toBe(new Date('2026-10-29T10:00:00+05:30').toISOString());
    });
});

describe('seeded planning data', () => {
    const now = NOW.getTime();
    const calls = buildSeedCalls(now);
    const campaigns = buildSeedCampaigns(now);
    const callbacks = buildSeedCallbacks(now, calls);

    it('has a campaign in every state the pages show', () => {
        expect(new Set(campaigns.map((c) => c.status))).toEqual(new Set(['dispatching', 'scheduled', 'completed', 'draft']));
        for (const c of campaigns) {
            expect(c.counts.heardKeyFact).toBeLessThanOrEqual(c.counts.guardians - c.counts.blocked);
            expect(c.mode).toBe('practice');
        }
    });

    it('has a parent request waiting for a time, and never a time on it', () => {
        const proposed = callbacks.filter((c) => c.status === 'proposed');
        expect(proposed.length).toBeGreaterThan(0);
        for (const c of proposed) {
            expect(c.scheduledAt).toBeNull();
            expect(c.source).toBe('parent_request');
        }
    });

    it('files every callback under the class teacher', () => {
        const school = getDemoSchool();
        for (const cb of callbacks) expect(school.classes.find((c) => c.id === cb.classId)?.teacherId).toBe(cb.teacherId);
    });

    it('builds the calendar from SamparkAI\'s event builders', () => {
        const events = demoCalendarEvents({ callbacks, campaigns, holidays: demoHolidays(now), now: NOW });
        const types = new Set(events.map((e) => e.type));
        for (const t of ['scheduled_call', 'campaign_calls', 'school_event', 'holiday']) expect(types.has(t as never)).toBe(true);
        // Drafts are not on the calendar; proposals without a time are not placed on a date.
        expect(events.some((e) => e.campaignIds.includes('camp-science') && e.type === 'campaign_calls')).toBe(false);
        expect(events.filter((e) => e.source.collection === 'sampark_callbacks').length).toBe(callbacks.filter((c) => c.scheduledAt).length);
        expect(events.map((e) => e.start)).toEqual([...events.map((e) => e.start)].sort());
    });

    it('dates everything in India time', () => {
        expect(istDate(NOW.getTime(), 0)).toBe('2026-10-28');
        expect(istAt(NOW.getTime(), 1, 10, 0)).toBe(new Date('2026-10-29T10:00:00+05:30').toISOString());
    });
});

describe('role scope', () => {
    it('a teacher sees whole-school notices and their own classes, never another class', () => {
        const campaigns = buildSeedCampaigns(NOW.getTime());
        const teacher = getDemoSchool().teachers.find((t) => t.id === 't-thapa')!;
        const visible = campaigns.filter(
            (c) => c.status !== 'draft' && (c.audience.sections.length === 0 || c.audience.sections.some((x) => teacher.classIds.includes(`${x.grade}${x.section}`))),
        );
        expect(visible.map((c) => c.id).sort()).toEqual(['camp-closure', 'camp-ptm-6', 'camp-sports']);
    });
});

describe('SamparkAI branding (class gate)', () => {
    const ROOTS = ['src/components/sampark', 'src/app/sampark', 'src/components/shell/brand.tsx'];
    const files = (p: string): string[] =>
        statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => files(path.join(p, f))) : /\.(tsx|ts)$/.test(p) ? [p] : [];

    it('never shows an endorsement line under the SamparkAI name', () => {
        const root = path.resolve(__dirname, '..', '..', '..', '..');
        const offenders = ROOTS.flatMap((r) => files(path.join(root, r))).filter((f) => {
            const src = readFileSync(f, 'utf8');
            return /["'>]\s*by SahayakAI\s*["'<]/.test(src) || /SamparkWordmark[^>]*\bendorsed\b/.test(src) || /part of SahayakAI/.test(src);
        });
        expect(offenders).toEqual([]);
    });
});
