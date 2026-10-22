/** @jest-environment node */
/**
 * Multi-page Assessment Scanner — route → dispatcher → flow, end to end.
 *
 * Founder report: "only three pages can be processed". This suite drives the
 * REAL route handler, the REAL dispatcher (with the production flag shape:
 * sidecar `canary`) and the REAL two-pass flow. Only the model calls are faked,
 * and the fake Pass 1 does not trust `pageIndex`: it decodes a page-number
 * marker from the PIXELS of the image it was given. So a question reading
 * "SYNTH page 7" in the response proves page 7's image reached Pass 1, was
 * extracted, graded in Pass 2 and returned under pageIndex 6 — i.e. that pages
 * after the third are not dropped, reordered or mislabelled anywhere server-side.
 *
 * Class gate for the bug: any future cap, slice or routing that loses pages
 * beyond N fails the 4 / 5 / 10-page cases here.
 */
import sharp from 'sharp';

const mockPass1 = jest.fn();
const mockPass2 = jest.fn();
const mockSidecar = jest.fn();

jest.mock('@/ai/genkit', () => ({
    ai: {
        definePrompt: (def: { name: string }) => (input: unknown, config: unknown) => {
            if (def.name === 'assessmentScannerPass1') return mockPass1(input, config);
            if (def.name === 'assessmentScannerPass2') return mockPass2(input, config);
            throw new Error(`Unexpected prompt ${def.name}`);
        },
    },
    runResiliently: (fn: (cfg: { config: Record<string, unknown> }) => unknown) =>
        fn({ config: {} }),
}));

jest.mock('@/lib/plan-guard', () => ({
    withPlanCheck: () => (handler: (req: Request) => Promise<Response>) => handler,
}));
jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.mock('@/lib/feature-flags', () => ({
    // Production values read from system_config/feature_flags on 2026-10-22.
    getFeatureFlags: jest.fn(async () => ({
        assessmentScannerSidecarMode: 'canary',
        assessmentScannerSidecarPercent: 100, // every test teacher in the canary bucket
    })),
    isFeatureEnabled: jest.fn(async () => ({ enabled: true })), // demo mode → cap 10
}));
jest.mock('@/lib/sidecar/assessment-scanner-client', () => {
    class AssessmentScannerSidecarConfigError extends Error {}
    class AssessmentScannerSidecarTimeoutError extends Error {}
    class AssessmentScannerSidecarHttpError extends Error {
        status = 500;
    }
    return {
        callSidecarAssessmentScanner: (...a: unknown[]) => mockSidecar(...a),
        AssessmentScannerSidecarConfigError,
        AssessmentScannerSidecarTimeoutError,
        AssessmentScannerSidecarHttpError,
    };
});
jest.mock('@/lib/sidecar/shadow-diff-writer', () => ({ writeAgentShadowDiff: jest.fn() }));
jest.mock('@/lib/sidecar/canary-shadow-diff', () => ({ shouldRunCanaryShadowDiff: () => false }));
jest.mock('@/data/ncert', () => ({
    getChapterById: jest.fn(() => null),
    getChaptersForGrade: jest.fn(() => []),
}));
jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        saveContent: jest.fn().mockResolvedValue(undefined),
        getUser: jest.fn().mockResolvedValue(null),
    },
}));
jest.mock('@/lib/firebase-admin', () => ({
    getDb: jest.fn().mockResolvedValue({
        collection: () => ({
            doc: () => ({
                collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }) }),
            }),
        }),
    }),
}));
jest.mock('firebase-admin/firestore', () => ({ Timestamp: { fromDate: (d: Date) => d } }));

const jsonSpy = jest.fn();
jest.mock('next/server', () => ({
    NextResponse: {
        json: (data: unknown, init?: { status?: number }) => {
            jsonSpy(data, init);
            return { status: init?.status ?? 200, json: async () => data };
        },
    },
}));

import { POST } from '@/app/api/ai/assessment-scanner/route';
import { ASSESSMENT_DEMO_PAGE_CAP } from '@/ai/schemas/assessment-scanner-constants';

// ── Synthetic pages: a 10-cell marker band (start=dark, 8 bits, end=light) ────
const W = 240;
const H = 320;
const CELL_W = 20;
const BAND_Y0 = 10;
const BAND_Y1 = 40;

