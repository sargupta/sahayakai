#!/usr/bin/env node
/**
 * Browser check for the Assessment Scanner's PDF → page-image step, using the
 * REAL `src/app/assessment-scanner/pdf-to-images.ts` and the real pdfjs-dist
 * build, in headless Chromium. No server, no AI calls, no credentials.
 *
 *   python3 scripts/assessment-scanner/make-synthetic-pdfs.py /tmp/scan-fixtures
 *   node scripts/assessment-scanner/verify-pdf-render.mjs /tmp/scan-fixtures [maxPages=10]
 *
 * For every fixture it prints one JSON line: pages in the PDF, images produced,
 * the page number decoded from each image's pixel marker (proves order: image i
 * really is page i), the JSON request size the page would POST, or the typed
 * error code. Exit 1 if any multi-page fixture loses, reorders or mislabels a page.
 *
 * Env: CHROMIUM_PATH (default /opt/pw-browsers/chromium, else Playwright's own).
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const fixtures = resolve(process.argv[2] ?? 'synthetic-pdfs');
const maxPages = Number(process.argv[3] ?? 10);
const work = mkdtempSync(join(tmpdir(), 'scan-render-'));

const entry = join(work, 'entry.ts');
writeFileSync(
    entry,
    `import { renderPdfToImages } from ${JSON.stringify(join(repo, 'src/app/assessment-scanner/pdf-to-images.ts'))};
async function decodeMarker(uri: string): Promise<number | null> {
  const img = new Image(); img.src = uri; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0);
  const bits: number[] = [];
  for (let i = 0; i < 10; i++) {
    const x = Math.round((0.06 + i * 0.088 + 0.088 * 0.45) * c.width), y = Math.round(0.05 * c.height);
    const d = ctx.getImageData(x - 2, y - 2, 5, 5).data; let s = 0;
    for (let k = 0; k < d.length; k += 4) s += (d[k] + d[k + 1] + d[k + 2]) / 3;
    bits.push(s / 25 < 128 ? 1 : 0);
  }
  if (bits[0] !== 1 || bits[9] !== 0) return null;
  return bits.slice(1, 9).reduce((a, b) => a * 2 + b, 0);
}
(window as any).runFixture = async (name: string, maxPages: number) => {
  const blob = await (await fetch('/fx/' + name)).blob();
  const file = new File([blob], name, { type: 'application/pdf' });
  const t0 = performance.now();
  try {
    const progress: number[] = [];
    const r = await renderPdfToImages(file, { maxPages, onProgress: (d) => progress.push(d) });
    const markers = [];
    for (const u of r.images) markers.push(await decodeMarker(u));
    const body = JSON.stringify({ assessmentId: '00000000-0000-4000-8000-000000000000', subject: 'Mathematics', gradeLevel: 'Class 10', language: 'English', pageUrls: r.images });
    return { name, ok: true, pdfPages: r.totalPages, images: r.images.length, markers, progressEvents: progress.length, requestBytes: body.length, ms: Math.round(performance.now() - t0) };
  } catch (e: any) {
    return { name, ok: false, code: e?.code ?? null, error: String(e?.message ?? e).slice(0, 160), ms: Math.round(performance.now() - t0) };
  }
};
(window as any).ready = true;
`,
);

const esbuild = join(repo, 'node_modules/.bin/esbuild');
await new Promise((ok, fail) => {
    const p = spawn(esbuild, [entry, '--bundle', '--format=esm', `--outfile=${join(work, 'www/bundle.js')}`, `--alias:@=${join(repo, 'src')}`, '--log-level=warning'], { stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? ok() : fail(new Error(`esbuild exit ${c}`))));
});
// `new URL('pdfjs-dist/legacy/build/…', import.meta.url)` resolves next to the bundle.
cpSync(join(repo, 'node_modules/pdfjs-dist/legacy'), join(work, 'www/pdfjs-dist/legacy'), { recursive: true });
cpSync(join(repo, 'node_modules/pdfjs-dist/build'), join(work, 'www/pdfjs-dist/build'), { recursive: true });
writeFileSync(join(work, 'www/index.html'), '<!doctype html><script type="module" src="/bundle.js"></script>');

const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.pdf': 'application/pdf' };
const server = createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const path = url.startsWith('/fx/') ? join(fixtures, url.slice(4)) : join(work, 'www', url === '/' ? 'index.html' : url);
    if (!existsSync(path)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' }).end(readFileSync(path));
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const port = server.address().port;

const { chromium } = await import(join(repo, 'node_modules/playwright/index.mjs'));
const exe = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage();
console.log(JSON.stringify({ browser: browser.version(), hasGetOrInsertComputed: await page.evaluate(() => typeof Map.prototype.getOrInsertComputed === 'function'), maxPages }));
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => window.ready === true);

let failed = false;
for (const name of readdirSync(fixtures).sort()) {
    const r = await page.evaluate(([n, m]) => window.runFixture(n, m), [name, maxPages]);
    console.log(JSON.stringify(r));
    if (r.ok && r.pdfPages > 1) {
        const inOrder = r.markers.every((m, i) => m === i + 1) && r.images === r.pdfPages;
        if (!inOrder) failed = true;
    }
    if (r.ok === false && /^(text|scanned|mixed)-\d+p\.pdf$/.test(name) && Number(name.match(/(\d+)p/)[1]) <= maxPages) {
        failed = true; // a PDF within the limit must render
    }
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
