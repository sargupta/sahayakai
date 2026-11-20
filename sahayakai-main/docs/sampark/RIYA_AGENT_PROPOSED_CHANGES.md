# Riya agent — proposed configuration changes (NOT APPLIED)

**Status:** this is a proposal for your review. Nothing here has been sent to ElevenLabs.

**Target:** the confirmed clone only (`…mf5yr2`, branch `…fpdtj2`), never Varunesh's source agent.

**Basis:** Varunesh's export, `E:\sargvision\sahayakcallagentvarunesh.txt`, sha256 `ad4ebebf…721bcb`. The live clone has not been read yet (§0), so each change applies only where `verify-riya-clone.mjs` confirms the clone still has the setting.

**How to apply once approved:** edit in the ElevenLabs dashboard on the clone's branch, then publish that branch. The equivalent API call is `PATCH /v1/convai/agents/{clone_id}?branch_id=…` with only the fields below. Then re-run `verify-riya-clone.mjs` and expect the FAILs listed in §0 to become PASS. Changes 1, 2 and 7 change the clone's prompt hash, so after them a source-vs-clone comparison reports intended differences for those rows.

## 0. Why each change is needed

| Export setting | Problem | Change |
|---|---|---|
| First message: ".....Hello..... this is Riya, calling from {{school_name}}...with an important update..Is this a good time to talk?" | Does not say Riya is an AI. The Sampark plan's disclosure rule and this project require it at the start. | 1 |
| Prompt §1: "Do not volunteer that you are an AI." Each node also says "Do not mention that you are an AI unless the parent asks." | Contradicts upfront disclosure. | 2 |
| Each node: "The call opened with: \"Hello, this is Riya calling from {{school_name}} …\"" | Must match the new first message, or the model may re-introduce itself. | 2 |
| Absence node, busy branch: "Please contact the school as soon as you can about your child's attendance." | Reveals an attendance matter to a listener who has **not** been confirmed as the guardian. | 3 |
| Absence node, guardian question: "I'm calling about your child's attendance. Am I speaking with the parent or guardian of {{student_name}}?" | Reveals the topic before verification. | 3 |
| `privacy.record_voice: true`, `retention_days: -1`, `delete_audio: false`, `delete_transcript_and_pii: false` | Audio and transcripts are kept forever. | 4 |
| `auth.enable_auth: false` | Anyone with the agent id can open a web conversation, which costs money and exposes the agent's behaviour. | 5 |
| `call_limits: { agent_concurrency_limit: -1, daily_limit: 100000 }` | No ceiling on runaway cost. | 5 |
| `conversation.max_duration_seconds: 600` | Sampark plan cap is about 4 minutes. | 5 |
| No `stop_requested` or `recipient_confirmed` data-collection fields | Sahayak can only detect a stop request by phrase matching, and cannot record whether the listener was verified. | 6 |
| Six `eq` edges on `call_purpose`, no fallback | An unexpected value would run the generic prompt. Sahayak already refuses unknown values; this adds a second guard. | 7 |
| Phone number: inbound on, `allowed_addresses: ["0.0.0.0/0"]` (ElevenLabs' default, meaning any source) | Any SIP source can deliver inbound calls to the agent. The agent would then speak placeholder demo data (DPS Siliguri, Samuel Jackson). | 8 (number-level) |
| `workspace_overrides.webhooks.post_call_webhook_id: null` | Sahayak receives no call outcomes. | §7 of the integration doc (workspace setting) |

## 1. First message (`conversation_config.agent.first_message`)

```diff
- .....Hello..... this is Riya, calling from {{school_name}}...with an important update..Is this a good time to talk?
+ Hello, this is Riya, an AI assistant calling on behalf of {{school_name}}, with an important update. Is this a good time to talk?
```

The leading dots in the original are probably pause hints for the voice. If Varunesh relies on them, keep them; the wording change is what matters.

## 2. Disclosure lines (`conversation_config.agent.prompt.prompt` and each node's `additional_prompt`)

```diff
  # 1. Role and Identity
- Introduce yourself simply by name as calling from the school (for example "This is Riya calling from the school"). Do not volunteer that you are an AI. If the parent asks whether you are an AI, a bot, or a real person, always answer honestly that you are an AI assistant. Never claim or imply that you are a human, a staff member, a teacher, or the principal.
+ The opening line already says you are Riya, an AI assistant calling on behalf of the school. If the parent asks again whether you are an AI, a bot, or a real person, answer honestly that you are an AI assistant. Never claim or imply that you are a human, a staff member, a teacher, or the principal.
```

```diff
  # 8. Call-Purpose Instructions
- Note: Every call opens automatically with: "Hello, this is Riya calling from {{school_name}} with an important update. Is this a good time to talk?"
+ Note: Every call opens automatically with: "Hello, this is Riya, an AI assistant calling on behalf of {{school_name}}, with an important update. Is this a good time to talk?"
```

Make the same two replacements in **all six** nodes:

```diff
- The call opened with: "Hello, this is Riya calling from {{school_name}} with an important update. Is this a good time to talk?"
+ The call opened with: "Hello, this is Riya, an AI assistant calling on behalf of {{school_name}}, with an important update. Is this a good time to talk?"
...
- - Do not mention that you are an AI unless the parent asks. If asked, answer honestly. Never claim to be a human.
+ - You have already said you are an AI assistant. If asked again, confirm it. Never claim to be a human.
```

## 3. Absence workflow — no topic before verification (absence node)

```diff
- - If the parent says it is not a good time or they are busy, say: "I understand. Please contact the school as soon as you can about your child's attendance. Thank you." and end the call. Do not share any further details.
+ - If the parent says it is not a good time or they are busy, say: "I understand. Please contact the school when you can. Thank you." and end the call. Do not share any details.
- - If the parent agrees to talk, your next reply must be ONLY: "Thank you. I'm calling about your child's attendance. Am I speaking with the parent or guardian of {{student_name}}?"
+ - If the parent agrees to talk, your next reply must be ONLY: "Thank you. Am I speaking with the parent or guardian of {{student_name}}?"
```

The absence workflow also stays **off** in Sahayak (`SAMPARK_RIYA_PURPOSES`) until this change is made and reviewed. The Sampark plan also treats absence as a tier-2 sensitive purpose that should page staff when the call is placed.

## 4. Recording and retention (`platform_settings.privacy`) — choose one

**Option A (recommended for the pilot): no audio, short transcript retention.**

```json
{ "record_voice": false, "retention_days": 30, "delete_audio": true, "delete_transcript_and_pii": false, "zero_retention_mode": false }
```

Sahayak then keeps transcripts only if `SAMPARK_RIYA_STORE_TRANSCRIPTS=true`, and only for `SAMPARK_RIYA_TRANSCRIPT_DAYS` days.

**Option B: zero retention.**

```json
{ "zero_retention_mode": true, "record_voice": false }
```

The post-call webhook still delivers analysis. Check that your plan supports zero retention.

Set `SAMPARK_RIYA_RECORDING_OFF_CONFIRMED=true` **only** after A or B is live **and** `verify-riya-clone.mjs` shows `12a PASS`. Until then, every family needs `recorded_conversation` consent.

## 5. Access and limits

```json
{
  "platform_settings": {
    "auth": { "enable_auth": true },
    "call_limits": { "agent_concurrency_limit": 2, "daily_limit": 50, "bursting_enabled": false }
  },
  "conversation_config": { "conversation": { "max_duration_seconds": 240 } }
}
```

Outbound SIP calls placed with the API key are unaffected by `enable_auth`. Only anonymous web and widget sessions are blocked.

## 6. Data collection — two new fields (`platform_settings.data_collection`)

```json
{
  "recipient_confirmed": { "type": "string", "enum": ["yes", "no", "not_asked"],
    "description": "Did the listener confirm they are the parent or guardian of the named student? yes, no, or not_asked if the call ended before the question." },
  "stop_requested": { "type": "string", "enum": ["yes", "no"],
    "description": "Did the listener ask not to be called again, to stop these calls, or to remove their number? yes or no." }
}
```

Sahayak already reads both. A `stop_requested: yes` on a call to a real parent writes a routine suppression pending office confirmation. On a test-phone call it is only audited.

## 7. Safe default for an unknown `call_purpose` (workflow)

Add a node `unknown_purpose` (type `override_agent`) with this additional prompt:

> You do not have a valid reason for this call. Say only: "I'm sorry, this call was made in error. Please contact the school if you need anything. Goodbye." Then use the end_call tool. Do not share any school or student details.

Then add one edge from `start_node` to that node. Its forward condition is the negation of the six existing conditions (all six `eq` expressions combined with `not` / `and`).

If the dashboard cannot express that condition, drop this change and rely on the server's strict allow-list (`RiyaPurposeSchema`, covered by a test).

## 8. Phone number (number-level, `PATCH /v1/convai/phone-numbers/{id}`) — depends on your number decision

- **If a new dedicated test number is imported for the clone:** create it with inbound off, or with `inbound_trunk.allowed_addresses` set to Vobiz's published SIP signalling IPs. Get the IPs from Vobiz in writing. TCP or TLS only, because the allow-list does not apply to UDP.
- **Varunesh's existing number:** do not change it without his agreement. It belongs to the source agent.

## Not proposed

- No voice, LLM or turn-taking changes. They pass parity by design.
- No change to Varunesh's source agent.
