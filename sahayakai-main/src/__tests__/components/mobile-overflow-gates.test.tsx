/**
 * CLASS GATE — nothing pokes past a phone screen (founder request 2026-11-17: "make the
 * entire app mobile responsive"). A 394px-wide audit of every page found four shared
 * components that stuck out of, or were clipped by, the screen. Each class is gated here:
 *
 *  1. Floating hint labels centred over an edge-anchored control hang off the screen
 *     (the "Tap to reply" pill over the floating VIDYA orb, +38px on every page).
 *  2. Fixed-width bubbles centred on their target overflow on narrow screens
 *     (FeatureSpotlight's 256px tip on Home, +64px).
 *  3. Header action groups marked `shrink-0` push the page sideways
 *     (Sampark demo header, +39px on every demo page).
 *  4. Grid/flex cards without `min-w-0` grow to their widest child and get clipped
 *     (Sampark principal dashboard, a 460px table made its cards 494px, -130px cut off).
 *
 * The audit itself is scripts/qa/mobile-overflow-audit.js (run it in a phone-sized window).
 */
import fs from 'fs';
import path from 'path';
import { render, screen, act } from '@testing-library/react';
import { Panel } from '@/components/sampark/console-ui';
import { FeatureSpotlight } from '@/components/onboarding/feature-spotlight';

jest.mock('@/context/language-context', () => ({ useLanguage: () => ({ t: (s: string) => s }) }));

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

it('1. the orb\'s "Tap to reply" hint is anchored to the orb\'s right edge, not centred over it', () => {
    const src = read('src/components/omni-orb.tsx');
    const hint = src.slice(src.indexOf('data-testid="orb-reply-hint"') - 260, src.indexOf('data-testid="orb-reply-hint"'));
    expect(hint).toMatch(/\bright-0\b/);
    expect(hint).not.toMatch(/left-1\/2/);
});

describe('2. FeatureSpotlight stays on screen', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('is never wider than the screen and shifts itself back inside the edges', () => {
        Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 375 });
        const rect = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            // the tip, centred on a target near the right edge, would span 247..503 on a 375px screen
            return this.dataset?.testid === 'feature-spotlight-tip'
                ? ({ left: 247, right: 503, width: 256, top: 0, bottom: 80, height: 80, x: 247, y: 0, toJSON() {} } as DOMRect)
                : ({ left: 0, right: 0, width: 0, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON() {} } as DOMRect);
        });
        render(
            <FeatureSpotlight id="x" message="Tap the mic" seenSpotlights={[]} onDismiss={() => {}} delay={0}>
                <button>target</button>
            </FeatureSpotlight>,
        );
        act(() => { jest.runAllTimers(); });
        const tip = screen.getByTestId('feature-spotlight-tip');
        expect(tip.className).toMatch(/max-w-\[calc\(100vw-1rem\)\]/);
        // 503 - (375 - 8) = 136px back to the left
        expect(tip.style.getPropertyValue('--spotlight-shift')).toBe('-136px');
        rect.mockRestore();
    });
});

it('3. the Sampark demo header action group can shrink (no shrink-0) and its status text truncates', () => {
    const src = read('src/components/sampark/demo/demo-frame.tsx');
    const group = src.slice(src.indexOf('data-testid="sampark-demo-header-actions"') - 120, src.indexOf('data-testid="sampark-demo-header-actions"'));
    expect(group).toMatch(/\bmin-w-0\b/);
    expect(group).not.toMatch(/\bshrink-0\b/);
    expect(src).toMatch(/<span className="min-w-0 truncate">\{t\("Demo · Sargvision rings real phones"\)\}<\/span>/);
});

it('4. a Sampark Panel never grows to its widest child (min-w-0), so wide tables scroll inside it', () => {
    const { container } = render(<Panel title="Teachers this week"><div style={{ width: 460 }}>table</div></Panel>);
    expect((container.firstChild as HTMLElement).className).toMatch(/\bmin-w-0\b/);
});
