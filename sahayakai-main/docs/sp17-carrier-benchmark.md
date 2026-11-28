# SP-17: Carrier Benchmark Script, Scoring Table & Vendor Comparison

**Updated:** 2026-11-28  
**Test Number:** `+91 7384273605` (test phone only)  
**Target Carriers:** Exotel (`+91 80 4728 4463`), Vobiz (`VOBIZ_FROM_NUMBER`), Plivo (`+91 80 6552 2006`)

---

## 1. Fixed Test Script (5 Runs per Carrier)

Every carrier runs the exact same 4-turn prompt sequence so connect rate, reply latency, audio quality, and cost/minute are directly comparable:

1. **Turn 1 (Opener / Recording Notice):**  
   *"Hello, this is Riya calling from Sargvision School with an important update. This call may be recorded. Is this a good time to talk?"*
2. **Turn 2 (Information Delivery):**  
   *"The parent-teacher meeting for Class 7 Section B is scheduled for Saturday at 10:30 in the morning."*
3. **Turn 3 (Interactive Follow-up):**  
   *"Could you confirm whether you will be able to attend, or if you prefer a callback from the class teacher?"*
4. **Turn 4 (Closing):**  
   *"Thank you for your time. Have a wonderful day."*

---

## 2. How to Run the Benchmark

Run from `sahayakai-main/` (never print or commit credentials; read from `.env.local` or `gcloud secrets`):

```powershell
# Dry-run verification (no phone rings):
node scripts/sampark/carrier-benchmark.mjs --carrier vobiz --runs 5 --to +917384273605 --dry-run

# Live 5-run benchmark (requires +917384273605 to be answered):
node scripts/sampark/carrier-benchmark.mjs --carrier vobiz --runs 5 --to +917384273605
node scripts/sampark/carrier-benchmark.mjs --carrier exotel --runs 5 --to +917384273605
node scripts/sampark/carrier-benchmark.mjs --carrier plivo --runs 5 --to +917384273605
```

---

## 3. Scoring Table (Log Every Run)

| Carrier | Run # | Call ID / SID | Connected? | Setup / Ring (ms) | Agent Reply Delay (`first_audio_ms`) | Audio Quality (1–5 / Notes) | Failure Reason | Cost / Min (INR) | Recording Link |
|---|---|---|---|---|---|---|---|---|---|
| Exotel | 1–5 (prior) | *2026-11-28 attempt* | 0/5 (`no-answer`) | — | — | — | Test phone not picked up | — | — |
| Exotel | 1 | | | | | | | | |
| Exotel | 2 | | | | | | | | |
| Exotel | 3 | | | | | | | | |
| Exotel | 4 | | | | | | | | |
| Exotel | 5 | | | | | | | | |
| Vobiz | 1 | | | | | | | | |
| Vobiz | 2 | | | | | | | | |
| Vobiz | 3 | | | | | | | | |
| Vobiz | 4 | | | | | | | | |
| Vobiz | 5 | | | | | | | | |
| Plivo | 1 | | | | | | | | |
| Plivo | 2 | | | | | | | | |
| Plivo | 3 | | | | | | | | |
| Plivo | 4 | | | | | | | | |
| Plivo | 5 | | | | | | | | |

---

## 4. Vendor Comparison Template for Varunesh (SP-14)

| Metric | Vobiz | Plivo | Exotel |
|---|---|---|---|
| **Connect Rate (answered / 5)** | *pending 5 answered runs* | *pending 3 answered runs* | *0/5 prior (no pickup); pending re-run* |
| **Median Agent Reply Delay (`first_audio_ms`)** | *pending* | *pending* | *pending* |
| **Wire Codec & Frame Cadence** | μ-law 8 kHz, 20 ms (`frames_per_message=1`) | μ-law 8 kHz, 100 ms (`frames_per_message=5`) | PCM16 8 kHz, ≥200 ms (`3200 B` chunks + μ-law round-trip today) |
| **Audio Quality Assessment** | Baseline clean PSTN voice | Smooth with 100 ms batching | Degraded by μ-law↔PCM16 round-trip & mid-turn zero-padding |
| **Webhook Security & Quirk Risk** | Custom token + `keepCallAlive` + REST hangup | Plivo V3 HMAC signature + REST hangup | No webhook HMAC (URL token only); drops URL query params; `Duration` null on AgentStream |
| **Cost / Minute** | *fill from Vobiz billing* | *fill from Plivo billing* | *fill from Exotel billing* |
| **Recommendation** | Primary candidate for AtithiVani & Sampark | Required for Placement World (`+91 80 6552 2006`) | Hold for general rollout until P1 codec/flush fixes verify cleanly |
