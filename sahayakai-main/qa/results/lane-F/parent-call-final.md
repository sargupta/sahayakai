# Parent-call Track — Shadow-mode parity report

- Base URL: `https://sahayakai-hotfix-resilience-zwydpvyuca-as.a.run.app`
- Simulation ran: 2026-06-06T03:41:41.130Z
- Scoring ran: 2026-06-06T03:47:27.349Z

## Aggregate

| Metric | Value | Target | Pass? |
|---|---:|---:|:-:|
| Total calls | 33 | 33 | ✓ |
| Clean calls (90% bar) | 0/33 | ≥30 | ✗ |
| Sidecar success rate | 0.0% | ≥90% | ✗ |
| Script coverage on sidecar | 0.0% | ≥90% | ✗ |
| Action-code agreement | 0.0% | ≥80% | ✗ |

## Verdict

**HOLD (do not promote)**

## Per-call breakdown

| Lang | Scenario | Turns | Sidecar | Script% | Agree% | Clean |
|---|---|:-:|:-:|---:|---:|:-:|
| English | sick | 0/6 | 0 | 0% | 0% | ✗ |
| English | family | 0/6 | 0 | 0% | 0% | ✗ |
| English | unknown | 0/6 | 0 | 0% | 0% | ✗ |
| Hindi | sick | 0/6 | 0 | 0% | 0% | ✗ |
| Hindi | family | 0/6 | 0 | 0% | 0% | ✗ |
| Hindi | unknown | 0/6 | 0 | 0% | 0% | ✗ |
| Bengali | sick | 0/6 | 0 | 0% | 0% | ✗ |
| Bengali | family | 0/6 | 0 | 0% | 0% | ✗ |
| Bengali | unknown | 0/6 | 0 | 0% | 0% | ✗ |
| Telugu | sick | 0/6 | 0 | 0% | 0% | ✗ |
| Telugu | family | 0/6 | 0 | 0% | 0% | ✗ |
| Telugu | unknown | 0/6 | 0 | 0% | 0% | ✗ |
| Marathi | sick | 0/6 | 0 | 0% | 0% | ✗ |
| Marathi | family | 0/6 | 0 | 0% | 0% | ✗ |
| Marathi | unknown | 0/6 | 0 | 0% | 0% | ✗ |
| Tamil | sick | 0/6 | 0 | 0% | 0% | ✗ |
| Tamil | family | 0/6 | 0 | 0% | 0% | ✗ |
| Tamil | unknown | 0/6 | 0 | 0% | 0% | ✗ |
| Gujarati | sick | 0/6 | 0 | 0% | 0% | ✗ |
| Gujarati | family | 0/6 | 0 | 0% | 0% | ✗ |
| Gujarati | unknown | 0/6 | 0 | 0% | 0% | ✗ |
| Kannada | sick | 0/6 | 0 | 0% | 0% | ✗ |
| Kannada | family | 0/6 | 0 | 0% | 0% | ✗ |
| Kannada | unknown | 0/6 | 0 | 0% | 0% | ✗ |
| Punjabi | sick | 0/6 | 0 | 0% | 0% | ✗ |
| Punjabi | family | 0/6 | 0 | 0% | 0% | ✗ |
| Punjabi | unknown | 0/6 | 0 | 0% | 0% | ✗ |
| Malayalam | sick | 0/6 | 0 | 0% | 0% | ✗ |
| Malayalam | family | 0/6 | 0 | 0% | 0% | ✗ |
| Malayalam | unknown | 0/6 | 0 | 0% | 0% | ✗ |
| Odia | sick | 0/6 | 0 | 0% | 0% | ✗ |
| Odia | family | 0/6 | 0 | 0% | 0% | ✗ |
| Odia | unknown | 0/6 | 0 | 0% | 0% | ✗ |

## Notes

- Sidecar replies pulled from `agent_shadow_diffs/{date}/shadow_calls/{callSid}__{turn}`.
- Action codes derived heuristically (ACK_END / ASK_AGAIN / ESCALATE / ACK) since neither runtime emits explicit codes; same derivation applied to both sides to keep agreement meaningful.
- Script coverage uses Unicode block matching per language (Latin for English, Devanagari for Hindi/Marathi, Gurmukhi for Punjabi, etc.).
