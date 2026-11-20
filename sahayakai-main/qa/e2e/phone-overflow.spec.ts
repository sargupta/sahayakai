/**
 * CLASS GATE (@smoke) — no public marketing page is wider than a phone.
 *
 * Teachers and principals open these pages on low-cost Android phones. On
 * 16 Nov 2026 the SamparkAI site (/sampark) laid out at 444px on a 390px
 * phone: the hero's stat row (`repeat(auto-fit, minmax(140px, 1fr))` inside
 * `max-w-lg`) had a 444px min-content width, the hero's implicit `auto` grid
 * column grew to it, and the hero's `overflow-hidden` CLIPPED the headline,
 * lead, buttons and the sample screen instead of scrolling. The page never
 * scrolled sideways, so a `scrollWidth > clientWidth` check passed while the
 * headline was cut off. This gate checks both:
 *
 *  1. the page does not scroll sideways, and
 *  2. no visible text (or meaningful image / control) runs past either edge
 *     of the screen — even when an ancestor hides it with overflow
 *     hidden/clip at the screen edge.
 *
 * Content is excused only when the user can still reach or see that it was
 * cut on purpose: it sits inside a horizontal scroller (overflow-x
 * auto/scroll) that itself fits the screen, or inside a clipping box whose
 * own edge is inside the screen (a `truncate` label, a carousel window).
 * Anything else that is cut on purpose (a full-bleed marquee) must say so
 * with `data-overflow-ok` on the clipping element.
 *
 * Pages: every static route under src/app/(marketing) — found on disk, so a
 * new marketing page is gated without editing this file — plus the public
 * pages that live outside that group (below).
 */
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const PHONE_WIDTHS = [360, 390, 430];

/** Public marketing pages outside src/app/(marketing). */
const EXTRA_PUBLIC_PAGES = ['/', '/sampark', '/pricing', '/privacy-for-teachers'];

function marketingRoutes(): string[] {
  const root = path.resolve(__dirname, '../../src/app/(marketing)');
  const routes: string[] = [];
  const walk = (dir: string, segs: string[]) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      // Dynamic segments need real params; private folders are not routes.
      if (name.startsWith('[') || name.startsWith('_') || name.startsWith('@')) continue;
      // Route groups `(x)` add no URL segment.
      const next = name.startsWith('(') ? segs : [...segs, name];
      const full = path.join(dir, name);
      if (fs.existsSync(path.join(full, 'page.tsx')) || fs.existsSync(path.join(full, 'page.ts'))) {
        routes.push('/' + next.join('/'));
      }
      walk(full, next);
    }
  };
  walk(root, []);
  return routes;
}

const PAGES = Array.from(new Set([...EXTRA_PUBLIC_PAGES, ...marketingRoutes()])).sort();

type Report = { sideways: number; offenders: string[] };

/** Runs in the page. Kept dependency-free so it can also be pasted into DevTools. */
function auditPhoneOverflow(phoneWidth: number): Report {
  const doc = document;
  const root = (doc.scrollingElement || doc.documentElement) as HTMLElement;
  // With mobile emulation the layout viewport can widen to fit overflowing
  // content, so measure against the phone's width, not the viewport's.
  const vw = Math.min(root.clientWidth, phoneWidth);
  const TOL = 1;
  const sideways = Math.max(root.scrollWidth, doc.body.scrollWidth) - vw;

  const visible = (el: Element) =>
    (el as HTMLElement).checkVisibility
      ? (el as HTMLElement).checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true,
          opacityProperty: true,
          visibilityProperty: true,
        } as CheckVisibilityOptions)
      : true;

  const excused = (el: Element, side: 'left' | 'right') => {
    for (let p: Element | null = el; p && p !== doc.documentElement; p = p.parentElement) {
      if (p.hasAttribute('data-overflow-ok')) return true;
      const s = getComputedStyle(p);
      // Screen-reader-only text (clip: rect(0 0 0 0)) is never painted.
      if (s.clip !== 'auto' && s.clip !== '') return true;
      const r = p.getBoundingClientRect();
      // A closed off-canvas drawer: fixed and entirely off the screen.
      if (s.position === 'fixed' && (r.right <= 0 || r.left >= vw)) return true;
      if (/(auto|scroll)/.test(s.overflowX) && r.left >= -TOL && r.right <= vw + TOL) return true;
      if (/(hidden|clip)/.test(s.overflowX)) {
        if (side === 'right' && r.right < vw - TOL) return true;
        if (side === 'left' && r.left > TOL) return true;
      }
    }
    return false;
  };

  const describe = (el: Element) => {
    const cls = (typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className : '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6)
      .join('.');
    const text = ((el as HTMLElement).innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    return `<${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}> "${text}"`;
  };

  const offenders = new Map<Element, number>();
  const check = (el: Element, rects: ArrayLike<DOMRect>) => {
    for (const r of Array.from(rects)) {
      if (r.width < 1 || r.height < 1) continue;
      if (r.right > vw + TOL && !excused(el, 'right')) {
        offenders.set(el, Math.max(offenders.get(el) ?? 0, Math.round(r.right - vw)));
      } else if (r.left < -TOL && r.right > 0 && !excused(el, 'left')) {
        offenders.set(el, Math.max(offenders.get(el) ?? 0, Math.round(-r.left)));
      }
    }
  };

  // Text: measure the glyph runs themselves, not their boxes.
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const range = doc.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName) || !visible(el)) continue;
    range.selectNodeContents(n);
    check(el, range.getClientRects());
  }

  // Meaningful images and controls (decorative ones are aria-hidden / alt="").
  const media = doc.body.querySelectorAll('img:not([alt=""]), svg, video, canvas, iframe, input, select, textarea');
  for (const el of Array.from(media)) {
    if (el.closest('[aria-hidden="true"], [role="presentation"], [role="none"]')) continue;
    if (el.tagName.toLowerCase() === 'svg' && el.parentElement?.closest('svg')) continue;
    if (!visible(el)) continue;
    check(el, [el.getBoundingClientRect()]);
  }

  // Report the outermost offenders, widest first.
  const list = Array.from(offenders.entries());
  return {
    sideways,
    offenders: list
      .filter(([el]) => !list.some(([other]) => other !== el && other.contains(el)))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([el, px]) => `${px}px past the edge: ${describe(el)}`),
  };
}

test.describe('@smoke public marketing pages fit a phone screen', () => {
  for (const width of PHONE_WIDTHS) {
    test.describe(`${width}px`, () => {
      test.use({
        viewport: { width, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        // Entrance animations (slide-ins) must not count as overflow.
        contextOptions: { reducedMotion: 'reduce' },
      });

      for (const route of PAGES) {
        test(`@smoke ${route} at ${width}px`, async ({ page }) => {
          const res = await page.goto(route, { waitUntil: 'domcontentloaded' });
          expect(res?.status(), `${route} HTTP status`).toBeLessThan(400);
          await page.waitForLoadState('networkidle').catch(() => {});
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(300);

          const report = await page.evaluate(auditPhoneOverflow, width);
          expect(
            { sideways: Math.max(0, report.sideways), offenders: report.offenders },
            `${route} at ${width}px: the page scrolls sideways or cuts content off at the screen edge`,
          ).toEqual({ sideways: 0, offenders: [] });
        });
      }
    });
  }
});
