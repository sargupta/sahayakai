# SamparkAI Call Flow — One-Page Architecture & Lifecycle Diagram (SP-18)

**Updated:** 2026-11-28  
**Scope:** End-to-end call flow across `sahayakai-main` (Next.js) + `sahayakai-agents` (Python bridge) + carriers (`Vobiz` | `Plivo` | `Exotel`).

---

## 1. End-to-End Call Lifecycle

```mermaid
flowchart TD
    T["Trigger (Campaign / Teacher Call / API v1 / Scheduler)"] --> G["Policy Gate (evaluateGate: consent, suppression, hours, cap)"]
    G -->|Blocked / Deferred| R0["Record block/defer reason (no dial)"]
    G -->|Allowed| D{"Carrier Dispatch"}

    D -->|Vobiz| V["POST Vobiz /Call/ (mu-law 8kHz, 20ms)"]
    D -->|Plivo| P["POST Plivo /Call/ (mu-law 8kHz, 100ms)"]
    D -->|Exotel| E["POST Exotel /Calls/connect.json (StreamUrl, PCM16 8kHz, >=200ms)"]

    V -->|Answered| B["sahayakai-agents Bridge (/telephony/&lt;carrier&gt;/stream)"]
    P -->|Answered| B
    E -->|Answered| B
    V & P & E -->|No answer / Busy / Failed| S1["Status webhook -> initiation_failure -> Settle"]

    B --> CTX["GET /context?t=token (load 19 variables & language)"]
    CTX --> GR["GREETING (pre-recorded opener + recording notice)"]
    GR --> LOOP

    subgraph LOOP ["Reply Loop (dialogue.py is authority, not LLM)"]
        IN["Caller audio -> Carrier -> STT (Sarvam saaras @ 16k)"] --> CL["dialogue.classify() (no LLM)"]
        CL -->|GREETING -> IDENTITY_CHECK -> MESSAGE_DELIVERY -> PARENT_RESPONSE| LLM["Gemini 2.5 Flash (thinking_budget=0, global -> asia-south1)"]
        LLM --> TTS["Sarvam Bulbul TTS (24kHz PCM16 -> 8kHz wire)"]
        TTS --> OUT["Pacer (_pace_outbound) -> Carrier -> Caller ear"]
        IN -.->|"Caller speaks while Riya speaks"| BI["Barge-in: clear / clearAudio drops carrier buffer"]
    end

    LOOP -->|Error / Timeout > 5s| RT["Retries: jittered backoff (<=7s budget), key-pool failover, _SAY_AGAIN fallback"]
    RT --> LOOP

    LOOP -->|"Opt-out / Goodbye / Max turns"| HO{"Human Hand-off?"}
    HO -->|"Today: no live warm transfer"| CB["end_call() + offer teacher callback proposal"]
    CB --> END["POST signed post_call event -> Next.js applyEvent() -> Settle + Synopsis"]
```

---

## 2. State Machine & Turn Authority (`dialogue.py`)

```mermaid
stateDiagram-v2
    [*] --> GREETING
    GREETING --> IDENTITY_CHECK: Caller responds
    IDENTITY_CHECK --> MESSAGE_DELIVERY: Child name verified (fuzzy_name_in)
    IDENTITY_CHECK --> GOODBYE: Denied / max attempts (3)
    MESSAGE_DELIVERY --> PARENT_RESPONSE: Essentially as written
    PARENT_RESPONSE --> TOOL_LOOKUP: Parent asks school/student question
    TOOL_LOOKUP --> FOLLOW_UP: Tool result (8s timeout)
    PARENT_RESPONSE --> FOLLOW_UP: Callback / Q&A
    FOLLOW_UP --> GOODBYE: Wrap-up / Opt-out / Silence close
    GOODBYE --> ENDED: Carrier hangup + post_call webhook
```

---

## 3. Where Exotel Diverges Today (Why Quality Drops)

1. **P0 (Resolved on `main` via PR #221):** PR #230 used `Url` (ExoML), which Exotel AgentStream ignores. `main` uses `StreamUrl` + `StreamType=bidirectional` + `Call.Status`.
2. **P1 (Audio round-trip):** Bridge runs internally on 8 kHz μ-law, forcing Exotel PCM16 audio through `PCM16 → μ-law → PCM16` on both inbound and outbound legs.
3. **P1 (Chunk padding mid-utterance):** `ExotelCodec` requires `>= 3,200` bytes (200 ms) per frame; flushing on every single empty pacer tick pads brief TTS gaps with up to 180 ms of zero-silence.
4. **Human Hand-over Gap:** Warm/live transfer to a human operator **does not exist today**—only `end_call(...)` plus scheduling a teacher callback proposal.
