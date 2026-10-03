# Real test call runbook (Vobiz keypad capture)

One real call, to your own phone, placed by a standalone script. It touches no
Firestore, no Sampark engine and no model. Script: `scripts/sampark/vobiz-test-call.ts`.

## What this call proves, and what it does not

Proves (once it works):
- Vobiz accepts our `POST /Call/` dial body and reaches your handset.
- Vobiz fetches our answer URL and accepts the `<Gather><Play>` XML.
- Vobiz can fetch and play a WAV we serve (mu-law tag 7, or PCM with `--pcm`).
- A keypress arrives at our `action` URL, and we learn the real field names.
- The hangup callback arrives (cause, duration field names).

Does NOT prove: voice quality of the final TTS clips, Gemini Live streaming,
anything about the engine, DLT/TRAI compliance, bulk or concurrent calling,
behaviour on other carriers' handsets.

**Be honest about the status:** Gather + Play against Vobiz is UNVERIFIED until
this call is made. The XML follows docs.vobiz.ai, but nothing in this repo has
ever exercised it on a real call. Treat a first failure as information.

## Prerequisites

- Vobiz account id (`VOBIZ_AUTH_ID`) and auth token (`VOBIZ_AUTH_TOKEN`).
- A from-number / caller-id enabled on that account (`VOBIZ_FROM_NUMBER`).
- Your own phone in E.164 (`TEST_PHONE_E164`), not a `+915...` synthetic number.
- A public https tunnel to port 8787 (`PUBLIC_BASE_URL`):
  `cloudflared tunnel --url http://localhost:8787` or `ngrok http 8787`.
- Node 20+, `npm ci` in `sahayakai-main/`.
- Optional: gcloud ADC, only if you render your own `--clips` with the repo's TTS.
- No signing key to set: a random per-run key is generated and never leaves memory.

## Commands (run from `sahayakai-main/`)

Dry run first. It prints the guard results and the XML, and dials nothing. It is
also what happens automatically if any required env var is missing.

macOS / Linux:

```bash
export TEST_PHONE_E164=+919XXXXXXXXX
export PUBLIC_BASE_URL=https://<your-tunnel>.trycloudflare.com
export VOBIZ_AUTH_ID=...  VOBIZ_AUTH_TOKEN=...  VOBIZ_FROM_NUMBER=+91...
npx tsx scripts/sampark/vobiz-test-call.ts --i-own-this-number --use-openers Hindi --dry-run
```

Windows PowerShell:

```powershell
$env:TEST_PHONE_E164="+919XXXXXXXXX"
$env:PUBLIC_BASE_URL="https://<your-tunnel>.trycloudflare.com"
$env:VOBIZ_AUTH_ID="..."; $env:VOBIZ_AUTH_TOKEN="..."; $env:VOBIZ_FROM_NUMBER="+91..."
npx tsx scripts/sampark/vobiz-test-call.ts --i-own-this-number --use-openers Hindi --dry-run
```

Start the tunnel in a second terminal, then the real call (same env, drop `--dry-run`):

```bash
npx tsx scripts/sampark/vobiz-test-call.ts --i-own-this-number --use-openers Hindi
```

Flags: `--i-own-this-number` (required), `--lang <Language>`, `--use-openers <Language>`,
`--clips <dir>`, `--pcm`, `--port <n>` (default 8787), `--events <path>`
(default `./testcall-events.jsonl`), `--max-seconds <n>` (default 180), `--dry-run`.

Audio sources:
- `--use-openers <Language>` wraps the repo's pre-recorded mu-law opener
  (`sahayakai-agents/src/sahayakai_agents/telephony/openers/<Language>.ulaw`; English,
  Hindi, Bengali, Gujarati, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil, Telugu; there
  is no Nepali opener) into an 8 kHz mono WAV. This is ONE clip, so there is no
  confirmation audio: after the digit is recorded the call simply hangs up. Digit
  capture is what we are testing. Nothing is synthesised.
