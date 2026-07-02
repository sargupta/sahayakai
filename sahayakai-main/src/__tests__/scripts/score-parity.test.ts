/**
 * @jest-environment node
 *
 * Unit tests for the Phase-2 parity-scoring harness
 * (`scripts/score-parity.mjs`). Covers:
 *
 *   1. structural match against a known-good JSON schema (ajv-compiled)
 *   2. cosine similarity is 1.0 for identical embeddings
 *   3. script-block coverage for every one of the 11 supported scripts
 *   4. mixed-script bleed detection (Pongal-in-Bengali class)
 *   5. field traversal + path resolution round-trip
 *   6. primary-text extraction per agent
 *
 * The harness is pure tooling — these tests run without any sidecar,
 * without any Gemini API key, against synthetic fixtures.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Dynamic import so we tolerate the .mjs extension under jest/SWC.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

beforeAll(async () => {
  mod = await import('../../../scripts/score-parity.mjs' as string);
});

// ---------------------------------------------------------------------------
// (1) Structural match
// ---------------------------------------------------------------------------

describe('makeValidator (ajv structural check)', () => {
  const schema = {
    output: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        objectives: { type: 'array', items: { type: 'string' } },
        gradeLevel: { type: ['string', 'null'] },
      },
      required: ['title', 'objectives'],
    },
  };

  it('passes a well-formed response', () => {
    const validate = mod.makeValidator(schema);
    expect(
      validate({ title: 'Photosynthesis', objectives: ['SWBAT identify chloroplasts'], gradeLevel: '5' }),
    ).toBe(true);
  });

  it('fails when required field missing', () => {
    const validate = mod.makeValidator(schema);
    expect(validate({ objectives: ['x'] })).toBe(false);
    expect(validate.errors?.length).toBeGreaterThan(0);
  });

  it('fails when type wrong', () => {
    const validate = mod.makeValidator(schema);
    expect(validate({ title: 123, objectives: ['x'] })).toBe(false);
  });

  it('accepts schemas in flat form (no .output wrapper)', () => {
    const validate = mod.makeValidator(schema.output);
    expect(validate({ title: 't', objectives: ['o'] })).toBe(true);
  });

  it('tolerates extra telemetry properties (drops additionalProperties:false)', () => {
    // Sidecar adds telemetry fields like cacheHitRatio/revisionsRun/rubric
    // that don't exist on the Zod-dumped baseline schema. The harness must
    // treat these as benign — they're not a correctness regression.
    const strictSchema = {
      output: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          objectives: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'objectives'],
        additionalProperties: false,
      },
    };
    const validate = mod.makeValidator(strictSchema);
    expect(
      validate({
        title: 't',
        objectives: ['o'],
        cacheHitRatio: 0.7,
        revisionsRun: 1,
        rubric: { criterion: 'clarity' },
      }),
    ).toBe(true);
  });

  it('allows explicit null on optional scalar fields', () => {
    // Sidecar emits `chalkboardNote: null` where Genkit might omit it.
    // Both shapes mean "field not present"; relax to accept null.
    const ws = {
      output: {
        type: 'object',
        properties: {
          chalkboardNote: { type: 'string' },
        },
      },
    };
    const validate = mod.makeValidator(ws);
    expect(validate({ chalkboardNote: null })).toBe(true);
  });

  it('validates variant-envelope quiz response per inner schema', () => {
    // Quiz schema describes ONE variant; actual response wraps as
    // {easy, medium, hard}. Harness must auto-detect and validate each.
    const quizSchema = {
      output: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          questions: { type: 'array', items: { type: 'object' } },
        },
        required: ['title', 'questions'],
      },
    };
    const validate = mod.makeValidator(quizSchema);
    const variant = { title: 'Q', questions: [{}] };
    expect(
      validate({ easy: variant, medium: variant, hard: variant, gradeLevel: '3' }),
    ).toBe(true);

    // One bad variant fails the whole envelope.
    expect(
      validate({ easy: variant, medium: variant, hard: { questions: [{}] } /* missing title */ }),
    ).toBe(false);
    expect(validate.errors?.[0].instancePath).toMatch(/^\/hard/);
  });
});

