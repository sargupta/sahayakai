# Verification Proofs — SP-18, SP-10, SP-11, SP-17 (2026-11-28)

All checks below were executed locally on `c:\Users\sachi\Downloads\sahayakai` before pushing. No live PSTN calls were placed to `+91 7384273605` (per instruction: do not call the test number yet).

---

## 1. Python Telephony Unit Tests (`sahayakai-agents`)

Command:
```powershell
python -m pytest --noconftest tests/unit/test_telephony_carriers.py tests/unit/test_telephony_audio.py -v
```
Result: **43 passed in 1.28s**
- `tests/unit/test_telephony_carriers.py`: 22 passed (including `test_flush_idle_waits_for_threshold_before_padding_short_tail` and `test_play_pcm8k_le_bypasses_mulaw_round_trip`)
- `tests/unit/test_telephony_audio.py`: 21 passed (including `test_direct_pcm16_helpers_preserve_expected_lengths_without_ulaw`)

---

## 2. TypeScript Typecheck (`sahayakai-main`)

Command:
```powershell
npx tsc --noEmit
```
Result: **exit 0** (clean)

---

## 3. Jest Unit Tests (`sahayakai-main`)

Command:
```powershell
npx jest --coverage=false src/__tests__/sampark/atithivani-flow.test.ts src/__tests__/sampark/placement-world-flow.test.ts
```
Result: **2 suites passed, 9/9 tests passed**
- `atithivani-flow.test.ts`: verifies `09:00–20:00 IST` window (including `09:30` and `19:30` IST outside school hours), 12h checkout deadline, max 2 post-checkout attempts, opt-out suppression, test-phone allow-list, `en`/`hi`/`bn` scripts, and `MemoryAtithiFeedbackStore` persistence.
- `placement-world-flow.test.ts`: verifies `en`/`hi`/`bn` scripts keep opener strictly to Placement World + recording notice (no fee terms upfront), fee line in closing only, edge cases (`wrong_person`, `call_back_later`, `refuses`), Plivo caller ID `918065522006` (`+918065522006`), and HMAC-SHA256 webhook signing/delivery.

---

## 4. CI Quality Gates (`sahayakai-main`)

- `node scripts/ci/check-design-tokens.mjs`: **passed** (`523` repo-wide hits, at `maxHits` `523`).
- `node scripts/find-missing-i18n-keys.mjs --no-write`: **passed** (`0` missing keys across 10 locales, `0` unregistered dynamic `t()` calls).
- `node scripts/sampark/carrier-benchmark.mjs --carrier vobiz --runs 5 --to +917384273605 --dry-run`: **passed** (5 dry-run rows emitted).

---

## 5. Pending Live-Call Proofs (Deferred Until Test Phone Ready)

- SP-18: 3 live Exotel + 3 live Plivo calls to `+91 7384273605`
- SP-10: 3 live AtithiVani calls + saved live recording check
- SP-11: Study client's recorded screening calls, native Hindi/Bengali review, and 3 live Plivo calls (`+918065522006`)
- SP-17: 5 live Vobiz runs + recording links + Varunesh vendor comparison
