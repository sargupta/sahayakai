#!/usr/bin/env node
/**
 * Local end-to-end check of the Assessment Scanner's multi-page path against a
 * running `next dev` (NODE_ENV=development, so the documented `dev-token`
 * bypass applies). Uses synthetic PDFs only. Makes NO AI/model calls: the
 * browser's grading request is captured and checked, forwarded once to the
 * real API route (which validates it and then stops at the AI step if no model
 * credentials are configured), and the browser is shown a clearly-synthetic
 * graded result built from the pages it actually sent.
 *
 *   python3 scripts/assessment-scanner/make-synthetic-pdfs.py /tmp/scan-fixtures
 *   # app running: npx next dev -p 3000   (with FIRESTORE_EMULATOR_HOST for plan checks)
 *   node scripts/assessment-scanner/verify-local-e2e.mjs /tmp/scan-fixtures [http://localhost:3000]
 *
 * Exit 1 if any check fails. Every check prints one line: PASS/FAIL + detail.
 */
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const require = createRequire(join(repo, 'package.json'));
const sharp = require('sharp');
const { chromium } = await import(join(repo, 'node_modules/playwright/index.mjs'));

const fx = resolve(process.argv[2] ?? 'synthetic-pdfs');
const BASE = process.argv[3] ?? 'http://localhost:3000';
const CAP = 10;
let failures = 0;
const check = (ok, label, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

/** Read the page-number marker band the fixture generator draws on every page. */
async function decodeMarker(dataUri) {
    const buf = Buffer.from(dataUri.slice(dataUri.indexOf(',') + 1), 'base64');
    const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const bits = [];
    for (let i = 0; i < 10; i++) {
        const x = Math.round((0.06 + i * 0.088 + 0.088 * 0.45) * info.width);
        const y = Math.round(0.05 * info.height);
        const o = (y * info.width + x) * info.channels;
        bits.push((data[o] + data[o + 1] + data[o + 2]) / 3 < 128 ? 1 : 0);
    }
    if (bits[0] !== 1 || bits[9] !== 0) return null;
    return bits.slice(1, 9).reduce((a, b) => a * 2 + b, 0);
}

function syntheticResult(assessmentId, pageNumbers) {
    return {
        assessmentId,
        status: 'graded',
        pageCount: pageNumbers.length,
        totalAwardedMarks: pageNumbers.length,
        totalMaxMarks: pageNumbers.length,
        scorePct: 100,
        letterGrade: 'A+',
        questions: pageNumbers.map((n, i) => ({
            questionId: `p${i}-q1`, pageIndex: i, questionType: 'short_answer',
            questionText: `SYNTHETIC RESULT for uploaded page ${n}`, studentAnswer: `answer ${n}`,
            expectedAnswer: `answer ${n}`, marksAwarded: 1, marksMax: 1, partialCreditBreakdown: [],
            feedback: 'Synthetic (no AI call made).', improvementPoints: [], conceptTested: 'synthetic',
            ncertChapterId: null, mistakePattern: 'none', needsTeacherReview: false, confidence: 0.9,
        })),
        classAverageAtScan: null, conceptMastery: [], recommendedNextSteps: [], studentRecommendations: [],
        teacherParentNote: [], needsReviewCount: 0, imageQualityWarnings: [], skippedPageNotices: [],
    };
}

async function postScan(body) {
    const res = await fetch(`${BASE}/api/ai/assessment-scanner`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer dev-token' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    let json = null;
    try { json = await res.json(); } catch { /* non-JSON */ }
    return { status: res.status, json };
}

const exe = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } });
console.log(`browser ${browser.version()} · app ${BASE}`);

// ── 1. Upload a 5-page PDF in the real page ────────────────────────────────
await page.goto(`${BASE}/assessment-scanner`, { waitUntil: 'networkidle', timeout: 240_000 });
await page.getByText(`up to ${CAP} pages per scan`).first().waitFor({ timeout: 180_000 });
check(true, `banner states the real cap (up to ${CAP} pages per scan)`);
check((await page.getByText(/up to 3 pages per scan/).count()) === 0, 'stale "up to 3 pages" copy is gone');

const input = page.locator('input[type="file"]').first();
await input.setInputFiles(join(fx, 'text-5p.pdf'));
await page.getByText(`5 / ${CAP}`).waitFor({ timeout: 60_000 });
check(true, 'text-5p.pdf → counter shows 5 / 10');
const badges = await page.locator('text=/^Page \\d+$/').allTextContents();
check(badges.join(',') === 'Page 1,Page 2,Page 3,Page 4,Page 5', 'five page thumbnails in order', badges.join(','));
await page.screenshot({ path: join(fx, '..', 'e2e-1-five-pages-added.png'), fullPage: false });

