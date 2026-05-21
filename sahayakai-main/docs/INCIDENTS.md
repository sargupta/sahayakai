# Incident log

Append-only record of production incidents. Newest at top.

Use this for things that broke in prod and required intervention (rollback, hotfix, manual data fix). Skip noise (a flaky test that retries clean, a one-off Cloud Build hiccup).

## Template

```markdown
## YYYY-MM-DD — <short title>

**Severity:** SEV1 (down) / SEV2 (degraded) / SEV3 (minor) / near-miss

**Detected by:** <user report / monitor / self-audit>

**Detected at:** <UTC timestamp>

**Resolved at:** <UTC timestamp>

**Duration:** <minutes>

**Impact:** <users affected, feature surface>

### What broke
<2–3 sentences>

### Root cause
<technical detail; cite commit + file + line if known>

### Fix
<what landed; link to PR>

### How we caught it / how we'd catch it sooner
<monitoring, smoke test gap, etc.>

### Action items
- [ ] <preventive change>
- [ ] <monitoring change>
- [ ] <doc update>
```

---

<!-- Historical incidents below (newest first). When adding, copy the
     template above and fill it in. -->

## 2026-05-19 — intent classifier 500 from Gemini structured-output rejection of `const` (near-miss; demo blocker)

**Severity:** SEV2 (degraded)

**Detected by:** NCERT demo dry-run

**Detected at:** approx 2026-05-19 (commit `7e8be6e5a`)

**Resolved at:** same day, ~hours

**Duration:** unclear (caught pre-demo, but likely degraded for some users on develop prior to fix)

**Impact:** `/api/ai/intent` returned 500 on certain queries. Affected VIDYA voice-to-action chain and the intent classifier used by multiple flows.

### What broke
The `VidyaActionSchema` used `z.literal('...')` for several discriminated-union variants. Zod compiles `z.literal()` to JSON-Schema `const`, which Gemini's structured-output validator rejects at deeply nested schemas (> ~5 levels).

### Root cause
Zod → JSON-Schema → Gemini structured output: `z.literal()` becomes `{"const": "..."}` which Gemini's parser rejects below a certain nesting depth. The schema in question had several layers (VidyaAction → action variants → params → nested options).

### Fix
Replaced `z.literal('x')` with `z.enum(['x'] as const)` throughout `VidyaActionSchema`. `z.enum` compiles to `{"enum": ["x"]}` which Gemini accepts. Commit `7e8be6e5a`.

### How we caught it / how we'd catch it sooner
Regression test added at `sahayakai-main/src/__tests__/ai/agent-schema-no-const.test.ts` — scans all `outputSchema`s for `const` and fails CI if found.

### Action items
- [x] Regression test in place
- [ ] Consider lint rule to disallow `z.literal` in any AI flow schema directly (Phase C+ task)