describe('relaxSchema', () => {
  it('drops additionalProperties:false recursively', () => {
    const input = {
      type: 'object',
      properties: { nested: { type: 'object', additionalProperties: false } },
      additionalProperties: false,
    };
    const out = mod.relaxSchema(input);
    expect(out.additionalProperties).toBeUndefined();
    expect(out.properties.nested.additionalProperties).toBeUndefined();
  });

  it('preserves additionalProperties when it is a schema (not false)', () => {
    const input = { type: 'object', additionalProperties: { type: 'string' } };
    const out = mod.relaxSchema(input);
    expect(out.additionalProperties).toEqual({ type: ['string', 'null'] });
  });

  it('widens scalar type to include null', () => {
    const out = mod.relaxSchema({ type: 'string' });
    expect(out.type).toEqual(['string', 'null']);
  });

  it('does not double-add null to type arrays already containing it', () => {
    const out = mod.relaxSchema({ type: ['string', 'null'] });
    expect(out.type).toEqual(['string', 'null']);
  });
});

// ---------------------------------------------------------------------------
// (2) Cosine + embedding identity
// ---------------------------------------------------------------------------

describe('cosine', () => {
  it('returns 1.0 for identical vectors', () => {
    expect(mod.cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1.0, 10);
  });
  it('returns 0 for orthogonal vectors', () => {
    expect(mod.cosine([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });
  it('returns -1 for opposite vectors', () => {
    expect(mod.cosine([1, 2], [-1, -2])).toBeCloseTo(-1, 10);
  });
  it('returns 0 on length mismatch or empty', () => {
    expect(mod.cosine([1, 2, 3], [1, 2])).toBe(0);
    expect(mod.cosine([], [])).toBe(0);
    expect(mod.cosine([0, 0], [0, 0])).toBe(0);
  });
});

describe('mock embedder', () => {
  it('returns identical vectors for identical text (cosine == 1)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-cache-'));
    const embed = await mod.makeEmbedder({ cacheDir: tmpDir, mock: true });
    const a = await embed('photosynthesis is the process by which plants make food');
    const b = await embed('photosynthesis is the process by which plants make food');
    expect(mod.cosine(a, b)).toBeCloseTo(1.0, 10);
  });

  it('returns different vectors for different text', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-cache-'));
    const embed = await mod.makeEmbedder({ cacheDir: tmpDir, mock: true });
    const a = await embed('alpha');
    const b = await embed('beta');
    expect(mod.cosine(a, b)).toBeLessThan(0.999);
  });
});

// ---------------------------------------------------------------------------
// (3) Script-block coverage — every one of the 11 supported scripts
// ---------------------------------------------------------------------------

describe('scriptCoverage', () => {
  // Representative native-script strings. Kept short and copy-checked
  // against Unicode block boundaries:
  //   en  Latin
  //   hi  Devanagari
  //   mr  Devanagari (shares with hi)
  //   bn  Bengali
  //   ta  Tamil
  //   te  Telugu
  //   kn  Kannada
  //   ml  Malayalam
  //   gu  Gujarati
  //   pa  Gurmukhi
  //   or  Odia
  const samples: Record<string, string> = {
    en: 'Photosynthesis is the process plants use to make food.',
    hi: 'प्रकाश संश्लेषण पौधों का भोजन बनाने का तरीका है।',
    mr: 'प्रकाशसंश्लेषण म्हणजे वनस्पतींनी अन्न तयार करण्याची प्रक्रिया.',
    bn: 'সালোকসংশ্লেষণ গাছেদের খাদ্য তৈরির প্রক্রিয়া।',
    ta: 'ஒளிச்சேர்க்கை என்பது தாவரங்கள் உணவு தயாரிக்கும் வழி.',
    te: 'కిరణజన్య సంయోగక్రియ మొక్కల ఆహార తయారీ ప్రక్రియ.',
    kn: 'ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಸಸ್ಯಗಳು ಆಹಾರ ತಯಾರಿಸುವ ಪ್ರಕ್ರಿಯೆ.',
    ml: 'പ്രകാശസംശ്ലേഷണം സസ്യങ്ങൾ ഭക്ഷണം ഉണ്ടാക്കുന്ന പ്രക്രിയ.',
    gu: 'પ્રકાશસંશ્લેષણ છોડ ખોરાક બનાવવાની પ્રક્રિયા છે.',
    pa: 'ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ ਪੌਦਿਆਂ ਦੇ ਖਾਣਾ ਬਣਾਉਣ ਦੀ ਪ੍ਰਕਿਰਿਆ ਹੈ।',
    or: 'ଆଲୋକସଂଶ୍ଳେଷଣ ଗଛମାନଙ୍କର ଖାଦ୍ୟ ତିଆରି ପ୍ରକ୍ରିୟା।',
  };

  for (const [lang, sample] of Object.entries(samples)) {
    it(`coverage >= 0.90 for native ${lang}`, () => {
      const { coverage, total } = mod.scriptCoverage(sample, lang);
      expect(total).toBeGreaterThan(0);
      expect(coverage).toBeGreaterThanOrEqual(0.90);
    });
  }

  it('coverage is near 0 for English text claimed as Tamil', () => {
    const { coverage } = mod.scriptCoverage(samples.en, 'ta');
    expect(coverage).toBeLessThan(0.10);
  });

  it('coverage is near 0 for Tamil text claimed as Bengali', () => {
    const { coverage } = mod.scriptCoverage(samples.ta, 'bn');
    expect(coverage).toBeLessThan(0.10);
  });

  it('ignores whitespace, digits, and punctuation in the denominator', () => {
    const { coverage } = mod.scriptCoverage('   123 . , ! ? ', 'en');
    // No script-bearing chars => coverage 0 but total 0 too — by convention
    // we return 0 to signal "no signal".
    expect(coverage).toBe(0);
  });

  it('throws on unknown language', () => {
    expect(() => mod.scriptCoverage('hi', 'xx')).toThrow(/unknown lang/);
  });
});

