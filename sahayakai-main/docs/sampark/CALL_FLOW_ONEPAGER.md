# SamparkAI Call Flow — Unified Architecture & Lifecycle Diagrams

**Updated:** 2026-11-28  
**Scope:** End-to-end call flows across **Sampark School Calling**, **AtithiVani Post-Stay**, and **Placement World Screening**, spanning `sahayakai-main` (Next.js) + `sahayakai-agents` (Python bridge) + **Vobiz | Plivo | Exotel | ElevenLabs**.

---

## 1. Unified Multi-Product & Multi-Carrier Call Flow

```mermaid
flowchart TD
    subgraph TRIG ["1. Triggers & Isolated Policy Gates"]
        TS["Sampark School (Campaign / Teacher / API v1)"] --> GS["evaluateGate (15 rules: consent, suppression, 10:00-19:00 IST, cap 4/30d)"]
        TA["AtithiVani Checkout (SP-10)"] --> GA["evaluateAtithiPolicy (09:00-20:00 IST, <=12h first call, max 2 calls, opt-out)"]
        TP["Placement World Candidate (SP-11)"] --> GP["placePlacementWorldCall (test-phone guard + Plivo caller ID $PLACEMENT_WORLD_PLIVO_CALLER_ID)"]
    end

    GS -->|Allowed| SEL{"Carrier / AI Path"}
    GA -->|Allowed| SEL
    GP -->|"Plivo $PLACEMENT_WORLD_PLIVO_CALLER_ID"| PL["Plivo REST /Call/ (mu-law 8kHz, 100ms batch)"]

    SEL -->|"Vobiz"| VB["Vobiz REST /Call/ (mu-law 8kHz, 20ms frame)"]
    SEL -->|"Plivo"| PL
    SEL -->|"Exotel (AgentStream)"| EX["Exotel /Calls/connect.json (StreamUrl, PCM16 8kHz, >=200ms)"]
    SEL -->|"ElevenLabs SIP"| EL["ElevenLabs Unified Agent (Vobiz SIP trunk)"]

    VB & PL & EX -->|"No answer / Busy / Failed"| FAIL["Status Webhook -> initiation_failure -> Settle"]
    VB & PL & EX -->|"Call Answered (WebSocket)"| BR["sahayakai-agents Bridge (/telephony/carrier/stream)"]

    BR --> CTX["GET /context?t=token (load variables, language, product_context)"]
    CTX --> OP["Stage 1: Opener + Recording Notice"]

    subgraph LOOP ["2. Bridge Reply Loop (dialogue.py is authority)"]
        IN["Caller Audio -> Carrier -> STT (Sarvam saaras 16kHz)"] --> CL["dialogue.classify() (non-LLM intent & safety)"]
        CL --> LLM["Gemini 2.5 Flash (thinking_budget=0, global -> asia-south1)"]
        LLM --> TTS["Sarvam Bulbul TTS (24kHz PCM16 -> 8kHz carrier codec)"]
        TTS --> PACE["_pace_outbound (20ms cadence; Exotel flush_idle 100ms)"]
        PACE --> EAR["Caller Ear"]
        IN -.->|"Caller interrupts"| BI["Barge-in: clear / clearAudio drops carrier buffer"]
    end

    OP --> LOOP
    LOOP -->|"Timeout >5s / Error"| RET["Retries: <=7s jittered backoff, key pool, _SAY_AGAIN"]
    RET --> LOOP

    LOOP -->|"Opt-out / Complete / Max turns"| HO{"Human Hand-off?"}
    HO -->|"Today: no warm transfer"| CB["end_call() + Callback Proposal"]
    CB --> POST["Signed post_call Webhook -> Persist & Settle"]
    EL -->|"ElevenLabs post-call HMAC"| POST
```

---

## 2. State Machine & Turn Authority (`dialogue.py` — School Calls)

```mermaid
stateDiagram-v2
    [*] --> GREETING
    GREETING --> IDENTITY_CHECK: Caller responds
    IDENTITY_CHECK --> MESSAGE_DELIVERY: Child name verified (fuzzy_name_in)
    IDENTITY_CHECK --> GOODBYE: Denied or 3 failed attempts
    MESSAGE_DELIVERY --> PARENT_RESPONSE: Essentially as written
    PARENT_RESPONSE --> TOOL_LOOKUP: Parent asks school/student question
    TOOL_LOOKUP --> FOLLOW_UP: Tool result (8s timeout)
    PARENT_RESPONSE --> FOLLOW_UP: Callback or Q&A
    FOLLOW_UP --> GOODBYE: Wrap-up, Opt-out, or Silence close
    GOODBYE --> ENDED: Carrier hangup + post_call webhook
```

---

## 3. Product-Specific Flows (AtithiVani & Placement World)

```mermaid
flowchart LR
    subgraph AV ["AtithiVani Post-Stay (SP-10)"]
        A1["Opener: Hotel + Riya + Recording + Opt-out"] --> A2["Q1 Stay (1-5) -> Q2 Room -> Q3 Improvements"]
        A2 -->|"Positive/Neutral"| A3["Save AtithiFeedbackResult"]
        A2 -->|"Issue Raised"| A4["Apologize + Flag Duty Manager + Save issues[]"]
    end

    subgraph PW ["Placement World Screening (SP-11)"]
        P1["Opener ONLY: Placement World + Recorded (NO fee line)"] --> P2{"Edge Case?"}
        P2 -->|"wrong_person / refuses / call_back_later"| P3["Polite Exit -> Signed Webhook"]
        P2 -->|"Confirmed"| P4["Q1 Availability -> Q2 City/Shift -> Q3 Exp -> Q4 Salary/Notice"]
        P4 --> P5["Closing: Fee Line AT THE END ONLY -> Signed Webhook"]
    end
```

---

## 4. Key Architecture Notes & Exotel P1 Fixes

1. **P0 (Resolved on `main` via PR #221):** PR #230 used `Url` (ExoML), which Exotel AgentStream ignores (`Duration` is null). `main` uses `StreamUrl` + `StreamType=bidirectional` + `Call.Status` (PR #230 closed).
2. **P1 (Fixed in PR #245):**
   - `ExotelCodec.flush_idle()` in `exotel_frames.py` + `_pace_outbound` in `router.py` wait 5 idle ticks (100 ms) before zero-padding partial `< 3200 B` tails, eliminating mid-utterance silence stutters.
   - `pcm8k_le_to_pcm16k()` / `pcm24k_to_pcm8k_le()` in `audio.py` + `ExotelCodec.play_pcm8k_le()` enable bypassing the lossy 8-bit μ-law round-trip.
3. **Human Hand-off Gap:** Warm live transfer to a human operator **does not exist today**—calls end with `end_call(...)` plus a scheduled callback proposal.
