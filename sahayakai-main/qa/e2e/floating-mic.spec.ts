/**
 * Floating mic anchoring (@smoke) — class gate.
 *
 * Founder bug (2026-11): VIDYA's idle rings, its "Tap to reply" tip and its
 * memory badge rendered ~72px (phone) / ~80px (desktop) off the orb. The mic
 * <Button> carried `position: fixed`, so the box its decorations anchor to
 * collapsed to 0x0 at the parent's corner and everything hung off that point.
 *
 * This gate catches the CLASS, not the instance: any decoration of a
 * floating mic that does not sit on the mic button itself. Since the orb
 * took the design-system VIDYA sphere (2026-11), its face is the sphere
 * (no rings, no glyph); the landing-page mic keeps its rings. It covers both
 * floating callers (OmniOrb in the app shell, GlobalVoiceInterface on the
 * landing page), phone and desktop widths, and the idle -> recording
 * transition (nothing may jump when recording starts).
 *
 * Runs against public routes with stub secrets, like smoke.spec.ts.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1280, height: 800 },
];

// Persisted VIDYA history (zustand `jarvis-storage`) so the orb shows its
// "Tap to reply" tip and reply ring, exactly as a returning teacher sees it.
const CHAT_HISTORY = JSON.stringify({
  state: {
    chatHistory: [
      { role: 'user', parts: [{ text: 'hello' }] },
      { role: 'model', parts: [{ text: 'Namaste, teacher' }] },
    ],
    teacherProfile: {},
    formSnapshots: {},
  },
  version: 1,
});

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b, 'element has a layout box').not.toBeNull();
  return b as Box;
}

const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

function expectConcentric(inner: Box, outer: Box, what: string) {
  const a = centre(inner);
  const b = centre(outer);
  expect(Math.abs(a.x - b.x), `${what}: horizontal centre offset (px)`).toBeLessThanOrEqual(2);
  expect(Math.abs(a.y - b.y), `${what}: vertical centre offset (px)`).toBeLessThanOrEqual(2);
}

function intersects(a: Box, b: Box) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function stubVoiceApis(page: Page) {
  // Greeting TTS + cloud STT are irrelevant to layout; fail them fast so the
  // mic falls through to its browser-voice path deterministically.
  await page.route('**/api/tts', (r) => r.fulfill({ status: 500, body: '{}' }));
  await page.route('**/api/ai/voice-to-text', (r) => r.fulfill({ status: 500, body: '{}' }));
  await page.addInitScript(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
        setTimeout(() => u.onend?.(new SpeechSynthesisEvent('end', { utterance: u })), 0);
      };
    }
  });
}

async function openOrb(page: Page) {
  await page.addInitScript((h) => {
    try {
      localStorage.setItem('jarvis-storage', h);
    } catch {}
  }, CHAT_HISTORY);
  await page.goto('/labs', { waitUntil: 'domcontentloaded' });
  return waitForFloatingMic(page);
}

// Wait on the BUTTON, not the anchor box: when the bug is back the anchor
// collapses to 0x0, Playwright calls it "hidden", and the failure would read
// as a timeout instead of the centre offset the assertions below report.
async function waitForFloatingMic(page: Page) {
  const anchor = page.getByTestId('floating-mic');
  await expect(anchor.locator('[data-microphone]')).toBeVisible({ timeout: 30_000 });
  return anchor;
}

// Fake mic for the recording test. Launch options are worker-scoped, so
// Playwright only accepts them at file level; harmless for the other tests.
test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
});

for (const viewport of VIEWPORTS) {
  test.describe(`@smoke floating mic anchoring ${viewport.width}px`, () => {
    test.use({ viewport });

    test(`@smoke VIDYA orb decorations sit on the mic (${viewport.width}px)`, async ({ page }) => {
      const anchor = await openOrb(page);
      const mic = await box(anchor.locator('[data-microphone]'));

      // The anchor box must wrap the button exactly — this is the invariant
      // that, when broken, sends every decoration off the orb.
      expectConcentric(await box(anchor), mic, 'anchor box vs mic');

      // VIDYA's face is the design-system sphere, drawn inside the button and
      // centred on it. A sphere is VIDYA, a mic glyph is a control: the orb
      // carries no glyph.
      const sphere = anchor.locator('[data-vidya-orb-state]');
      await expect(sphere).toHaveAttribute('data-vidya-orb-state', 'idle');
      expectConcentric(await box(sphere), mic, 'VIDYA sphere vs mic');
      await expect(anchor.locator('[data-microphone] svg'), 'the VIDYA orb carries no glyph').toHaveCount(0);

      // "Tap to reply" tip: centred over the orb, just above it.
      const tip = await box(anchor.getByTestId('omni-orb-reply-tip'));
      expect(Math.abs(centre(tip).x - centre(mic).x), 'reply tip horizontal centre offset (px)').toBeLessThanOrEqual(2);
      expect(tip.y + tip.height, 'reply tip sits above the orb').toBeLessThanOrEqual(mic.y);
      expect(mic.y - (tip.y + tip.height), 'reply tip gap above the orb (px)').toBeLessThanOrEqual(40);

      // Memory badge: attached to the orb (overlaps its box), not floating free.
      const memory = await box(page.getByRole('button', { name: 'View Memory' }));
      expect(intersects(memory, mic), 'memory badge overlaps the orb').toBe(true);
    });

    test(`@smoke landing-page mic rings sit on the mic (${viewport.width}px)`, async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const anchor = await waitForFloatingMic(page);
      const mic = await box(anchor.locator('[data-microphone]'));
      expectConcentric(await box(anchor.getByTestId('mic-idle-rings')), mic, 'landing idle rings vs mic');
    });

    test.describe('recording', () => {
      test.use({ permissions: ['microphone'] });

      test(`@smoke starting a recording moves nothing (${viewport.width}px)`, async ({ page }) => {
        await stubVoiceApis(page);
        const anchor = await openOrb(page);
        const micLocator = anchor.locator('[data-microphone]');
        const memoryLocator = page.getByRole('button', { name: 'View Memory' });

        const micIdle = await box(micLocator);
        const memoryIdle = await box(memoryLocator);

        await micLocator.click();
        // The sphere turns to "listening" in place (no separate pulse ring).
        const sphere = anchor.locator('[data-vidya-orb-state]');
        await expect(sphere).toHaveAttribute('data-vidya-orb-state', 'listening', { timeout: 20_000 });

        const micRec = await box(micLocator);
        expectConcentric(micRec, micIdle, 'mic centre, recording vs idle');
        expectConcentric(await box(sphere), micRec, 'listening sphere vs mic');

        const memoryRec = await box(memoryLocator);
        expect(Math.abs(memoryRec.x - memoryIdle.x), 'memory badge x jump (px)').toBeLessThanOrEqual(1);
        expect(Math.abs(memoryRec.y - memoryIdle.y), 'memory badge y jump (px)').toBeLessThanOrEqual(1);
      });
    });
  });
}
