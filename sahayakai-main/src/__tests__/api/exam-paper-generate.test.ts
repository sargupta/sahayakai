/**
 * @fileOverview Wire-contract tests for `POST /api/ai/exam-paper` — the generate
 * handler a teacher's "Generate" click actually hits. Forensic finding H12
 * (EPG-2026-07-17): only the Save (PUT) handler had tests; the POST generate
 * route had zero. Covers: the response allow-list forwards the report fields
 * (incl. `newVerification`, previously dropped), 401 auth, 400 validation, the
 * 202 in-progress mapping, and the H5 kill-switch 503.
 *
 * Follows the spy-on-NextResponse.json pattern from exam-paper-save.test.ts and
 * assessment-scanner.test.ts — the jsdom env doesn't preserve NextResponse bodies.
 */

const jsonSpy = jest.fn();
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init: any) => {
      jsonSpy(data, init);
      return {
        status: init?.status ?? 200,
        ok: (init?.status ?? 200) < 400,
        json: async () => data,
        headers: new Map(),
      };
    },
  },
}));

// Plan guard as a pass-through so the generate handler runs unwrapped.
jest.mock('@/lib/plan-guard', () => ({ withPlanCheck: () => (h: any) => h }));

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

jest.mock('@/lib/ai-error-response', () => ({
  handleAIError: (_e: any) => ({ status: 500, ok: false, json: async () => ({ error: 'x' }) }),
  logAIError: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

// Only reached by the whole-syllabus (empty-chapters) anchor guard.
const mockFindBlueprint = jest.fn();
jest.mock('@/ai/data/board-blueprints', () => ({
  findBlueprint: (...a: any[]) => mockFindBlueprint(...a),
}));
const mockCanonicaliseGrade = jest.fn();
const mockCanonicaliseSubject = jest.fn();
const mockGetChaptersForCell = jest.fn();
jest.mock('@/ai/data/ncert-chapters', () => ({
  canonicaliseGrade: (...a: any[]) => mockCanonicaliseGrade(...a),
  canonicaliseSubject: (...a: any[]) => mockCanonicaliseSubject(...a),
  getChaptersForCell: (...a: any[]) => mockGetChaptersForCell(...a),
}));

// Imports AFTER mocks.
import { POST } from '@/app/api/ai/exam-paper/route';
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

function makeRequest(body: unknown, opts: { userId?: string | null } = {}): Request {
  const { userId = 'teacher-uid' } = opts;
  const headers = new Map<string, string>();
  if (userId) headers.set('x-user-id', userId);
  return {
    headers: { get: (k: string) => headers.get(k) },
    json: async () => body,
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  (isFeatureEnabled as jest.Mock).mockResolvedValue({ enabled: true });
});

describe('POST /api/ai/exam-paper — Generate handler', () => {
  it('200: forwards the report allow-list incl. newVerification + validationWarnings', async () => {
    mockDispatch.mockResolvedValue(FAKE_PAPER);
    const res = await POST(makeRequest(VALID_BODY) as any);
    expect(res.status).toBe(200);
    const [payload] = jsonSpy.mock.calls[0];
    expect(payload.marksReconciliation).toEqual(FAKE_PAPER.marksReconciliation);
    expect(payload.newVerification).toEqual(FAKE_PAPER.newVerification);
    expect(payload.validationWarnings).toEqual(FAKE_PAPER.validationWarnings);
  });

  it('401 when x-user-id is missing', async () => {
    const res = await POST(makeRequest(VALID_BODY, { userId: null }) as any);
    expect(res.status).toBe(401);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('400 when board is missing', async () => {
    const { board, ...noBoard } = VALID_BODY;
    const res = await POST(makeRequest(noBoard) as any);
    expect(res.status).toBe(400);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('400 with an entirely empty body (paperDesc falls back to "Unknown Paper")', async () => {
    const res = await POST(makeRequest({}) as any);
    expect(res.status).toBe(400);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('202 in-progress: maps ExamPaperGenerationInProgressError', async () => {
    mockDispatch.mockRejectedValue(new MockInProgress(75000, 80000));
    const res = await POST(makeRequest(VALID_BODY) as any);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.error).toBe('generation_in_progress');
  });

  it('503 kill switch (H5): disabled feature flag', async () => {
    (isFeatureEnabled as jest.Mock).mockResolvedValue({ enabled: false, reason: 'off' });
    const res = await POST(makeRequest(VALID_BODY) as any);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('Feature disabled');
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('400 on invalid JSON in the request body', async () => {
    const badRequest = {
      headers: { get: (k: string) => (k === 'x-user-id' ? 'teacher-uid' : null) },
      json: async () => { throw new SyntaxError('Unexpected token'); },
    } as unknown as Request;

    const res = await POST(badRequest);

    expect(res.status).toBe(400);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('defaults a non-array chapters field to [] instead of 500ing', async () => {
    mockFindBlueprint.mockResolvedValue({ chapterWeightage: { 'Real Numbers': 1 } });
    mockDispatch.mockResolvedValue(FAKE_PAPER);

    const res = await POST(makeRequest({ ...VALID_BODY, chapters: 'not-an-array' }) as any);

    expect(res.status).toBe(200);
    expect(mockDispatch.mock.calls[0][0].chapters).toEqual([]);
  });

  it('400 on an invalid difficulty value', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, difficulty: 'extreme' }) as any);
    expect(res.status).toBe(400);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it.each([-1, 101, '50'])('400 on an invalid pyqRatio value: %p', async (pyqRatio) => {
    const res = await POST(makeRequest({ ...VALID_BODY, pyqRatio }) as any);
    expect(res.status).toBe(400);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('422: maps a SchemaValidationError to exam_paper_unstructured', async () => {
    mockDispatch.mockRejectedValue(
      Object.assign(new Error('bad output'), {
        name: 'SchemaValidationError',
        errorCode: 'AI-SCHEMA-001',
        context: { validationErrors: { rawOutput: 'raw text', parseErrors: ['e1'], expectedSchema: 'Foo' } },
      }),
    );

    const res = await POST(makeRequest(VALID_BODY) as any);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe('SCHEMA_VALIDATION_FAILED');
  });

  it('422: stringifies a non-string rawOutput before logging it', async () => {
    mockDispatch.mockRejectedValue(
      Object.assign(new Error('bad output'), {
        name: 'SchemaValidationError',
        errorCode: 'AI-SCHEMA-001',
        context: { validationErrors: { rawOutput: { sections: [] }, parseErrors: ['e1'] } },
      }),
    );

    const res = await POST(makeRequest(VALID_BODY) as any);

    expect(res.status).toBe(422);
  });

  it('422: tolerates a SchemaValidationError with no context/validationErrors at all', async () => {
    mockDispatch.mockRejectedValue(
      Object.assign(new Error('bad output'), { name: 'SchemaValidationError', errorCode: 'AI-SCHEMA-001' }),
    );

    const res = await POST(makeRequest(VALID_BODY) as any);

    expect(res.status).toBe(422);
  });

  it('falls through to handleAIError for any other thrown error', async () => {
    mockDispatch.mockRejectedValue(new Error('totally unexpected'));

    const res = await POST(makeRequest(VALID_BODY) as any);

    expect(res.status).toBe(500);
  });

  describe('unblueprinted-subject chapter gate (empty chapters)', () => {
    const WHOLE_SYLLABUS_BODY = { ...VALID_BODY, chapters: [] };

    it('proceeds when a board blueprint anchors the whole-syllabus request', async () => {
      mockFindBlueprint.mockResolvedValue({ chapterWeightage: { 'Real Numbers': 1 } });
      mockDispatch.mockResolvedValue(FAKE_PAPER);

      const res = await POST(makeRequest(WHOLE_SYLLABUS_BODY) as any);

      expect(res.status).toBe(200);
      expect(mockDispatch).toHaveBeenCalled();
    });

    it('proceeds when the NCERT chapter seed anchors it (no blueprint)', async () => {
      mockFindBlueprint.mockResolvedValue(undefined);
      mockCanonicaliseGrade.mockReturnValue(10);
      mockCanonicaliseSubject.mockReturnValue('Mathematics');
      mockGetChaptersForCell.mockReturnValue([{ title: 'Real Numbers' }]);
      mockDispatch.mockResolvedValue(FAKE_PAPER);

      const res = await POST(makeRequest(WHOLE_SYLLABUS_BODY) as any);

      expect(res.status).toBe(200);
      expect(mockDispatch).toHaveBeenCalled();
    });

    it('400s with chapters_required_for_unblueprinted_subject when neither anchors it', async () => {
      mockFindBlueprint.mockResolvedValue(undefined);
      mockCanonicaliseGrade.mockReturnValue(null);
      mockCanonicaliseSubject.mockReturnValue(null);
      mockGetChaptersForCell.mockReturnValue([]);

      const res = await POST(makeRequest(WHOLE_SYLLABUS_BODY) as any);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('chapters_required_for_unblueprinted_subject');
      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });
});