- `--clips <dir>` uses `notice.wav` (required), `confirm_1.wav`, `confirm_2.wav`,
  `opt_out_done.wav`, `no_input.wav` (optional) that you pre-rendered.
- `--pcm` converts mu-law to 16-bit PCM WAV (8 kHz, tag 1). Use it if Vobiz rejects or
  garbles the mu-law WAV.

## Time window

The script refuses to dial outside 09:00-21:00 IST, and `/answer` re-checks the
window and returns an empty `<Response/>` if it has closed by pickup. Run it in
daytime India time. Exactly one call is placed per run; there are no retries.

## What you will hear, what to press

1. Phone rings; answer it.
2. You hear the notice clip (the opener, in the language you chose).
3. Press **1** (confirm), **2** (second confirm option), or **9** (opt out). Try a different
   digit on each run; run it again for each. With `--clips` you hear the matching
   confirmation, then the call ends. With only the opener the call just ends.
4. Any other key repeats the notice once; pressing nothing plays `no_input` (if present) and ends.

Note down: audio quality (clipping, speed, static), the delay between picking up and the
audio starting, whether each key registered, and which language you heard.

## Stopping

The run ends by itself when Vobiz reports the hangup, or after `--max-seconds`.
Ctrl-C (or SIGTERM) sends a REST hangup if a call id is known, then exits.

## Troubleshooting

| Symptom | Likely cause / action |
|---|---|
| Vobiz rejects an XML verb (error text on call, or call ends instantly) | Re-run with `--pcm`; copy the exact error text from Vobiz and report it. |
| Call rings, no audio | Check the tunnel is up; look for `audio_served` in `testcall-events.jsonl`. Absent means Vobiz never fetched the WAV (URL/tunnel/format). Present means a format problem: try `--pcm`. |
| Keys do nothing | Open `testcall-events.jsonl`, find `gather_webhook`, read `rawFieldNames`. If the digit field is not `Digits`/`digits`/`Digit`, paste the names back. No `gather_webhook` at all means Vobiz did not call the action URL. |
| Call not placed | See the `dial_result` event: `provider_unconfigured` (credentials or caller-id), `provider_rejected` (+ status), `invalid_destination`, `network`. |
| `/answer` shows `auth_failed` events | Token expired (10 min TTL) or the tunnel rewrote the query string. |
| "outside 09:00-21:00 IST" | By design. Run in the window. |
| "refusing: --i-own-this-number is required" | Add the flag. |
| "PUBLIC_BASE_URL must be https" | Use the tunnel's https URL. |
| Port in use | `--port 8788` and point the tunnel at it. |

## What to paste back for Stage B

The end-of-run summary prints a block between `PASTE THIS BACK` and `END`. It holds: answered,
digit pressed, hangup cause and duration, whether audio was fetched, the raw webhook
parameter NAMES seen (never values), and the audio mode. It contains no secrets or phone
numbers. Also add your listening notes (quality, delay, keys, language) and any Vobiz error
text. The raw `testcall-events.jsonl` is safe to attach too (secrets and tokens are scrubbed;
the phone number is reduced to its last four digits).

## Safety guards (all enforced in the script, each tested)

Flag required; destination is only `TEST_PHONE_E164` (never read from a request); `+915`
synthetic numbers refused; https base URL; IST window at dial and at answer; one call,
no retries; every webhook verifies a domain-separated, 10-minute HMAC token and answers
403 + `<Response/>` on failure; server shuts down on hangup or timeout; Ctrl-C hangs up;
secrets never logged.

Tokens use the same wire format as `src/lib/vobiz/tokens.ts` (`<id>.<exp>.<sig>`) but are
signed locally with a random per-run key under test-only domains, so the shared engine
module is untouched.

## Vobiz docs

- https://www.docs.vobiz.ai/xml/gather
- https://docs.vobiz.ai/xml/response
- https://www.docs.vobiz.ai/llms.txt
