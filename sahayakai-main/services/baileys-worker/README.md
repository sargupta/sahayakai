# baileys-worker

Per-teacher WhatsApp worker for SahayakAI's BYO-number flow.

**Risk model:** the brand WhatsApp number NEVER touches this worker. Only
teachers who explicitly pair their own number from `/connect-whatsapp` end
up with a session here. If a teacher's number is banned, the cost is on
their personal account — the SahayakAI brand stays clean.

## Endpoints

All endpoints (except `/health`) require header `X-Internal-Key: <INTERNAL_API_KEY>`.

| Method | Path | Body | Purpose |
|---|---|---|---|
| `GET`  | `/health` | — | Liveness; returns active session count |
| `POST` | `/pair` | `{ teacherUid, phoneNumber }` | Returns 8-digit pairing code; teacher types it into WhatsApp → Linked devices |
| `GET`  | `/status/:teacherUid` | — | `{ state: 'connecting' \| 'open' \| 'closed' }` |
| `POST` | `/send` | `{ teacherUid, to, text?, mediaUrl?, mediaType?, caption? }` | Send text or media. Returns `429` if daily cap reached |
| `POST` | `/logout/:teacherUid` | — | Tears down the session and wipes local auth state |

## Antiban defaults

- `DAILY_CAP=80` per teacherUid per day
- Send delay sampled with Gaussian-ish jitter between `MIN_DELAY_MS` and `MAX_DELAY_MS`
- `presenceUpdate('composing')` fires before every text/media send

See `src/antiban.ts` and the plan at
`.claude/plans/i-want-to-do-twinkly-wigderson.md` for the full risk
mitigation playbook (warmup ramp, reply-ratio tracking, circuit-breaker).

## Local dev

```bash
npm install
INTERNAL_API_KEY=dev-key REDIS_URL=redis://localhost:6379 npm run dev
```

Or via the social compose stack (recommended):

```bash
cd ../   # services/
cp .env.social.example .env.social   # fill values
docker compose --env-file .env.social -f docker-compose.social.yml up -d baileys-worker
```

## Production deploy

Cloud Run, `min-instances=1`, CPU always-on, mount a persistent volume
(or migrate to a Redis-backed auth provider — see TODO in `session-manager.ts`).
