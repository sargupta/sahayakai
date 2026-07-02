#!/usr/bin/env node
/**
 * F5-006 Repro: Twilio webhook retry → transcript duplication, shadow-diff loss.
 *
 * Bug: src/app/api/attendance/twiml/route.ts:170-274
 *
 *   const doc = await outreachRef.get();
 *   const turnCount = doc.data().turnCount ?? 0;        // T1 read
 *   const transcript = doc.data().transcript ?? [];     // T1 read
 *   transcript.push({ role: 'parent', text: parentSpeech, ... });
 *   const newTurnCount = turnCount + 1;
 *   const agentResult = await dispatchParentCallReply({ callSid, turnNumber: newTurnCount, ... });
 *   transcript.push({ role: 'agent', text: agentReply, ... });
 *   await doc.ref.update({ transcript, turnCount: newTurnCount, ... });   // T2 write
 *
 * Twilio retry policy: if our endpoint takes >15s OR returns 5xx, Twilio
 * may retry the same webhook with the same CallSid + form payload. The
 * AI dispatcher already burns several seconds (sidecar + Gemini), so the
 * retry window IS reachable in tail latency.
 *
 * Two concurrent twiml invocations (original + Twilio retry):
 *
 *   A: read turnCount=3, transcript=[...3 entries]
 *   B: read turnCount=3, transcript=[...3 entries]
 *   A: dispatch → reply A → transcript.push(parent)+push(agent A) → update(turnCount=4, transcript=5 entries)
 *   B: dispatch → reply B → transcript.push(parent)+push(agent B) → update(turnCount=4, transcript=5 entries, LAST WRITE WINS)
 *
 * Effects:
 *   - turnCount idempotent (both set 4) — OK
 *   - transcript: last-write-wins → loses agent A's response from history
 *     even though Twilio already spoke it to the parent
 *   - shadow-diff: dispatcher writes
 *     agent_shadow_diffs/{date}/shadow_calls/{callSid}__0004
 *     TWICE with different sidecarReply payloads → 1 row survives,
 *     parity comparator loses a sample
 *   - 2× Gemini API spend per retry
 *
 * Severity: P1
 *   - Transcript divergence between what parent heard and what Firestore stores
 *   - Post-call summary (shown to teacher) is from the wrong branch
 *
 * Fix: dedupe at the entry of the twiml route by claiming a turn-lock:
 *   await db.collection('outreach').doc(outreachId)
 *     .collection('turn_locks').doc(`${newTurnCount}`)
 *     .create({ claimedAt: ..., callSid });
 *   // ALREADY_EXISTS → return cached TwiML or 200 noop
 *
 * Or use an idempotency header: hash(parentSpeech + turnCount) as the
 * lock key.
 */
console.log(JSON.stringify({
  test: 'F5-006 twiml webhook retry duplicates transcript + collides shadow-diff',
  affected: ['src/app/api/attendance/twiml/route.ts:170-274'],
  severity: 'P1',
  fix: 'Claim a per-turn lock doc with .create() before dispatching',
}, null, 2));
