/**
 * Phone-width horizontal-overflow gate (@smoke).
 *
 * Class of bug: something in the app chrome (header controls, the floating
 * VIDYA orb and its rings, the bottom nav) is wider than a phone screen, so
 * EVERY app page scrolls sideways. Reported 2026-10-07: at 375px the header
 * was 447px wide and documentElement.scrollWidth was 446.
 *
 * The check is generic, not tied to that header: on each route, at each
 * phone width, the page must not be scrollable sideways
 * (documentElement.scrollWidth <= clientWidth) and the header must not
 * overflow itself. A crowded header can also fail without widening the
 * page, because its left group is allowed to shrink (min-w-0), so three
 * more header checks: no control (link or button) is squeezed narrower
 * than it is when the header has all the room it wants, no two controls
 * overlap (e.g. the wordmark running under Search), and no header text is
 * cut off with an ellipsis. On failure it names the outermost elements that
 * stick out past the right edge, so the culprit is in the error message.
 *
 * Runs unauthenticated with stub secrets (same as smoke.spec.ts), which is
 * the widest header state: the "Sign in with Google" button instead of the
 * avatar. Add a route here when it renders the app shell without auth.
 */
import { test, expect, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 320, height: 640 }, // smallest supported (iPhone SE 1st gen, small Android)
  { width: 360, height: 740 }, // most common Android width
  { width: 375, height: 812 }, // the reported width
  { width: 414, height: 896 },
  { width: 640, height: 360 }, // 360x640 Android phone in landscape (the sm breakpoint)
] as const;

const ROUTES = ['/labs', '/quiz-generator', '/lesson-plan'] as const;

type Overflow = {
  scrollWidth: number;
  clientWidth: number;
  headerScrollWidth: number | null;
  headerClientWidth: number | null;
  culprits: string[];
  truncatedHeaderText: string[];
  squeezedControls: string[];
  overlappingControls: string[];
};

async function measure(page: Page): Promise<Overflow> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const vw = root.clientWidth;
    const header = document.querySelector('[data-testid="app-header"]');
    const describe = (el: Element) => {
      const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') ?? '';
      const r = el.getBoundingClientRect();
      return `<${el.tagName.toLowerCase()} class="${cls.slice(0, 80)}"> right=${Math.round(r.right)}`;
    };
    const sticksOut = (el: Element) => {
      const r = el.getBoundingClientRect();
      return (r.width > 0 || r.height > 0) && r.right > vw + 0.5;
    };
    // Outermost offenders only: an element past the edge whose parent is not.
    const culprits = Array.from(document.body.querySelectorAll('*'))
      .filter((el) => sticksOut(el) && !(el.parentElement && sticksOut(el.parentElement)))
      .slice(0, 10)
      .map(describe);
    // Header text cut off with an ellipsis (visible boxes only).
    const truncatedHeaderText = header
      ? Array.from(header.querySelectorAll<HTMLElement>('*'))
          .filter((el) => {
            if (el.getBoundingClientRect().width === 0) return false;
            if (getComputedStyle(el).textOverflow !== 'ellipsis') return false;
            return el.scrollWidth > el.clientWidth;
          })
          .map((el) => `"${el.textContent?.trim()}" ${el.clientWidth}px of ${el.scrollWidth}px`)
      : [];
    // Header controls: squeezed below their natural width, or overlapping.
    const squeezedControls: string[] = [];
    const overlappingControls: string[] = [];
    if (header instanceof HTMLElement) {
      const label = (el: Element) =>
        (el.getAttribute('aria-label') || el.textContent?.trim() || el.tagName).slice(0, 30);
      const controls = Array.from(header.querySelectorAll('a, button, [role="button"]')).filter(
        (el) => el.getBoundingClientRect().width > 0,
      );
      const rects = controls.map((el) => el.getBoundingClientRect());
      // Natural widths: let the header be as wide as its content, re-measure.
      const prevWidth = header.style.width;
      const prevMax = header.style.maxWidth;
      header.style.width = 'max-content';
      header.style.maxWidth = 'none';
      const natural = controls.map((el) => el.getBoundingClientRect().width);
      header.style.width = prevWidth;
      header.style.maxWidth = prevMax;
      controls.forEach((el, i) => {
        if (rects[i].width < natural[i] - 0.5) {
          squeezedControls.push(`"${label(el)}" ${Math.round(rects[i].width)}px of ${Math.round(natural[i])}px`);
        }
      });
      for (let i = 0; i < controls.length; i++) {
        for (let j = i + 1; j < controls.length; j++) {
          if (controls[i].contains(controls[j]) || controls[j].contains(controls[i])) continue;
          const a = rects[i];
          const b = rects[j];
          const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlapX > 0.5 && overlapY > 0.5) {
            overlappingControls.push(`"${label(controls[i])}" and "${label(controls[j])}" by ${Math.round(overlapX)}px`);
          }
        }
      }
    }
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: vw,
      headerScrollWidth: header ? header.scrollWidth : null,
      headerClientWidth: header ? header.clientWidth : null,
      culprits,
      truncatedHeaderText,
      squeezedControls,
      overlappingControls,
    };
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`@smoke phone width ${vp.width}px`, () => {
    test.use({ viewport: vp, isMobile: true, hasTouch: true });

    test(`@smoke app pages do not scroll sideways at ${vp.width}px`, async ({ page }) => {
      test.setTimeout(120_000);

      for (const route of ROUTES) {
        const res = await page.goto(route, { waitUntil: 'domcontentloaded' });
        expect(res?.status(), `${route} HTTP status`).toBeLessThan(400);

        // Let the chrome reach its widest settled state before measuring:
        // the auth state resolved to the sign-in button, and the floating
        // VIDYA orb (loaded client-side after first paint) mounted.
        const header = page.getByTestId('app-header');
        await expect(header).toBeVisible();
        await expect(header.getByRole('button', { name: 'Sign in with Google' })).toBeVisible({
          timeout: 20_000,
        });
        await expect(page.getByTestId('omni-orb-layer')).toBeAttached({ timeout: 20_000 });
        await page.waitForLoadState('networkidle').catch(() => {});
        // Measure with the real web fonts, not the fallback metrics.
        await page.evaluate(() => document.fonts.ready.then(() => undefined));

        const m = await measure(page);
        const detail = `\n${route} at ${vp.width}px: scrollWidth=${m.scrollWidth} clientWidth=${m.clientWidth} header=${m.headerScrollWidth}/${m.headerClientWidth}\nsticking out:\n  ${m.culprits.join('\n  ') || '(none)'}`;

        expect.soft(m.scrollWidth, `page scrolls sideways${detail}`).toBeLessThanOrEqual(m.clientWidth);
        if (m.headerScrollWidth !== null && m.headerClientWidth !== null) {
          expect.soft(m.headerScrollWidth, `header overflows itself${detail}`).toBeLessThanOrEqual(m.headerClientWidth);
        }
        expect.soft(m.truncatedHeaderText, `header text cut off${detail}`).toEqual([]);
        expect.soft(m.squeezedControls, `header controls squeezed${detail}`).toEqual([]);
        expect.soft(m.overlappingControls, `header controls overlap${detail}`).toEqual([]);
      }
    });
  });
}
