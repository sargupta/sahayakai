/**
 * @jest-environment node
 *
 * Unit tests for the Track-5 canary monitor (`scripts/canary-watch.mjs`).
 *
 * These tests only exercise the pure gate-evaluation logic (`evaluateGates`,
 * `bucketDocs`, `computeDriftFraction`, `quantile`, `cosine`, `parseDuration`).
 * The Firestore + Cloud Logging adapters are intentionally NOT exercised
 * here — they're thin wrappers around firebase-admin / gcloud and would
 * require a real project to verify. The CLI `main()` is also not invoked.
 *
 * Coverage:
 *   - GO when zero errors + latency under multiplier
 *   - NO-GO when 5xx rate > threshold
 *   - NO-GO when latency ratio > threshold
 *   - NO-GO when semantic drift > threshold
 *   - INSUFFICIENT_SIGNAL when zero traffic
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

beforeAll(async () => {
  mod = await import('../../../scripts/canary-watch.mjs' as string);
});

// ---------------------------------------------------------------------------
// (1) GO path
// ---------------------------------------------------------------------------
describe('evaluateGates — GO', () => {
  it('returns GO when no errors, latency within multiplier, drift OK', () => {
    const docs = Array.from({ length: 20 }, () => ({
      sidecarOk: true,
      sidecarLatencyMs: 500,
      genkitLatencyMs: 480,
    }));
    const metrics = mod.bucketDocs(docs);
    const drift = { driftFraction: 0.02, sampled: 5, drifted: 0 };
    const r = mod.evaluateGates({
      metrics,
      sidecarP95: 500,
      genkitP95: 480,
      drift,
      thresholds: { maxErrorRate: 0.05, maxLatencyMultiplier: 1.3, maxSemanticDrift: 0.1 },
    });
    expect(r.verdict).toBe('GO');
    expect(r.reasons).toHaveLength(0);
    expect(r.gates.errorRatePass).toBe(true);
    expect(r.gates.latencyPass).toBe(true);
    expect(r.gates.driftPass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (2) NO-GO 5xx
// ---------------------------------------------------------------------------
describe('evaluateGates — NO-GO 5xx rate', () => {
  it('returns NO_GO when 5xx rate exceeds threshold', () => {
    // 2 5xx out of 10 → 20% > 5% threshold.
    const docs = [
      ...Array.from({ length: 8 }, () => ({ sidecarOk: true, sidecarLatencyMs: 500, genkitLatencyMs: 500 })),
      { sidecarOk: false, sidecarStatus: 500, sidecarError: 'internal', sidecarLatencyMs: 100, genkitLatencyMs: 500 },
      { sidecarOk: false, sidecarStatus: 503, sidecarError: 'unavailable', sidecarLatencyMs: 100, genkitLatencyMs: 500 },
    ];
    const metrics = mod.bucketDocs(docs);
    expect(metrics.sidecar5xx).toBe(2);
    const r = mod.evaluateGates({
      metrics,
      sidecarP95: 500, genkitP95: 500,
      drift: { driftFraction: 0, sampled: 5, drifted: 0 },
      thresholds: { maxErrorRate: 0.05, maxLatencyMultiplier: 1.3, maxSemanticDrift: 0.1 },
    });
    expect(r.verdict).toBe('NO_GO');
    expect(r.reasons.some((s: string) => s.includes('5xx rate'))).toBe(true);
    expect(r.gates.errorRatePass).toBe(false);
  });

  it('classifies 5xx from error string when sidecarStatus missing', () => {
    const docs = [
      { sidecarOk: false, sidecarError: 'Internal server error 500' },
      { sidecarOk: false, sidecarError: 'deadline exceeded' },
      { sidecarOk: false, sidecarError: 'bad request 400' }, // 4xx
    ];
    const m = mod.bucketDocs(docs);
    expect(m.sidecar5xx).toBe(2);
    expect(m.sidecar4xx).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// (3) NO-GO latency
// ---------------------------------------------------------------------------
describe('evaluateGates — NO-GO latency ratio', () => {
  it('returns NO_GO when sidecar p95 / genkit p95 > multiplier', () => {
    const metrics = mod.bucketDocs(
      Array.from({ length: 10 }, () => ({ sidecarOk: true, sidecarLatencyMs: 1000, genkitLatencyMs: 500 })),
    );
    const r = mod.evaluateGates({
      metrics,
      sidecarP95: 1000, genkitP95: 500,
      drift: { driftFraction: 0, sampled: 5, drifted: 0 },
      thresholds: { maxErrorRate: 0.05, maxLatencyMultiplier: 1.3, maxSemanticDrift: 0.1 },
    });
    expect(r.verdict).toBe('NO_GO');
    expect(r.gates.latencyRatio).toBeCloseTo(2.0, 1);
    expect(r.gates.latencyPass).toBe(false);
    expect(r.reasons.some((s: string) => s.includes('latency ratio'))).toBe(true);
  });

  it('skips latency gate cleanly when latencyCheckSkipped=true', () => {
    const metrics = mod.bucketDocs(
      Array.from({ length: 10 }, () => ({ sidecarOk: true, sidecarLatencyMs: 1000, genkitLatencyMs: 500 })),
    );
    const r = mod.evaluateGates({
      metrics,
      sidecarP95: null, genkitP95: null,
      drift: { driftFraction: 0, sampled: 5, drifted: 0 },
      thresholds: { maxErrorRate: 0.05, maxLatencyMultiplier: 1.3, maxSemanticDrift: 0.1 },
      latencyCheckSkipped: true,
    });
    expect(r.verdict).toBe('GO');
    expect(r.reasons.some((s: string) => s.includes('latency check skipped'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (4) NO-GO drift
// ---------------------------------------------------------------------------
describe('evaluateGates — NO-GO semantic drift', () => {
  it('returns NO_GO when drift fraction > threshold', () => {
    const metrics = mod.bucketDocs(
      Array.from({ length: 20 }, () => ({ sidecarOk: true, sidecarLatencyMs: 500, genkitLatencyMs: 500 })),
    );
    // 3 of 10 sampled cells drifted → 30% > 10% threshold.
    const drift = { driftFraction: 0.3, sampled: 10, drifted: 3 };
    const r = mod.evaluateGates({
      metrics,
      sidecarP95: 500, genkitP95: 500,
      drift,
      thresholds: { maxErrorRate: 0.05, maxLatencyMultiplier: 1.3, maxSemanticDrift: 0.1 },
    });
    expect(r.verdict).toBe('NO_GO');
    expect(r.gates.driftPass).toBe(false);
    expect(r.reasons.some((s: string) => s.includes('semantic drift'))).toBe(true);
  });

  it('computeDriftFraction flags cosine < 0.85 as drifted', () => {
    const samples = [
      { cosine: 0.99 }, // not drifted
      { cosine: 0.90 }, // not drifted
      { cosine: 0.80 }, // drifted (1-0.8=0.2 > 0.15)
      { cosine: 0.50 }, // drifted
    ];
    const r = mod.computeDriftFraction(samples);
    expect(r.sampled).toBe(4);
    expect(r.drifted).toBe(2);
    expect(r.driftFraction).toBeCloseTo(0.5);
  });
});

// ---------------------------------------------------------------------------
// (5) INSUFFICIENT_SIGNAL
// ---------------------------------------------------------------------------
describe('evaluateGates — INSUFFICIENT_SIGNAL', () => {
  it('returns INSUFFICIENT_SIGNAL when zero traffic', () => {
    const metrics = mod.bucketDocs([]);
    const r = mod.evaluateGates({
      metrics,
      sidecarP95: null, genkitP95: null,
      drift: { driftFraction: 0, sampled: 0, drifted: 0 },
      thresholds: { maxErrorRate: 0.05, maxLatencyMultiplier: 1.3, maxSemanticDrift: 0.1 },
    });
    expect(r.verdict).toBe('INSUFFICIENT_SIGNAL');
    expect(r.reasons[0]).toMatch(/no traffic/);
  });
});

// ---------------------------------------------------------------------------
// (6) Helpers
// ---------------------------------------------------------------------------
describe('helpers', () => {
  it('parseDuration accepts s/m/h/ms', () => {
    expect(mod.parseDuration('30s')).toBe(30_000);
    expect(mod.parseDuration('5m')).toBe(300_000);
    expect(mod.parseDuration('2h')).toBe(7_200_000);
    expect(mod.parseDuration('500ms')).toBe(500);
    expect(() => mod.parseDuration('bad')).toThrow();
  });

  it('cosine = 1 for identical vectors, 0 for orthogonal', () => {
    expect(mod.cosine([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
    expect(mod.cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(mod.cosine([], [])).toBe(0);
  });

  it('quantile interpolates correctly', () => {
    expect(mod.quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(mod.quantile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 0.95)).toBeCloseTo(95.5, 1);
    expect(mod.quantile([], 0.95)).toBeNull();
  });

  it('parseArgs handles --key=val and --key val', () => {
    const r = mod.parseArgs(['--mode=preview', '--agents', 'lessonPlan,quiz', '--dry']);
    expect(r.mode).toBe('preview');
    expect(r.agents).toBe('lessonPlan,quiz');
    expect(r.dry).toBe('true');
  });
});