// ---------------------------------------------------------------------------
// (4) Mixed-script bleed detection
// ---------------------------------------------------------------------------

describe('detectBleed', () => {
  it('flags Tamil chars in a Bengali response (Pongal-in-Bengali)', () => {
    const text = 'সালোকসংশ্লেষণ গাছেদের খাদ্য তৈরির প্রক্রিয়া। ஒளிச்சேர்க்கை தாவரம் உணவு வழி அழகான வாக்கியம் இது.';
    const out = mod.detectBleed(text, 'bn');
    expect(out.bleed).toBe(true);
    expect(out.scripts).toContain('ta');
  });

  it('does not flag pure Bengali', () => {
    const text = 'সালোকসংশ্লেষণ গাছেদের খাদ্য তৈরির প্রক্রিয়া।';
    const out = mod.detectBleed(text, 'bn');
    expect(out.bleed).toBe(false);
    expect(out.scripts).toHaveLength(0);
  });

  it('does not flag Latin chars (English fallback is common, not a bleed)', () => {
    const text = 'সালোকসংশ্লেষণ গাছেদের খাদ্য তৈরির প্রক্রিয়া। photosynthesis';
    const out = mod.detectBleed(text, 'bn');
    expect(out.bleed).toBe(false);
  });

  it('treats Devanagari in mr as expected (no bleed)', () => {
    const text = 'प्रकाशसंश्लेषण म्हणजे वनस्पतींनी अन्न तयार करण्याची प्रक्रिया.';
    const out = mod.detectBleed(text, 'mr');
    expect(out.bleed).toBe(false);
  });

  it('does not flag small contamination below 10%', () => {
    // 100+ Bengali chars, only a couple Tamil
    const text = 'সালোকসংশ্লেষণ গাছেদের খাদ্য তৈরির প্রক্রিয়া। এটি একটি গুরুত্বপূর্ণ প্রক্রিয়া যা পৃথিবীতে জীবন বজায় রাখে। অ';
    const out = mod.detectBleed(text, 'bn');
    expect(out.bleed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// (5) Path traversal round-trip
// ---------------------------------------------------------------------------

describe('walkStrings + getByPath round-trip', () => {
  const obj = {
    title: 'Photosynthesis',
    gradeLevel: null,
    objectives: ['identify', 'explain'],
    keyVocabulary: [
      { term: 'chlorophyll', definition: 'green pigment' },
      { term: 'stomata', definition: 'leaf pores' },
    ],
  };

  it('walks every non-empty string and getByPath retrieves it', () => {
    let n = 0;
    for (const { path: p, value } of mod.walkStrings(obj)) {
      n++;
      expect(mod.getByPath(obj, p)).toBe(value);
    }
    expect(n).toBe(7);
  });

  it('getByPath returns undefined for missing fields', () => {
    expect(mod.getByPath(obj, 'missing.nested[3].field')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// (6) Primary-text extraction
// ---------------------------------------------------------------------------

describe('extractPrimaryText', () => {
  it('pulls mainContent + title + objectives for lesson-plan', () => {
    const obj = {
      title: 'T',
      mainContent: 'BODY',
      objectives: ['a', 'b'],
      ignored: 'X',
    };
    const out = mod.extractPrimaryText(obj, 'lesson-plan');
    expect(out).toContain('T');
    expect(out).toContain('BODY');
    expect(out).toContain('a');
    expect(out).toContain('b');
    expect(out).not.toContain('X');
  });

  it('expands [*] across arrays for quiz (variant envelope)', () => {
    // Real quiz responses wrap as {easy, medium, hard}, each with a
    // questions[] array of {questionText, explanation, options...}.
    const variant = {
      title: 'Fractions quiz',
      questions: [
        { questionText: 'Q1?', explanation: 'because reasons' },
        { questionText: 'Q2?', explanation: 'so' },
      ],
    };
    const obj = { easy: variant, medium: variant, hard: variant };
    const out = mod.extractPrimaryText(obj, 'quiz');
    expect(out).toContain('Q1?');
    expect(out).toContain('Q2?');
    expect(out).toContain('Fractions quiz');
    expect(out).toContain('because reasons');
  });

  it('returns empty string for unknown agent', () => {
    expect(mod.extractPrimaryText({ x: 1 }, 'no-such-agent')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// (7) Filename → language inference
// ---------------------------------------------------------------------------

describe('langFromFilename', () => {
  it('parses double-underscore convention', () => {
    expect(mod.langFromFilename('lesson-plan__bn__class5-water.json')).toBe('bn');
  });
  it('parses dash convention', () => {
    expect(mod.langFromFilename('quiz-ta-fractions.json')).toBe('ta');
  });
  it('defaults to en when no code present', () => {
    expect(mod.langFromFilename('random-name.json')).toBe('en');
  });
});

// ---------------------------------------------------------------------------
// (8) End-to-end scoreCell on synthetic data — no sidecar, no API key
// ---------------------------------------------------------------------------

describe('scoreCell — synthetic end-to-end', () => {
  const schema = {
    output: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        mainContent: { type: 'string' },
        objectives: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'mainContent', 'objectives'],
    },
  };

  async function getEmbed() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-cache-'));
    return mod.makeEmbedder({ cacheDir: tmpDir, mock: true });
  }

  it('PASSes when sidecar is byte-identical to genkit', async () => {
    const validator = mod.makeValidator(schema);
    const embed = await getEmbed();
    const baseline = {
      title: 'প্রকাশ সংশ্লেষণ',
      mainContent: 'সালোকসংশ্লেষণ গাছেদের খাদ্য তৈরির প্রক্রিয়া যা জীবন বজায় রাখে।',
      objectives: ['শনাক্ত করা', 'ব্যাখ্যা করা'],
    };
    const row = await mod.scoreCell({
      cell: 'bn.json',
      lang: 'bn',
      agent: 'lesson-plan',
      genkitResponse: baseline,
      sidecarResponse: baseline,
      validator,
      embed,
    });
    expect(row.structural).toBe(1);
    expect(row.semantic).toBeCloseTo(1.0, 5);
    expect(row.script).toBeGreaterThanOrEqual(0.90);
    expect(row.bleed).toBe(false);
    expect(row.verdict).toBe('PASS');
  });

  it('FAILs on structural mismatch', async () => {
    const validator = mod.makeValidator(schema);
    const embed = await getEmbed();
    const row = await mod.scoreCell({
      cell: 'bad.json',
      lang: 'en',
      agent: 'lesson-plan',
      genkitResponse: { title: 't', mainContent: 'm', objectives: ['o'] },
      sidecarResponse: { title: 't', mainContent: 'm' }, // missing objectives
      validator,
      embed,
    });
    expect(row.structural).toBe(0);
    expect(row.verdict).toBe('FAIL');
    expect(row.failReasons).toContain('structural');
  });

  it('FAILs on script-bleed (Tamil leak inside Bengali)', async () => {
    const validator = mod.makeValidator(schema);
    const embed = await getEmbed();
    const baseline = {
      title: 'প্রকাশ সংশ্লেষণ',
      mainContent: 'সালোকসংশ্লেষণ গাছেদের খাদ্য।',
      objectives: ['o'],
    };
    const polluted = {
      title: 'প্রকাশ সংশ্লেষণ',
      mainContent: 'சாலோகஸம்ஸ்லேஷன் காச் கெதேர் காத்ய। ஒளிச்சேர்க்கை தாவரம் உணவு வழி அழகு.',
      objectives: ['o'],
    };
    const row = await mod.scoreCell({
      cell: 'bleed.json',
      lang: 'bn',
      agent: 'lesson-plan',
      genkitResponse: baseline,
      sidecarResponse: polluted,
      validator,
      embed,
    });
    expect(row.bleed).toBe(true);
    expect(row.bleedScripts).toContain('ta');
    expect(row.verdict).toBe('FAIL');
    expect(row.failReasons).toContain('bleed');
  });

  it('FAILs when primary text is in wrong script (low script coverage)', async () => {
    const validator = mod.makeValidator(schema);
    const embed = await getEmbed();
    const baseline = {
      title: 'Photosynthesis',
      mainContent: 'Photosynthesis is how plants make food.',
      objectives: ['identify'],
    };
    // Sidecar returned English when Bengali was asked for.
    const row = await mod.scoreCell({
      cell: 'en-when-bn.json',
      lang: 'bn',
      agent: 'lesson-plan',
      genkitResponse: baseline,
      sidecarResponse: baseline,
      validator,
      embed,
    });
    expect(row.script).toBeLessThan(0.90);
    expect(row.failReasons).toContain('script');
    expect(row.verdict).toBe('FAIL');
  });
});

// ---------------------------------------------------------------------------
// (9) Recommender-mode helpers + scoreCellRecommender
// ---------------------------------------------------------------------------

describe('tokenizeQuery', () => {
  it('lowercases and splits on whitespace/punctuation', () => {
    expect(mod.tokenizeQuery('NCERT Class 3 Science!')).toEqual(['ncert', 'class', '3', 'science']);
  });
  it('drops single-char tokens', () => {
    expect(mod.tokenizeQuery('a big cat')).toEqual(['big', 'cat']);
  });
  it('preserves Indic-script tokens intact', () => {
    const tokens = mod.tokenizeQuery('जल चक्र शिक्षण');
    expect(tokens).toEqual(['जल', 'चक्र', 'शिक्षण']);
  });
  it('returns [] for empty / non-string input', () => {
    expect(mod.tokenizeQuery('')).toEqual([]);
    expect(mod.tokenizeQuery(null)).toEqual([]);
    expect(mod.tokenizeQuery(42)).toEqual([]);
  });
});

describe('collectRecommenderQueries', () => {
  it('flattens every categories.<bucket>[] string', () => {
    const obj = {
      categories: {
        pedagogy: ['a', 'b'],
        storytelling: ['c'],
        govtUpdates: [],
      },
      personalizedMessage: 'msg',
    };
    expect(mod.collectRecommenderQueries(obj)).toEqual(['a', 'b', 'c']);
  });
  it('skips non-string elements and empty strings', () => {
    const obj = { categories: { a: ['ok', '', null, 7, 'fine'] } };
    expect(mod.collectRecommenderQueries(obj)).toEqual(['ok', 'fine']);
  });
  it('returns [] when categories missing', () => {
    expect(mod.collectRecommenderQueries({})).toEqual([]);
    expect(mod.collectRecommenderQueries(null)).toEqual([]);
  });
});

describe('jaccardQuerySets', () => {
  it('returns 1 for identical token sets', () => {
    expect(mod.jaccardQuerySets(['cat dog'], ['dog cat'])).toBe(1);
  });
  it('returns 0 when sides disjoint', () => {
    expect(mod.jaccardQuerySets(['cat'], ['dog'])).toBe(0);
  });
  it('handles partial overlap correctly', () => {
    // A = {ncert, class, 3, math}, B = {ncert, class, 3, science}
    // inter = 3, union = 5 → 0.6
    const j = mod.jaccardQuerySets(['NCERT class 3 math'], ['NCERT class 3 science']);
    expect(j).toBeCloseTo(0.6, 5);
  });
  it('returns 1 when both empty (vacuous match)', () => {
    expect(mod.jaccardQuerySets([], [])).toBe(1);
  });
  it('returns 0 when one side empty', () => {
    expect(mod.jaccardQuerySets(['cat dog'], [])).toBe(0);
    expect(mod.jaccardQuerySets([], ['cat dog'])).toBe(0);
  });
});

describe('topicKeywordsFromFilename', () => {
  it('extracts subject+topic from canonical name', () => {
    expect(mod.topicKeywordsFromFilename('bn-g3-hindi-kahaani.json'))
      .toEqual(['hindi', 'kahaani']);
  });
  it('strips lang code and grade marker', () => {
    expect(mod.topicKeywordsFromFilename('en-g7-math-algebra.json'))
      .toEqual(['math', 'algebra']);
  });
  it('returns [] for opaque names', () => {
    expect(mod.topicKeywordsFromFilename('whatever.json')).toEqual([]);
  });
});

describe('topicalRelevance', () => {
  it('returns 1 when no keywords (nothing to check)', () => {
    expect(mod.topicalRelevance(['a', 'b'], [])).toBe(1);
  });
  it('returns 0 when keywords given but no queries', () => {
    expect(mod.topicalRelevance([], ['math'])).toBe(0);
  });
  it('substring matches across queries', () => {
    const queries = [
      'Fractions storytelling for Class 3',
      'NCERT math videos',
      'Ministry of Education updates',
    ];
    expect(mod.topicalRelevance(queries, ['math', 'fractions', 'education'])).toBe(1);
  });
  it('counts each query at most once', () => {
    const queries = ['math fractions class 3', 'physics waves', 'biology cells'];
    expect(mod.topicalRelevance(queries, ['math', 'fractions'])).toBeCloseTo(1 / 3, 5);
  });
});

describe('scoreCellRecommender — synthetic end-to-end', () => {
  async function getEmbed() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-cache-rec-'));
    return mod.makeEmbedder({ cacheDir: tmpDir, mock: true });
  }

  it('PASSes a realistic English cell with topical English queries', async () => {
    const embed = await getEmbed();
    const baseline = {
      categories: {
        pedagogy: ['Active learning fractions Class 3', 'NCERT fractions methods'],
        storytelling: ['Fractions story Class 3', 'Animated fractions explainer'],
        govtUpdates: ['Ministry of Education fractions updates'],
        courses: ['NISHTHA math training fractions'],
        topRecommended: ['Khan Academy fractions Class 3'],
      },
      personalizedMessage: 'Hello teacher, here are fractions resources for Class 3 math.',
    };
    const row = await mod.scoreCellRecommender({
      cell: 'en-g3-math-fractions.json',
      lang: 'en',
      agent: 'video-storyteller',
      genkitResponse: baseline,
      sidecarResponse: baseline,
      validator: null,
      embed,
    });
    expect(row.verdict).toBe('PASS');
    expect(row.queryJaccard).toBe(1);
    expect(row.topicalRelevance).toBe(1);
    expect(row.messageCosine).toBe(1);
  });

  it('FAILs jaccard when query sets are disjoint', async () => {
    const embed = await getEmbed();
    const sidecar = { categories: { pedagogy: ['something unrelated about pottery'] } };
    const row = await mod.scoreCellRecommender({
      cell: 'en-g3-math-fractions.json',
      lang: 'en',
      agent: 'video-storyteller',
      genkitResponse: {
        categories: { pedagogy: ['Active learning fractions Class 3'] },
      },
      sidecarResponse: sidecar,
      validator: null,
      embed,
    });
    expect(row.queryJaccard).toBeLessThan(mod.RECOMMENDER_THRESHOLDS.jaccard);
    expect(row.failReasons).toContain('jaccard');
    expect(row.failReasons).toContain('topical');
  });

  it('FAILs topical when sidecar queries do not mention the topic', async () => {
    const embed = await getEmbed();
    // Topic keywords from filename: math, fractions. Sidecar talks only
    // about generic teacher updates — jaccard happens to share filler
    // tokens like "teacher", "updates", but topical relevance is 0.
    const baseline = {
      categories: { pedagogy: ['fractions teacher updates', 'math teacher updates'] },
    };
    const sidecar = {
      categories: { pedagogy: ['general teacher updates', 'random teacher updates'] },
    };
    const row = await mod.scoreCellRecommender({
      cell: 'en-g3-math-fractions.json',
      lang: 'en',
      agent: 'video-storyteller',
      genkitResponse: baseline,
      sidecarResponse: sidecar,
      validator: null,
      embed,
    });
    expect(row.topicalRelevance).toBe(0);
    expect(row.failReasons).toContain('topical');
  });

  it('FAILs message when personalizedMessage cosine below threshold (mock embedder)', async () => {
    const embed = await getEmbed();
    const baseline = {
      categories: { pedagogy: ['Fractions Class 3 math NCERT'] },
      personalizedMessage: 'A',
    };
    const sidecar = {
      categories: { pedagogy: ['Fractions Class 3 math NCERT'] },
      personalizedMessage: 'B', // hash-based mock embed gives ~uncorrelated vectors
    };
    const row = await mod.scoreCellRecommender({
      cell: 'en-g3-math-fractions.json',
      lang: 'en',
      agent: 'video-storyteller',
      genkitResponse: baseline,
      sidecarResponse: sidecar,
      validator: null,
      embed,
    });
    expect(row.messageCosine).not.toBeNull();
    expect(row.messageCosine).toBeLessThan(mod.RECOMMENDER_THRESHOLDS.messageCosine);
    expect(row.failReasons).toContain('message');
  });

  it('skips messageCosine check when one side omits the message', async () => {
    const embed = await getEmbed();
    const baseline = {
      categories: { pedagogy: ['Fractions Class 3 math'] },
      personalizedMessage: 'Hello teacher.',
    };
    const sidecar = {
      categories: { pedagogy: ['Fractions Class 3 math'] },
    };
    const row = await mod.scoreCellRecommender({
      cell: 'en-g3-math-fractions.json',
      lang: 'en',
      agent: 'video-storyteller',
      genkitResponse: baseline,
      sidecarResponse: sidecar,
      validator: null,
      embed,
    });
    expect(row.messageCosine).toBeNull();
    expect(row.failReasons).not.toContain('message');
  });

  // Native Script Mandate re-score (commit fe8f0cacb): script + bleed
  // checks now run on `personalizedMessage` ONLY — search queries are
  // intentionally Latin/English per the mandate, so query-side scripts
  // are exempt. The bleed guard therefore lives on the message.
  it('still flags script-bleed (Tamil leak inside Hindi personalizedMessage)', async () => {
    const embed = await getEmbed();
    const baseline = {
      categories: { pedagogy: ['कक्षा 3 गणित भिन्न शिक्षण विधि'] },
      personalizedMessage: 'नमस्ते! कक्षा 3 गणित भिन्न के लिए ये वीडियो देखें।',
    };
    const sidecar = {
      categories: { pedagogy: ['कक्षा 3 गणित भिन्न शिक्षण विधि'] },
      personalizedMessage:
        'நமஸ்தே! கணிதம் வகுப்பு 3 பின்னங்கள் கற்பித்தல் வீடியோ பார்க்கவும்.',
    };
    const row = await mod.scoreCellRecommender({
      cell: 'hi-g3-math-fractions.json',
      lang: 'hi',
      agent: 'video-storyteller',
      genkitResponse: baseline,
      sidecarResponse: sidecar,
      validator: null,
      embed,
    });
    expect(row.bleed).toBe(true);
    expect(row.bleedScripts).toContain('ta');
    expect(row.failReasons).toContain('bleed');
  });

  // Companion to the above: Tamil inside the QUERY strings alone must NOT
  // trip bleed post-fe8f0cacb — queries are exempt from the script checks.
  it('does not flag bleed for non-Latin scripts confined to query strings', async () => {
    const embed = await getEmbed();
    const baseline = {
      categories: { pedagogy: ['कक्षा 3 गणित भिन्न शिक्षण विधि'] },
    };
    const sidecar = {
      categories: {
        pedagogy: ['கணிதம் வகுப்பு 3 பின்னங்கள் கற்பித்தல் தமிழ் வழி'],
      },
    };
    const row = await mod.scoreCellRecommender({
      cell: 'hi-g3-math-fractions.json',
      lang: 'hi',
      agent: 'video-storyteller',
      genkitResponse: baseline,
      sidecarResponse: sidecar,
      validator: null,
      embed,
    });
    expect(row.bleed).toBe(false);
    expect(row.failReasons).not.toContain('bleed');
  });
});
