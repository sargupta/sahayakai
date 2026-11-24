# Riya's fixed lines on the deployed bridge — 2026-11-24

## What happened

First real staging call through Plivo (24 Nov, 22:03 IST, Sampark → `sahayakai-riya-bridge`, event invitation, test phone).
The founder reported it as terrible. Bridge log (`telephony.call_closed`):

- `first_model_audio_ms=3173`, `opener_ms=None`: 3.2 s of silence after pick-up; no recorded opener played.
- `privacy_block … where=riya_pre_verification` 1 s after Riya's first audio: the model said the opener and ran on into
  the event line before the guardian question; the rail muted it and re-asked.
- `identity=unknown`, `stage=greeting`, `message_delivered=False`; the parent hung up after ~20 s (`carrier_disconnect`).

Not defects (checked, left alone):

- Plivo hang-up `DELETE … 404`: the bridge's cleanup ran after the parent had already hung up (stream lasted 19.9 s).
- Cold start: Sampark's warm-up (`/readyz`, 22:03:04) started the instance by 22:03:13, inside the ring; stream 22:03:23.

## Root cause

Riya's flow depends on **pre-rendered fixed lines** (opener, guardian question, who-line, closings). The native-audio
Live model does not reliably say a line "exactly" (RIYA_VOBIZ_QUALITY_2026-11-09, limitation 4), so the bridge plays
these lines itself and tells the model the opener "has ALREADY been spoken". Every tested call had that cache
(`VOBIZ_RIYA_OPENER_DIR`, filled on the local machine by `scripts/render_riya_opener.py`). The Cloud Run bridge never
had one, so on a deployed call the model spoke the opener itself — the untested path.

## Change

`sahayakai-agents/src/sahayakai_agents/telephony/line_tts.py`: when a call's record is loaded, the bridge renders that
call's fixed lines with Cloud Text-to-Speech (`en-IN-Chirp3-HD-Aoede`, same voice name as Riya's Live voice) into the
cache, under the key the bridge already looks up. The opener is awaited (at most 1.5 s, `VOBIZ_RIYA_OPENER_RENDER_WAIT_S`)
before the Live config is built; the rest render in the background. Text-to-speech says exactly the text: a cached line
cannot be a hallucination. Whether the opener is played or spoken by the model is decided once
(`RiyaCall.opener_from_cache`), so a late render is never played on top of the model (no double greeting).

Deploy: `VOBIZ_RIYA_LINE_TTS=1`, `VOBIZ_RIYA_OPENER_DIR=/tmp/riya-lines` (per instance; the first call to a school renders,
later calls reuse). Off, or on any TTS failure, the call behaves exactly as before.

Class gates (`tests/unit/test_telephony_line_tts.py`): the deployed bridge config must switch the cache on; with the cache
on the model is told the opener was spoken; a late opener is never also played.

## Open: two versions of the event-invitation flow

`riya_workflow.json` (what the bridge runs): opener → "good time to talk?" → guardian question → event details.
Sampark `docs/CALL_FLOWS.md` (D1): Tier 0, class-wide, **no listener check** — opener, then the event line.
They disagree. This change keeps the bridge's flow; which one is canonical is a product decision.

## Verification before any phone rings

1. Deploy; bridge log shows `telephony.line_rendered` for the opener and the other lines.
2. One test call: `opener_ms` set, first audio < 1 s, no `privacy_block`, guardian question from the cache,
   `identity=confirmed` → details → close.
