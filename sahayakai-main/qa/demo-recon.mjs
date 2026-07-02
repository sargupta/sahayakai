// Recon: screenshot authenticated feature pages at 9:16 to see what actually renders.
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/tmp/sahayak-recon';
fs.mkdirSync(OUT, { recursive: true });

const routes = [
  ['home', '/'],
  ['lesson-plan', '/lesson-plan'],
  ['attendance', '/attendance'],
  ['instant-answer', '/instant-answer'],
  ['visual-aid', '/visual-aid-designer'],
  ['worksheet', '/worksheet-wizard'],
  ['quiz', '/quiz-generator'],
  ['exam-paper', '/exam-paper'],
  ['community', '/community'],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: 'qa/fixtures/demo-video-state.json',
  viewport: { width: 432, height: 768 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

for (const [name, route] of routes) {
  try {
    await page.goto('http://localhost:3000' + route, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) {
    console.log(`${name}: nav timeout/err -> ${e.message.split('\n')[0]}`);
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const url = page.url();
  const title = await page.title().catch(() => '');
  console.log(`${name}: ${route} -> ${url} | "${title}"`);
}

await browser.close();
console.log('DONE -> ' + OUT);
