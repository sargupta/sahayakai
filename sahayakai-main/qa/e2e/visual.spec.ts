/**
 * Visual-regression + accessibility suite (@visual).
 *
 * Screenshots 10 canonical public pages in light AND dark mode (20 baselines)
 * and runs an axe-core WCAG 2.1 AA scan on each page/scheme combination.
 *
 * Selection: every test carries the `@visual` tag, so CI selects the suite via
 * `--grep @visual`. The @smoke gate path-targets qa/e2e/smoke.spec.ts and
 * greps @smoke, so this suite is never pulled into the smoke run.
 *
 * Baselines: linux-CI-generated ONLY (see qa/HARNESS.md "Visual Regression").
 * Font rasterisation differs across OSes, so a macOS-generated baseline will
 * never match a linux CI render. Never commit darwin-generated snapshots —
 * bootstrap/refresh baselines via the uat-verify workflow_dispatch with
 * update_snapshots=true, download the artifact, and commit those.
 *
 * Dark mode: the app's dark theme is class-based (next-themes,
 * attribute="class", enableSystem={false} — see src/components/theme-provider.tsx),
 * so `page.emulateMedia({ colorScheme })` alone would NOT flip the UI. We do
 * both: emulateMedia (covers any prefers-color-scheme CSS) AND seed the
 * next-themes `theme` localStorage key before load so the `.dark` class is
 * applied on <html> at hydration.
 *
 * Axe enforcement (AXE_ENFORCE):
 *   - default (unset/0): SOFT mode — serious/critical `color-contrast`
 *     violations are console.warn'ed and attached to the report, but do NOT
 *     fail the test. Production has known baseline contrast issues; T2 fixes
 *     those and flips enforcement on.
 *   - AXE_ENFORCE=1: HARD mode — serious/critical `color-contrast` violations
 *     fail the test with the offending nodes listed.
 */
import { test, expect, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

const AXE_ENFORCE = process.env.AXE_ENFORCE === '1';

const PAGES: Array<{ slug: string; path: string }> = [
  { slug: 'home', path: '/' },
  { slug: 'lesson-plan', path: '/lesson-plan' },
  { slug: 'attendance', path: '/attendance' },
  { slug: 'my-library', path: '/my-library' },
  { slug: 'community-library', path: '/community-library' },
  { slug: 'community', path: '/community' },
  { slug: 'visual-aid-designer', path: '/visual-aid-designer' },
  { slug: 'quiz-generator', path: '/quiz-generator' },
  { slug: 'labs', path: '/labs' },
  { slug: 'try-call', path: '/try-call' },
];

/**
 * Regions whose pixels legitimately change between runs. Masked out of the
 * screenshot comparison (drawn as solid overlay boxes by Playwright).
 * Derived from the actual page components:
 *  - `[data-live]`                      — explicit live-region opt-outs.
 *  - `time` / `[datetime]`              — semantic timestamps (blog, feeds).
 *  - `[aria-roledescription="carousel"]`— shadcn/embla carousels.
 *  - `.animate-pulse`                   — skeleton loaders + pulsing dots
 *                                         (feed-skeleton, demo-interaction,
 *                                         community-chat "live" indicators).
 *  - `h1 .text-saffron`                 — the landing hero's rotating pillar
 *                                         headline (motion/AnimatePresence,
 *                                         JS-driven so `animations:'disabled'`
 *                                         cannot freeze it — see
 *                                         src/components/landing/animated-headline.tsx).
 *  - avatar images                      — Google-account photos + Radix
 *                                         Avatar imgs on community feeds
 *                                         (src/components/community/feed-post.tsx).
 *  - `[data-sonner-toaster]`            — transient toasts.
 */
const DYNAMIC_MASKS: string[] = [
  '[data-live]',
  'time',
  '[datetime]',
  '[aria-roledescription="carousel"]',
  '.animate-pulse',
  'h1 .text-saffron',
  'img[src*="googleusercontent"]',
  'span[class*="rounded-full"] img',
  '[data-sonner-toaster]',
];

type Scheme = 'light' | 'dark';
const SCHEMES: Scheme[] = ['light', 'dark'];

async function preparePage(page: Page, scheme: Scheme, path: string) {
  await page.emulateMedia({ colorScheme: scheme });
  // next-themes (attribute="class", enableSystem=false) reads this key on
  // init and stamps `.dark` on <html>. Without it every screenshot renders
  // the default light theme regardless of emulateMedia.
  await page.addInitScript((theme) => {
    try {
      window.localStorage.setItem('theme', theme);
    } catch {
      /* storage unavailable — page renders default theme */
    }
  }, scheme);

  await page.goto(path, { waitUntil: 'domcontentloaded' });
  // Settle the network before the shot. `.catch` because pages with polling
  // widgets (community live pulse) may never strictly reach networkidle —
  // a hard `goto(..., { waitUntil: 'networkidle' })` would flake there.
  await page.waitForLoadState('networkidle').catch(() => {});
  // Webfonts shift text metrics — wait for them to finish loading.
  await page
    .evaluate(() => (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready)
    .catch(() => {});
}

function formatViolations(
  violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
): string {
  return violations
    .map((v) => {
      const nodes = v.nodes
        .map((n) => `    - ${n.target.join(' ')}\n      ${n.failureSummary?.replace(/\n/g, '\n      ')}`)
        .join('\n');
      return `  [${v.impact}] ${v.id}: ${v.help}\n${nodes}`;
    })
    .join('\n');
}

test.describe('@visual canonical pages — screenshot + axe', () => {
  for (const { slug, path } of PAGES) {
    for (const scheme of SCHEMES) {
      test(`${slug} ${scheme}`, { tag: '@visual' }, async ({ page }, testInfo) => {
        await preparePage(page, scheme, path);

        await expect(page).toHaveScreenshot(`${slug}-${scheme}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.02,
          animations: 'disabled',
          mask: DYNAMIC_MASKS.map((sel) => page.locator(sel)),
        });

        // WCAG 2.1 AA scan. Only serious/critical color-contrast violations
        // gate (per the rollout plan); everything found is attached for
        // triage either way.
        const results = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze();
        const contrast = results.violations.filter(
          (v) => v.id === 'color-contrast' && ['serious', 'critical'].includes(v.impact ?? ''),
        );

        if (results.violations.length > 0) {
          await testInfo.attach(`axe-wcag2aa-${slug}-${scheme}`, {
            body: JSON.stringify(results.violations, null, 2),
            contentType: 'application/json',
          });
        }

        if (contrast.length > 0) {
          const detail =
            `axe color-contrast (serious/critical) on ${path} [${scheme}]:\n` +
            formatViolations(contrast);
          if (AXE_ENFORCE) {
            expect(contrast, detail).toEqual([]);
          } else {
            // SOFT mode: surface loudly, do not fail. T2 flips AXE_ENFORCE=1
            // once the baseline contrast issues are fixed.
            console.warn(`[AXE_ENFORCE=0 soft-fail] ${detail}`);
          }
        }
      });
    }
  }
});
