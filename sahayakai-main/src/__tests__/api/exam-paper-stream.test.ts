/** @jest-environment node */
/**
 * @fileOverview Wire-contract tests for `POST /api/ai/exam-paper/stream` — the
 * SSE progress-streaming generate route. Forensic finding H12 (EPG-2026-07-17):
 * only the Save (PUT) handler had tests; this stream route (and the non-stream
 * POST) had zero. Covers: 401 auth, the H5 kill-switch 503, the happy-path
 * `complete` event forwarding `newVerification`, and the H3.2 in-progress event
 * that must NOT roll back the reserved quota (the paper is still generating).
 *
 * Runs under the node env so the route's real ReadableStream / TextEncoder work.
 */

// H5 kill switch — defaulted to enabled in beforeEach, overridden per-test.
jest.mock('@/lib/feature-flags', () => ({ isFeatureEnabled: jest.fn() }));

// Real in-progress error so the route can read error.budgetMs/elapsedMs. A
// hoisted function (not `class`) so jest can reference it in the mock factory
// it hoists above this line without hitting the class's temporal dead zone.
function MockInProgress(this: any, b = 1000, e = 2000) {
  this.name = 'MockInProgress';
  this.message = 'in progress';
  this.budgetMs = b;
  this.elapsedMs = e;
}
MockInProgress.prototype = Object.create(Error.prototype);
const mockDispatch = jest.fn();
jest.mock('@/lib/sidecar/exam-paper-dispatch', () => ({
  dispatchExamPaper: (...a: any[]) => mockDispatch(...a),
  ExamPaperGenerationInProgressError: MockInProgress,
}));

// Module-level rollback spy so a test can assert it was NOT called.
const mockRollback = jest.fn();
jest.mock('@/lib/plan-guard', () => ({
  reservePlanQuota: jest.fn(async () => ({ ok: true, rollback: mockRollback })),
}));

jest.mock('@/lib/ai-error-response', () => ({
  classifyAIError: (_e: any) => ({ code: 'X', message: 'x' }),
  logAIError: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

// Imports AFTER mocks.
import { POST } from '@/app/api/ai/exam-paper/stream/route';
import { isFeatureEnabled } from '@/lib/feature-flags';

const VALID_BODY = {
  board: 'CBSE',
  gradeLevel: 'Class 10',
  subject: 'Mathematics',
  chapters: ['Real Numbers'],
};

const FAKE_PAPER = {
  contentId: 'cid-123',
  title: 'CBSE Class 10 Mathematics',
  board: 'CBSE',
  subject: 'Mathematics',
  gradeLevel: 'Class 10',
  duration: '3 hours',
  maxMarks: 80,
  generalInstructions: ['Attempt all questions.'],
  sections: [{ name: 'A', questions: [] }],
  blueprintSummary: 'CBSE blueprint',
  pyqSources: [],
  marksReconciliation: { expected: 80, actual: 80, drift: 0 },
  answerKeyCompleteness: { total: 0, withAnswerKey: 0 },
  validationWarnings: ['warn-a'],
  newVerification: { relabeled: 1 },
};

// jest.setup.ts stubs global.Response with a body-less version, which drops
// the SSE ReadableStream. Restore a minimal Response that preserves `body` and
// `status` so drain() can read the stream. Scoped to this test module's global.
(global as any).Response = class {
  body: unknown;
  status: number;
  constructor(body: unknown, init?: { status?: number }) {
    this.body = body;
    this.status = init?.status ?? 200;
  }
};

function makeRequest(body: unknown, opts: { userId?: string | null } = {}): Request {
  const { userId = 'teacher-uid' } = opts;
  const headers = new Map<string, string>();
  if (userId) headers.set('x-user-id', userId);
  return {
    headers: { get: (k: string) => headers.get(k) },
    json: async () => body,
  } as unknown as Request;
}

async function drain(res: Response) {
  const reader = (res.body as ReadableStream).getReader();
  const dec = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += dec.decode(value);
  }
  return text
    .split('\n\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => JSON.parse(l.replace(/^data: /, '')));
}

beforeEach(() => {
  jest.clearAllMocks();
  (isFeatureEnabled as jest.Mock).mockResolvedValue({ enabled: true });
});

describe('POST /api/ai/exam-paper/stream — SSE generate handler', () => {
  it('401 when x-user-id is missing', async () => {
    const res = (await POST(makeRequest(VALID_BODY, { userId: null }) as any)) as Response;
    expect(res.status).toBe(401);
  });

  it('503 kill switch (H5): disabled feature flag', async () => {
    (isFeatureEnabled as jest.Mock).mockResolvedValue({ enabled: false });
    const res = (await POST(makeRequest(VALID_BODY) as any)) as Response;
    expect(res.status).toBe(503);
  });

  it('happy path: ends with a complete event forwarding newVerification', async () => {
    mockDispatch.mockResolvedValue(FAKE_PAPER);
    const res = (await POST(makeRequest(VALID_BODY) as any)) as Response;
    const events = await drain(res);
    const complete = events[events.length - 1];
    expect(complete.type).toBe('complete');
    expect(complete.data.newVerification).toEqual(FAKE_PAPER.newVerification);
  });

  it('H3.2 in_progress: emits in_progress event and keeps the quota reservation', async () => {
    mockDispatch.mockRejectedValue(new MockInProgress());
    const res = (await POST(makeRequest(VALID_BODY) as any)) as Response;
    const events = await drain(res);
    expect(events.some((e) => e.type === 'in_progress')).toBe(true);
    expect(events.some((e) => e.type === 'error')).toBe(false);
    expect(mockRollback).not.toHaveBeenCalled();
  });
});
