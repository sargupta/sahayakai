/**
 * The kill-switch's own behaviour, and the class gate that every AI route
 * honours it.
 *
 * Context for why the class gate is the more important half. The infra function
 * `infra/billing-killswitch/index.js` has been deployed since 2026-08 and its
 * header states the app-side contract explicitly: every /api/ai/* route must read
 * system_config/ai_killswitch and refuse when it is false, "until that read
 * exists, this function arms the trip but the app won't honour it." The read
 * never landed. For two months the kill-switch wrote a flag nothing read, on a
 * project whose production bills to a cash card with no credit route left.
 *
 * Fixing the 18 routes once would not stop route 19 from being added without it,
 * so the gate below enumerates the route files on disk rather than trusting a
 * list someone maintains.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readdirSync, statSync } from 'node:fs';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC = path.join(APP_ROOT, 'src');

// ---------------------------------------------------------------- behaviour

const mockGet = jest.fn();
jest.mock('@/lib/firebase-admin', () => ({
  getDb: jest.fn(async () => ({
    collection: () => ({ doc: () => ({ get: mockGet }) }),
  })),
}));
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));

describe('isAiEnabled', () => {
  let isAiEnabled: () => Promise<boolean>;
  let reset: () => void;

  beforeEach(async () => {
    jest.resetModules();
    delete process.env.AI_KILLSWITCH_ENABLED;
    mockGet.mockReset();
    const mod = await import('@/lib/ai-killswitch');
    isAiEnabled = mod.isAiEnabled;
    reset = mod.__resetAiKillSwitchCacheForTests;
    reset();
  });

  it('allows AI when the document does not exist', async () => {
    // The infra function only ever writes `false`, so a missing document means
    // the switch has never tripped — not that state is unknown.
    mockGet.mockResolvedValue({ exists: false, data: () => undefined });
    await expect(isAiEnabled()).resolves.toBe(true);
  });

  it('blocks AI only on an explicit false', async () => {
    mockGet.mockResolvedValue({ exists: true, data: () => ({ enabled: false, reason: 'budget' }) });
    await expect(isAiEnabled()).resolves.toBe(false);
  });

  it('allows AI when the field is missing or is some other value', async () => {
    mockGet.mockResolvedValue({ exists: true, data: () => ({ trippedBy: 'nobody' }) });
    await expect(isAiEnabled()).resolves.toBe(true);
  });

  it('fails SAFE when Firestore throws', async () => {
    // A cost guard that takes the product down when its own datastore blips is a
    // worse outage than the bill it prevents.
    mockGet.mockRejectedValue(new Error('DEADLINE_EXCEEDED'));
    await expect(isAiEnabled()).resolves.toBe(true);
  });

  it('does not cache a failed read', async () => {
    mockGet.mockRejectedValueOnce(new Error('transient'));
    await expect(isAiEnabled()).resolves.toBe(true);
    mockGet.mockResolvedValue({ exists: true, data: () => ({ enabled: false }) });
    // If the error had been cached for 30s this would still report true.
    await expect(isAiEnabled()).resolves.toBe(false);
  });

  it('caches a successful read instead of reading per request', async () => {
    mockGet.mockResolvedValue({ exists: true, data: () => ({ enabled: true }) });
    await isAiEnabled();
    await isAiEnabled();
    await isAiEnabled();
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('lets the env override win without touching Firestore', async () => {
    process.env.AI_KILLSWITCH_ENABLED = 'false';
    await expect(isAiEnabled()).resolves.toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('aiKillSwitchGate', () => {
  it('returns null while enabled and a 503 with Retry-After while tripped', async () => {
    jest.resetModules();
    delete process.env.AI_KILLSWITCH_ENABLED;
    mockGet.mockReset();
    const mod = await import('@/lib/ai-killswitch');
    mod.__resetAiKillSwitchCacheForTests();

    mockGet.mockResolvedValue({ exists: true, data: () => ({ enabled: true }) });
    await expect(mod.aiKillSwitchGate()).resolves.toBeNull();

    mod.__resetAiKillSwitchCacheForTests();
    mockGet.mockResolvedValue({ exists: true, data: () => ({ enabled: false }) });
    const blocked = await mod.aiKillSwitchGate();
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(503);
    expect(blocked!.headers.get('Retry-After')).toBe('3600');
    // The body is asserted through the exported constant, not `await res.json()`.
    // This test environment does not preserve NextResponse.json bodies through a
    // read-back — the same limitation assessment-scanner-patch.test.ts documents —
    // so a `.json()` assertion here would compare {} against {} and pass for the
    // wrong reason.
    expect(mod.AI_KILLSWITCH_RESPONSE_BODY.error).toBe('AI_TEMPORARILY_UNAVAILABLE');
    expect(mod.AI_KILLSWITCH_RESPONSE_BODY.message).toMatch(/saved work is safe/);
  });
});

// --------------------------------------------------------------- class gate

/**
 * Routes that legitimately do not gate on the kill-switch, each with the reason.
 * Adding a path here is a deliberate, reviewable act; forgetting the gate is not.
 */
const EXEMPT: Record<string, string> = {
  'app/api/ai/quiz/health/route.ts':
    'Health probe. It must keep answering while AI is paused — that is when someone is most likely to be checking.',
};

function routeFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) routeFiles(full, acc);
    else if (entry === 'route.ts') acc.push(full);
  }
  return acc;
}

describe('every AI route honours the billing kill-switch', () => {
  const files = [
    ...routeFiles(path.join(SRC, 'app', 'api', 'ai')),
    path.join(SRC, 'app', 'api', 'assistant', 'route.ts'),
  ];

  it('found the AI routes to check', () => {
    // A gate that scans nothing passes forever.
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(files.map((f) => [path.relative(SRC, f), f] as const))(
    '%s reaches the kill-switch',
    (rel, full) => {
      if (EXEMPT[rel]) {
        expect(EXEMPT[rel].length).toBeGreaterThan(20);
        return;
      }
      const body = readFileSync(full, 'utf8');
      // Two sanctioned routes to the check: the shared plan-guard choke point
      // (withPlanCheck and reservePlanQuota both call isAiEnabled), or a direct
      // gate for routes that have no plan gate at all.
      const viaPlanGuard = /withPlanCheck|reservePlanQuota/.test(body);
      const viaDirectGate = /aiKillSwitchGate|withAiKillSwitch/.test(body);

      if (!viaPlanGuard && !viaDirectGate) {
        throw new Error(
          `${rel} calls a model with no kill-switch check. Wrap it in withPlanCheck(...) ` +
            `(which gates via reservePlanQuota), or call aiKillSwitchGate() at the top of the ` +
            `handler. If it genuinely must answer while AI is paused, add it to EXEMPT in ` +
            `this test with the reason.`,
        );
      }
    },
  );

  it('keeps the kill-switch read inside the shared plan-guard choke point', () => {
    // If this import is ever dropped, every route relying on withPlanCheck
    // silently stops honouring the switch while still looking gated.
    const planGuard = readFileSync(path.join(SRC, 'lib', 'plan-guard.ts'), 'utf8');
    expect(planGuard).toMatch(/from '\.\/ai-killswitch'/);
    expect(planGuard).toMatch(/isAiEnabled\(\)/);
  });
});
