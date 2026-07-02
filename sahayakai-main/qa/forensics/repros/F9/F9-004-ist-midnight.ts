/**
 * F9-004 — IST teacher writes attendance for "today" at 04:30 IST, server
 * (Cloud Run, UTC) sees that date as future and rejects.
 *
 * No HTTP call needed — this is a static demonstration of the broken
 * todayStr computation. Run with: pnpm tsx F9-004-ist-midnight.ts
 */

// Simulate clock @ 2026-06-05 23:00:00 UTC (== 2026-06-06 04:30 IST).
const FAKE_UTC = new Date('2026-06-05T23:00:00.000Z');

// What the server computes (mirrors actions/attendance.ts:292):
const todayStr_server = FAKE_UTC.toLocaleDateString('sv', { timeZone: 'UTC' });
console.log('server todayStr (UTC):', todayStr_server); // 2026-06-05

// What the IST client computes:
const todayStr_client = FAKE_UTC.toLocaleDateString('sv', { timeZone: 'Asia/Kolkata' });
console.log('client todayStr (IST):', todayStr_client); // 2026-06-06

console.log('check: date > todayStr ?', todayStr_client > todayStr_server);
console.log('=> server throws "Cannot mark attendance for future dates" for an IST teacher saving today.');

// Fix demo (IST-pinned):
const istNow = new Date(FAKE_UTC.getTime() + 5.5 * 3600_000);
const todayStr_fixed = istNow.toISOString().slice(0, 10);
console.log('fixed todayStr (IST-pinned):', todayStr_fixed);
console.log('check: date > todayStr ?', todayStr_client > todayStr_fixed, '(should be false)');
