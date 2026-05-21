/**
 * Tests for the NCERT chapter seed and the `validateChapter` validator.
 *
 * Covers:
 *   1. Coverage: each (grade × subject) seed cell contains at least one chapter.
 *   2. Happy path: real chapters validate.
 *   3. Negative path: wrong-grade chapter is rejected.
 *   4. Fuzzy: typo'd chapter is rejected with a useful suggestion.
 *   5. Alias normalisation: "Maths" / "Class X" / "Sci" all canonicalise.
 *   6. Auto-correct heuristic.
 */

import {
    validateChapter,
    canonicaliseGrade,
    canonicaliseSubject,
    getChaptersForCell,
    listCoveredCells,
    shouldAutoCorrect,
} from '../ncert-chapters';

describe('ncert-chapters seed — coverage', () => {
    const REQUIRED_CELLS: Array<[number, string]> = [
        // Critical demo accuracy targets
        [10, 'Mathematics'],
        [9, 'Mathematics'],
        [8, 'Science'],
        [5, 'EVS'],
        [5, 'Mathematics'],

        // Broader Class 1-5 (EVS doubles as Science here)
        [1, 'Mathematics'],
        [2, 'Mathematics'],
        [3, 'Mathematics'],
        [4, 'Mathematics'],
        [1, 'English'],
        [2, 'English'],
        [1, 'Hindi'],
        [2, 'Hindi'],

        // Class 6-10 secondary
        [6, 'Mathematics'],
        [7, 'Mathematics'],
        [8, 'Mathematics'],
        [6, 'Science'],
        [7, 'Science'],
        [9, 'Science'],
        [10, 'Science'],
    ];

    test.each(REQUIRED_CELLS)(
        'Class %i %s — seed has ≥1 chapter',
        (grade, subject) => {
            const cell = getChaptersForCell(grade, subject);
            expect(cell.length).toBeGreaterThan(0);
            // Every chapter must have number + title
            for (const c of cell) {
                expect(c.number).toBeGreaterThan(0);
                expect(c.title.length).toBeGreaterThan(0);
            }
        },
    );

    test('listCoveredCells returns ≥10 covered cells (sanity)', () => {
        const cells = listCoveredCells();
        expect(cells.length).toBeGreaterThanOrEqual(10);
    });
});

describe('canonicaliseGrade — alias inputs', () => {
    test.each([
        ['10', 10],
        ['Class 10', 10],
        ['Grade 10', 10],
        ['X', 10],
        ['x', 10],
        ['10th', 10],
        ['5', 5],
        ['Class 5', 5],
        ['V', 5],
        ['1st', 1],
        ['12th', 12],
    ])('"%s" → %i', (input, expected) => {
        expect(canonicaliseGrade(input)).toBe(expected);
    });

    test('numeric input', () => {
        expect(canonicaliseGrade(10)).toBe(10);
        expect(canonicaliseGrade(99)).toBeNull();
    });

    test('unrecognised input returns null', () => {
        expect(canonicaliseGrade('nursery')).toBeNull();
        expect(canonicaliseGrade('')).toBeNull();
    });
});

describe('canonicaliseSubject — alias inputs', () => {
    test.each([
        ['Mathematics', 'Mathematics'],
        ['Math', 'Mathematics'],
        ['Maths', 'Mathematics'],
        ['MATHS', 'Mathematics'],
        ['गणित', 'Mathematics'],
        ['Science', 'Science'],
        ['Sci', 'Science'],
        ['विज्ञान', 'Science'],
        ['EVS', 'EVS'],
        ['Environmental Studies', 'EVS'],
        ['environmental studies (evs)', 'EVS'],
        ['Hindi', 'Hindi'],
        ['English', 'English'],
        ['eng', 'English'],
        ['Social Studies', 'Social Studies'],
        ['Social Science', 'Social Studies'],
        ['SST', 'Social Studies'],
    ])('"%s" → "%s"', (input, expected) => {
        expect(canonicaliseSubject(input)).toBe(expected);
    });

    test('unrecognised returns null', () => {
        expect(canonicaliseSubject('Astronomy')).toBeNull();
        expect(canonicaliseSubject('')).toBeNull();
    });
});

describe('validateChapter — happy path (Class 10 Mathematics)', () => {
    test('"Quadratic Equations" → valid', () => {
        const r = validateChapter('Class 10', 'Mathematics', 'Quadratic Equations');
        expect(r.valid).toBe(true);
        expect(r.closestMatch?.title).toBe('Quadratic Equations');
    });

    test('"Polynomials" → valid', () => {
        const r = validateChapter('10', 'Mathematics', 'Polynomials');
        expect(r.valid).toBe(true);
    });

    test('"Real Numbers" → valid', () => {
        const r = validateChapter('X', 'Math', 'Real Numbers');
        expect(r.valid).toBe(true);
    });

    test('"Triangles" → valid', () => {
        const r = validateChapter(10, 'Maths', 'Triangles');
        expect(r.valid).toBe(true);
    });

    test('chapter by number → valid', () => {
        const r = validateChapter('Class 10', 'Mathematics', 4);
        expect(r.valid).toBe(true);
        expect(r.closestMatch?.title).toBe('Quadratic Equations');
    });

    test('chapter by stringified number → valid', () => {
        const r = validateChapter('Class 10', 'Mathematics', '7');
        expect(r.valid).toBe(true);
        expect(r.closestMatch?.title).toBe('Coordinate Geometry');
    });

    test('chapter number out of range → invalid', () => {
        const r = validateChapter('Class 10', 'Mathematics', 99);
        expect(r.valid).toBe(false);
        expect(r.reason).toMatch(/Chapter 99 does not exist/);
    });
});

