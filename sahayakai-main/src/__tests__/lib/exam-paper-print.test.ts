/**
 * @jest-environment jsdom
 *
 * Contract for the shared exam-paper print helpers. `buildExamPaperBodyHtml` must
 * emit every optional block only when its data is present (so a combined multi-set
 * doc stays legible), `wrapExamPaperDoc` must produce a valid paged document, and
 * `openPrintBlob` must print on success and fall back to a download when the popup
 * is blocked.
 */
import {
  buildExamPaperBodyHtml,
  wrapExamPaperDoc,
  openPrintBlob,
} from '@/lib/exam-paper-print';

const t = (k: string) => k; // identity, matching the app's key-as-fallback

const fullContent = {
  title: 'T & <Paper>',
  board: 'CBSE',
  gradeLevel: 'Class 10',
  subject: 'Mathematics',
  duration: '3 Hours',
  maxMarks: 20,
  generalInstructions: ['Do all', 'Neat work'],
  sections: [
    {
      name: 'Section A',
      label: 'MCQ',
      totalMarks: 4,
      instructions: 'Pick one',
      questions: [
        { number: 1, text: 'Q one', marks: 1, options: ['(a) x', '(b) y'], answerKey: '(a)', markingScheme: '1 for a' },
      ],
    },
  ],
};

describe('buildExamPaperBodyHtml', () => {
  test('renders every block when the data is present, with the set subtitle', () => {
    const html = buildExamPaperBodyHtml(fullContent, t, 'Set B');
    expect(html).toContain('Set B'); // subtitle in header
    expect(html).toContain('General Instructions');
    expect(html).toContain('Do all');
    expect(html).toContain('section-marks'); // name+label & totalMarks
    expect(html).toContain('MCQ');
    expect(html).toContain('section-instructions');
    expect(html).toContain('Pick one');
    expect(html).toContain('Q one');
    expect(html).toContain('class="options"');
    expect(html).toContain('(a) x');
    // answer key + marking scheme, tagged with the set subtitle
    expect(html).toContain('class="answer-key"');
    expect(html).toContain('Set B · Answer Key');
    expect(html).toContain('class="marking-scheme"');
    expect(html).toContain('Set B · Marking Scheme');
  });

  test('omits optional blocks when data is absent; escapes nullish + special chars', () => {
    const bare = {
      board: 'B & B',           // special chars → escaped
      gradeLevel: 'G',
      subject: 'S',
      duration: undefined,      // nullish → escapeHtml returns ''
      maxMarks: 10,
      generalInstructions: [],  // empty → no instructions block
      sections: [
        {
          name: 'Only Name',    // label falsy → no label subpart
          label: '',
          totalMarks: null,     // null → no section-marks line
          // no instructions, no options, no answerKey/markingScheme
          questions: [{ number: 1, text: 'plain', marks: 2 }],
        },
      ],
    };
    const html = buildExamPaperBodyHtml(bare, t); // no subtitle
    expect(html).not.toContain('General Instructions');
    expect(html).not.toContain('section-marks');
    expect(html).not.toContain('section-instructions');
    expect(html).not.toContain('class="options"');
    expect(html).not.toContain('class="answer-key"');
    expect(html).not.toContain('class="marking-scheme"');
    expect(html).toContain('B &amp; B');          // escaped
    expect(html).toContain('plain');
  });

  test('covers fallback sides: idx>0, name→label, undefined questions, questionNumber, empty text', () => {
    const variety = {
      board: 'B',
      gradeLevel: 'G',
      subject: 'S',
      duration: '1h',
      maxMarks: 5,
      generalInstructions: [],
      sections: [
        {
          name: 'First',
          label: 'L1',
          totalMarks: 2,
          // question uses legacy `questionNumber`, empty text, carries key + scheme
          questions: [{ questionNumber: 1, text: '', marks: 2, answerKey: 'ak', markingScheme: 'ms' }],
        },
        // second section: idx>0 (no section-first), name falsy → label used, questions undefined
        { name: '', label: 'Second', totalMarks: 3, questions: undefined },
      ],
    };
    const html = buildExamPaperBodyHtml(variety, t);
    expect(html).toContain('>Second<');            // section.name '' → label
    expect((html.match(/class="section"/g) || []).length).toBe(1); // 2nd section has no section-first
    expect(html).toContain('class="section section-first"');       // 1st does
    expect(html).toContain('Q1.');                 // number via questionNumber
    expect(html).toContain('ak');                  // answer key rendered
    expect(html).toContain('ms');                  // marking scheme rendered
  });

  test('answer key / marking scheme without a subtitle use the plain label', () => {
    const html = buildExamPaperBodyHtml(fullContent, t); // no subtitle
    expect(html).toContain('>Answer Key<');
    expect(html).toContain('>Marking Scheme<');
    expect(html).not.toContain(' · Answer Key');
  });
});

describe('wrapExamPaperDoc', () => {
  test('produces a paged document with an escaped title and set page-break rule', () => {
    const doc = wrapExamPaperDoc('A & B', '<p>body</p>');
    expect(doc.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(doc).toContain('<title>A &amp; B</title>');
    expect(doc).toContain('.exam-set + .exam-set { page-break-before: always; }');
    expect(doc).toContain('<p>body</p>');
  });
});

describe('openPrintBlob', () => {
  beforeEach(() => {
    (URL as any).createObjectURL = jest.fn(() => 'blob:x');
  });
  afterEach(() => jest.restoreAllMocks());

  test('prints when the popup opens', () => {
    const print = jest.fn();
    const fakeWin = { addEventListener: (_e: string, cb: () => void) => cb(), print } as any;
    jest.spyOn(window, 'open').mockReturnValue(fakeWin);
    openPrintBlob('<html></html>', 'file');
    expect(print).toHaveBeenCalledTimes(1);
  });

  test('swallows a print() that throws', () => {
    const print = jest.fn(() => { throw new Error('blocked'); });
    const fakeWin = { addEventListener: (_e: string, cb: () => void) => cb(), print } as any;
    jest.spyOn(window, 'open').mockReturnValue(fakeWin);
    expect(() => openPrintBlob('<html></html>', 'file')).not.toThrow();
    expect(print).toHaveBeenCalled();
  });

  test('falls back to a download and fires onPopupBlocked when the popup is blocked', () => {
    jest.spyOn(window, 'open').mockReturnValue(null);
    const onBlocked = jest.fn();
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    openPrintBlob('<html></html>', 'file', onBlocked);
    expect(clickSpy).toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledTimes(1);
  });

  test('popup blocked without a callback does not throw (optional-chaining branch)', () => {
    jest.spyOn(window, 'open').mockReturnValue(null);
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect(() => openPrintBlob('<html></html>', 'file')).not.toThrow();
  });
});
