# SahayakAI Social Automation — services layer

Scaffolding for the Instagram + WhatsApp + outreach + CRM stack described
in `.claude/plans/i-want-to-do-twinkly-wigderson.md`.

This PR adds the **foundation only**:

- `services/baileys-worker/` — Node + Baileys per-teacher WA sessions, antiban + daily caps, Redis-backed counters
- `services/ig-worker/` — Python + FastAPI wrapper over `instagrapi`, session persistence + daily caps
- `services/docker-compose.social.yml` — n8n, Twenty CRM, Postgres, Redis, both workers
- `src/lib/social/worker-client.ts` — typed HTTP client for the workers
- `src/app/api/wa/{webhook,send,pair}/route.ts`
- `src/app/api/ig/{publish,reply}/route.ts`
- `src/app/connect-whatsapp/page.tsx` — teacher BYO pairing UI
- `src/components/send-to-whatsapp-button.tsx` — reusable trigger

## Still to do (tracked in the plan)

| Week | Item |
|---|---|
| 0 | Create `@sahayakai` IG Business + FB Page, register WA brand SIM, set up WABA + Cloud API, submit IG Graph API app review |
| 1 | Wire `/api/wa/webhook` → `/api/assistant` → Cloud API reply; Graph API publish path; daily nudge cron in n8n |
| 2 | Deploy Twenty CRM + OpenOutreach (LinkedIn discovery) |
| 3 | Deploy openoutreach (email) + IG burner outreach flows |
| 4 | IG→WA handoff in n8n + monitoring dashboard + kill-switch flag |

## Local dev

```bash
cd services
cp .env.social.example .env.social   # fill in
docker compose --env-file .env.social -f docker-compose.social.yml up -d
```

| Service | Port | URL |
|---|---|---|
| n8n | 5678 | http://localhost:5678 |
| Twenty CRM | 3001 | http://localhost:3001 |
| baileys-worker | 8081 | http://localhost:8081/health |
| ig-worker | 8082 | http://localhost:8082/health |
| Postgres | 5432 | — |
| Redis | 6379 | — |

## Risk model recap

| Surface | Stack | Why |
|---|---|---|
| Brand `@sahayakai` posts/DMs | IG Graph API (TODO) | Zero ban risk on the brand |
| Brand WA number | Meta WhatsApp Cloud API (TODO) | Service convos free + unlimited |
| Teacher → parent WA | Baileys (BYO teacher number) | Risk lives with the teacher's number, not the brand |
| Founder cold-DM outreach | instagrapi on burners + user's personal IG business acct | Burners disposable; brand isolated |

**Never** put the brand number/handle on Baileys or instagrapi.