describe('validateChapter — Class 8 Science (Force and Pressure)', () => {
    test('exact title → valid', () => {
        const r = validateChapter('Class 8', 'Science', 'Force and Pressure');
        expect(r.valid).toBe(true);
        expect(r.closestMatch?.title).toBe('Force and Pressure');
    });

    test('typo "Foce and Presure" → invalid + suggestion "Force and Pressure"', () => {
        const r = validateChapter('Class 8', 'Sci', 'Foce and Presure');
        expect(r.valid).toBe(false);
        expect(r.suggestion).toMatch(/Force and Pressure/);
        expect(r.closestMatch?.title).toBe('Force and Pressure');
    });

    test('"Friction" → valid', () => {
        const r = validateChapter(8, 'Science', 'Friction');
        expect(r.valid).toBe(true);
    });
});

describe('validateChapter — Class 9 Mathematics', () => {
    test('"Polynomials" → valid', () => {
        const r = validateChapter('Class 9', 'Mathematics', 'Polynomials');
        expect(r.valid).toBe(true);
    });

    test('"Coordinate Geometry" → valid', () => {
        const r = validateChapter('IX', 'Maths', 'Coordinate Geometry');
        expect(r.valid).toBe(true);
    });

    test('"Linear Equations in Two Variables" → valid', () => {
        const r = validateChapter('9', 'Math', 'Linear Equations in Two Variables');
        expect(r.valid).toBe(true);
    });
});

describe('validateChapter — cross-grade rejection', () => {
    test('"Quadratic Equations" in Class 5 Science → invalid', () => {
        const r = validateChapter('Class 5', 'Science', 'Quadratic Equations');
        expect(r.valid).toBe(false);
        // Grade 5 Science is exposed via the EVS subject; calling it "Science"
        // should fall through to lenient when the seed has no Class 5 Science
        // cell OR reject when the topic clearly doesn't exist.
        expect(r.valid).toBe(false); // sanity reassert
    });

    test('"Quadratic Equations" in Class 5 EVS → invalid + reason', () => {
        const r = validateChapter('Class 5', 'EVS', 'Quadratic Equations');
        expect(r.valid).toBe(false);
        expect(r.reason || r.suggestion).toBeDefined();
    });

    test('"Quadratic Equations" in Class 5 Mathematics → invalid', () => {
        const r = validateChapter('Class 5', 'Math', 'Quadratic Equations');
        expect(r.valid).toBe(false);
    });
});

describe('validateChapter — soft / lenient behavior', () => {
    test('unrecognised grade → lenient pass', () => {
        const r = validateChapter('Postgraduate', 'Mathematics', 'Anything');
        expect(r.valid).toBe(true);
        expect(r.lenient).toBe(true);
    });

    test('unrecognised subject → lenient pass', () => {
        const r = validateChapter('Class 10', 'Astronomy', 'Black Holes');
        expect(r.valid).toBe(true);
        expect(r.lenient).toBe(true);
    });

    test('empty chapter input → lenient pass', () => {
        const r = validateChapter('Class 10', 'Mathematics', '');
        expect(r.valid).toBe(true);
        expect(r.lenient).toBe(true);
    });
});

describe('shouldAutoCorrect', () => {
    test('returns true for high-confidence suggestion', () => {
        const r = validateChapter('Class 8', 'Sci', 'Foce and Presure');
        expect(shouldAutoCorrect(r)).toBe(true);
    });

    test('returns false for valid input (no correction needed)', () => {
        const r = validateChapter('Class 10', 'Mathematics', 'Quadratic Equations');
        expect(shouldAutoCorrect(r)).toBe(false);
    });

    test('returns false for completely unknown chapter (no suggestion)', () => {
        const r = validateChapter('Class 10', 'Mathematics', 'Astrophysics of Black Holes');
        expect(shouldAutoCorrect(r)).toBe(false);
    });
});

describe('validateChapter — substring suggestion', () => {
    test('partial title "Trigonometry" in Class 10 Math should suggest the full chapter', () => {
        const r = validateChapter('Class 10', 'Mathematics', 'Trigonometry');
        // "Introduction to Trigonometry" contains the input as substring
        expect(r.valid).toBe(false);
        expect(r.suggestion).toMatch(/Trigonometry/);
    });
});