// ── 2. Submit: capture the request, check every page, forward once to the real route ──
let captured = null;
let forwarded = null;
await page.route('**/api/ai/assessment-scanner', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    const markers = [];
    for (const u of body.pageUrls ?? []) markers.push(await decodeMarker(u));
    captured = { body, markers, bytes: (route.request().postData() ?? '').length };
    forwarded = await postScan(body); // real middleware + route; stops at the AI step without credentials
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(syntheticResult(body.assessmentId, markers)) });
});
await page.getByRole('button', { name: /Grade this assessment/ }).click();
await page.getByText('SYNTHETIC RESULT for uploaded page 5').waitFor({ timeout: 60_000 });
check(captured?.body.pageUrls.length === 5, 'request carries 5 pages', `${captured?.bytes} bytes`);
check(JSON.stringify(captured?.markers) === '[1,2,3,4,5]', 'request pages are PDF pages 1..5 in order (decoded from pixels)', JSON.stringify(captured?.markers));
check(captured?.body.pageUrls.every((u) => u.startsWith('data:image/jpeg;base64,')), 'every page is a JPEG data URI (no PDF sent to the server)');
console.log(`INFO  same 5-page request sent to the real route: HTTP ${forwarded?.status} ${JSON.stringify(forwarded?.json)?.slice(0, 200)}`);
check(forwarded && forwarded.status !== 400 && forwarded.status !== 413, 'real route accepts the 5-page request (no page-limit / format / size rejection)', `HTTP ${forwarded?.status}`);
for (const n of [1, 2, 3, 4, 5]) {
    check((await page.getByText(`SYNTHETIC RESULT for uploaded page ${n}`).count()) === 1, `result shows page ${n}`);
}
await page.screenshot({ path: join(fx, '..', 'e2e-2-result-all-pages.png'), fullPage: true });
await page.unroute('**/api/ai/assessment-scanner');

// ── 3. Rejections in the real page (nothing added) ─────────────────────────
for (const [file, expectText] of [
    ['text-11p.pdf', 'This PDF has 11 pages, but only'],
    ['encrypted-4p.pdf', 'password-protected'],
    ['corrupt.pdf', 'Could not open this PDF'],
    ['empty-0p.pdf', 'This PDF has no pages to add.'],
    ['oversize-60mb.pdf', 'the limit is 50 MB'],
]) {
    await page.goto(`${BASE}/assessment-scanner`, { waitUntil: 'networkidle', timeout: 240_000 });
    await page.getByText(`0 / ${CAP}`).waitFor({ timeout: 120_000 });
    await page.locator('input[type="file"]').first().setInputFiles(join(fx, file));
    const shown = await page.getByText(expectText, { exact: false }).first().waitFor({ timeout: 60_000 }).then(() => true, () => false);
    const still0 = (await page.getByText(`0 / ${CAP}`).count()) === 1;
    check(shown && still0, `${file} → clear error, nothing added`);
}
await page.screenshot({ path: join(fx, '..', 'e2e-3-oversize-rejected.png') });

// ── 4. The API directly (real middleware + route), no AI reached ───────────
const jpeg = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#eee' } }).jpeg().toBuffer();
const tiny = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
const base = { assessmentId: '550e8400-e29b-41d4-a716-446655440000', subject: 'Mathematics', gradeLevel: 'Class 5', language: 'English' };
let r = await postScan({ ...base, pageUrls: Array(CAP + 1).fill(tiny) });
check(r.status === 400 && r.json?.code === 'PAGE_LIMIT_EXCEEDED' && r.json?.maxPages === CAP, `API: ${CAP + 1} pages → 400 PAGE_LIMIT_EXCEEDED (maxPages ${CAP})`, `HTTP ${r.status} ${r.json?.code}`);
r = await postScan({ ...base, pageUrls: [tiny, 'data:application/pdf;base64,JVBERi0xLjQK'] });
check(r.status === 400 && r.json?.code === 'UNSUPPORTED_PAGE_FORMAT' && r.json?.pageNumber === 2, 'API: a whole PDF as page 2 → 400 UNSUPPORTED_PAGE_FORMAT', `HTTP ${r.status} ${r.json?.code}`);
r = await postScan(JSON.stringify({ ...base, pageUrls: [`data:image/jpeg;base64,${'A'.repeat(12 * 1024 * 1024)}`] }));
check(r.status === 413 && r.json?.code === 'PAYLOAD_TOO_LARGE', 'API: 12 MB body → 413 PAYLOAD_TOO_LARGE (middleware body limit)', `HTTP ${r.status} ${r.json?.code}`);

await browser.close();
console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
process.exit(failures ? 1 : 0);