async function syntheticPage(pageNumber: number): Promise<string> {
    const px = Buffer.alloc(W * H * 3, 235);
    const bits = [1, ...Array.from({ length: 8 }, (_, i) => (pageNumber >> (7 - i)) & 1), 0];
    bits.forEach((bit, cell) => {
        const v = bit ? 15 : 225;
        for (let y = BAND_Y0; y < BAND_Y1; y++) {
            for (let x = cell * CELL_W + 2; x < (cell + 1) * CELL_W - 2; x++) {
                px.fill(v, (y * W + x) * 3, (y * W + x) * 3 + 3);
            }
        }
    });
    const jpeg = await sharp(px, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 80 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

async function decodePageNumber(dataUri: string): Promise<number> {
    const b64 = dataUri.slice(dataUri.indexOf(',') + 1);
    const { data } = await sharp(Buffer.from(b64, 'base64'))
        .raw()
        .toBuffer({ resolveWithObject: true });
    const y = Math.round((BAND_Y0 + BAND_Y1) / 2);
    const bits = Array.from({ length: 10 }, (_, cell) => {
        const x = cell * CELL_W + CELL_W / 2;
        return data[(y * W + x) * 3] < 128 ? 1 : 0;
    });
    if (bits[0] !== 1 || bits[9] !== 0) throw new Error('page marker not found');
    return bits.slice(1, 9).reduce((a, b) => a * 2 + b, 0);
}

// ── Fake model: reads the page from the image, grades what Pass 1 extracted ──
let inFlight = 0;
let peakInFlight = 0;
let failPageNumbers = new Set<number>();
const pass1PageNumbers: number[] = [];

function installFakeModel() {
    mockPass1.mockImplementation(
        async (input: { pages: Array<{ pageIndex: number; imageDataUri: string }> }) => {
            inFlight++;
            peakInFlight = Math.max(peakInFlight, inFlight);
            try {
                const page = input.pages[0];
                const n = await decodePageNumber(page.imageDataUri);
                pass1PageNumbers.push(n);
                await new Promise((r) => setTimeout(r, 5 + ((n * 7) % 4) * 5)); // finish out of order
                if (failPageNumbers.has(n)) {
                    throw Object.assign(new Error('model returned malformed output'), { status: 500 });
                }
                return {
                    output: {
                        pages: [
                            {
                                pageIndex: page.pageIndex,
                                pageType: 'mixed',
                                handwritingConfidence: 0.9,
                                imageQualityIssues: ['none'],
                                detectedLanguage: 'en',
                                questions: [1, 2].map((q) => ({
                                    questionId: `p${page.pageIndex}-q${q}`,
                                    questionType: 'short_answer',
                                    questionText: `SYNTH page ${n} question ${q}`,
                                    questionTextConfidence: 0.95,
                                    studentAnswerRaw: `answer ${n}.${q}`,
                                    studentAnswerInterpreted: `answer ${n}.${q}`,
                                    answerConfidence: 0.95,
                                    isAttempted: true,
                                })),
                            },
                        ],
                    },
                };
            } finally {
                inFlight--;
            }
        },
    );
    mockPass2.mockImplementation(async (input: { extractedPages: string }) => {
        const pages = JSON.parse(input.extractedPages) as Array<{
            pageIndex: number;
            questions: Array<{ questionId: string }>;
        }>;
        return {
            output: {
                questions: pages.flatMap((p) =>
                    p.questions.map((q) => ({
                        questionId: q.questionId,
                        pageIndex: p.pageIndex,
                        expectedAnswer: 'x',
                        marksAwarded: 1,
                        marksMax: 1,
                        partialCreditBreakdown: [],
                        feedback: 'Correct.',
                        conceptTested: 'Synthetic',
                        ncertChapterId: null,
                        mistakePattern: 'none',
                        needsTeacherReview: false,
                        confidence: 0.95,
                    })),
                ),
                recommendedNextSteps: [],
                studentRecommendations: [],
            },
        };
    });
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function makeRequest(body: unknown): Request {
    return {
        json: async () => body,
        headers: { get: (k: string) => (k === 'x-user-id' ? 'synthetic-teacher' : null) },
    } as unknown as Request;
}

async function scan(pageUrls: string[]) {
    const res = (await POST(
        makeRequest({
            assessmentId: VALID_UUID,
            subject: 'Mathematics',
            gradeLevel: 'Class 5',
            language: 'English',
            pageUrls,
        }),
    )) as unknown as { status: number; json: () => Promise<Record<string, any>> };
    return { status: res.status, body: await res.json() };
}

let pagesCache: string[] = [];
beforeAll(async () => {
    pagesCache = await Promise.all(
        Array.from({ length: ASSESSMENT_DEMO_PAGE_CAP + 1 }, (_, i) => syntheticPage(i + 1)),
    );
});

beforeEach(() => {
    jest.clearAllMocks();
    inFlight = 0;
    peakInFlight = 0;
    failPageNumbers = new Set();
    pass1PageNumbers.length = 0;
    installFakeModel();
    mockSidecar.mockImplementation(async (req: { pageUrls: string[]; assessmentId: string }) => ({
        assessmentId: req.assessmentId,
        status: 'graded',
        pageCount: req.pageUrls.length,
        totalAwardedMarks: 1,
        totalMaxMarks: 1,
        scorePct: 100,
        letterGrade: 'A+',
        questions: [
            {
                questionId: 'p0-q1', pageIndex: 0, questionType: 'short_answer',
                questionText: 'sidecar', studentAnswer: 'a', expectedAnswer: 'a',
                marksAwarded: 1, marksMax: 1, partialCreditBreakdown: [], feedback: 'ok',
                improvementPoints: [], conceptTested: 'c', ncertChapterId: null,
                mistakePattern: 'none', needsTeacherReview: false, confidence: 0.9,
            },
        ],
        classAverageAtScan: null,
        conceptMastery: [],
        recommendedNextSteps: [],
        studentRecommendations: [],
        teacherParentNote: [],
        needsReviewCount: 0,
        imageQualityWarnings: [],
        skippedPageNotices: [],
        sidecarVersion: 'test',
        latencyMs: 1,
        modelUsed: 'test',
    }));
});

describe('multi-page scans beyond the old three-page boundary', () => {
    it.each([4, 5, ASSESSMENT_DEMO_PAGE_CAP])(
        '%i pages: every page is extracted, graded and returned in page order',
        async (n) => {
            const { status, body } = await scan(pagesCache.slice(0, n));

            expect(status).toBe(200);
            expect(mockSidecar).not.toHaveBeenCalled(); // >3 pages never routed to the 3-page sidecar
            expect(body.status).toBe('graded');
            expect(body.pageCount).toBe(n);
            expect([...pass1PageNumbers].sort((a, b) => a - b)).toEqual(
                Array.from({ length: n }, (_, i) => i + 1),
            );
            // Two questions per page, every page present, in page order, and the
            // text on each came from THAT page's pixels.
            expect(body.questions).toHaveLength(2 * n);
            body.questions.forEach((q: { pageIndex: number; questionText: string }, i: number) => {
                const pageIndex = Math.floor(i / 2);
                expect(q.pageIndex).toBe(pageIndex);
                expect(q.questionText).toBe(`SYNTH page ${pageIndex + 1} question ${(i % 2) + 1}`);
            });
            // Content from page 4 onward reached the final result.
            const pagesInResult = new Set(body.questions.map((q: { pageIndex: number }) => q.pageIndex + 1));
            for (let p = 4; p <= n; p++) expect(pagesInResult.has(p)).toBe(true);
            expect(body.totalAwardedMarks).toBe(2 * n);
            expect(body.totalMaxMarks).toBe(2 * n);
            expect(body.skippedPageNotices).toEqual([]);
        },
    );

    it('3 pages (the old boundary) still go to the canary sidecar unchanged', async () => {
        const { status } = await scan(pagesCache.slice(0, 3));
        expect(status).toBe(200);
        expect(mockSidecar).toHaveBeenCalledTimes(1);
        expect(mockPass1).not.toHaveBeenCalled();
    });

    it(`${ASSESSMENT_DEMO_PAGE_CAP + 1} pages are rejected whole with a clear 400, nothing processed`, async () => {
        const { status, body } = await scan(pagesCache.slice(0, ASSESSMENT_DEMO_PAGE_CAP + 1));
        expect(status).toBe(400);
        expect(body.code).toBe('PAGE_LIMIT_EXCEEDED');
        expect(body.maxPages).toBe(ASSESSMENT_DEMO_PAGE_CAP);
        expect(body.receivedPages).toBe(ASSESSMENT_DEMO_PAGE_CAP + 1);
        expect(mockPass1).not.toHaveBeenCalled();
        expect(mockSidecar).not.toHaveBeenCalled();
    });

    it('Pass-1 model calls are bounded (never more in flight than the configured concurrency)', async () => {
        await scan(pagesCache.slice(0, ASSESSMENT_DEMO_PAGE_CAP));
        expect(peakInFlight).toBeGreaterThan(1); // pages really run in parallel
        expect(peakInFlight).toBeLessThanOrEqual(10); // ASSESSMENT_SCANNER_PASS1_CONCURRENCY default
    });
});

describe('partial failure is reported, never passed off as a complete scan', () => {
    it('model failure on an intermediate page (5 of 8) → status partial, page named, others graded', async () => {
        failPageNumbers = new Set([5]);
        const { status, body } = await scan(pagesCache.slice(0, 8));
        expect(status).toBe(200);
        expect(body.status).toBe('partial');
        expect(body.pageCount).toBe(8);
        const graded = new Set(body.questions.map((q: { pageIndex: number }) => q.pageIndex + 1));
        expect([...graded].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 6, 7, 8]);
        expect(body.skippedPageNotices).toEqual([
            expect.stringMatching(/^Page 5: couldn't be processed .*run the scan again/),
        ]);
    });

    it('a corrupt image on page 4 → partial, with the re-upload notice for page 4 only', async () => {
        const pages = pagesCache.slice(0, 6);
        pages[3] = 'data:image/jpeg;base64,AAAA';
        const { status, body } = await scan(pages);
        expect(status).toBe(200);
        expect(body.status).toBe('partial');
        expect(body.skippedPageNotices).toEqual([
            expect.stringMatching(/^Page 4: couldn't read this page \(image unclear or corrupt\)/),
        ]);
        expect(body.questions.some((q: { pageIndex: number }) => q.pageIndex === 3)).toBe(false);
        expect(body.questions.filter((q: { pageIndex: number }) => q.pageIndex === 5)).toHaveLength(2);
    });

    it('every page failing is an error response, never a 200 "graded" result', async () => {
        failPageNumbers = new Set([1, 2, 3, 4]);
        const { status, body } = await scan(pagesCache.slice(0, 4));
        expect(status).toBeGreaterThanOrEqual(400);
        expect(body.status).toBeUndefined();
    });
});

describe('input validation (server side, same rules as the website)', () => {
    it('rejects a whole PDF sent as one "page" instead of grading it as a single page', async () => {
        const { status, body } = await scan([
            pagesCache[0],
            'data:application/pdf;base64,JVBERi0xLjQK',
        ]);
        expect(status).toBe(400);
        expect(body.code).toBe('UNSUPPORTED_PAGE_FORMAT');
        expect(body.pageNumber).toBe(2);
        expect(body.message).toMatch(/whole PDF/);
        expect(mockPass1).not.toHaveBeenCalled();
    });

    it.each([
        ['a plain-http URL', 'http://example.com/p.jpg'],
        ['a text data URI', 'data:text/plain;base64,aGVsbG8='],
        ['a non-string entry', 42],
    ])('rejects %s with UNSUPPORTED_PAGE_FORMAT', async (_label, entry) => {
        const { status, body } = await scan([entry as string]);
        expect(status).toBe(400);
        expect(body.code).toBe('UNSUPPORTED_PAGE_FORMAT');
    });

    it('a truncated (oversized) request body is a 413 with an actionable message', async () => {
        const res = (await POST({
            json: async () => {
                throw new SyntaxError('Unterminated string in JSON at position 10485700');
            },
            headers: { get: (k: string) => (k === 'x-user-id' ? 'synthetic-teacher' : null) },
        } as unknown as Request)) as unknown as { status: number; json: () => Promise<Record<string, string>> };
        expect(res.status).toBe(413);
        expect((await res.json()).code).toBe('PAYLOAD_TOO_LARGE');
    });
});
