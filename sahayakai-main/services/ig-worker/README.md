# ig-worker

FastAPI wrapper around `instagrapi` for SahayakAI's IG automation
(burner outreach + user's personal IG business account for cold DMs).

**Risk model:** the `@sahayakai` brand handle uses the official
Instagram Graph API. This worker exists only for the cold-outreach
DM path and for any scraping/research needs.

## Endpoints

All endpoints require header `X-Internal-Key: <INTERNAL_API_KEY>`.

| Method | Path | Body | Purpose |
|---|---|---|---|
| `GET`  | `/health` | — | Liveness |
| `POST` | `/login` | `{ account, username, password, proxy?, verification_code? }` | First login; persists session to Redis. If challenge: re-call with `verification_code` |
| `POST` | `/dm` | `{ account, to_username, text }` | Send a DM (counts against daily cap) |
| `POST` | `/follow` | `{ account, target_username }` | Follow user (cap-gated) |
| `POST` | `/post` | `{ account, media_url, caption, kind }` | `kind` ∈ `photo \| reel \| story` |
| `GET`  | `/caps/:account` | — | Today's used/cap/remaining per action |

## Daily caps (env-tunable, halve during warmup)

| Action | Default |
|---|---|
| DM | 50 |
| Follow | 30 |
| Like | 60 |
| Comment | 20 |

## Proxy discipline

One **static** mobile or residential proxy per account, set on `/login`
and kept identical for the life of the account. Rotation is a guaranteed
flag — IG fingerprints by IP.

## Local dev

```bash
pip install -r requirements.txt
INTERNAL_API_KEY=dev-key REDIS_URL=redis://localhost:6379 \
  uvicorn app.main:app --reload --port 8082
```
