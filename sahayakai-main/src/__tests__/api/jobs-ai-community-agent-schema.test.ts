/**
 * @jest-environment node
 *
 * F12-P1-08: ai-community-agent writes community_chat using `createdAt` not `timestamp`.
 * We verify by reading the source file (no need to execute the LLM-heavy handler).
 */
import fs from 'fs';
import path from 'path';

describe('ai-community-agent community_chat schema (F12-P1-08)', () => {
    const file = path.join(process.cwd(), 'src/app/api/jobs/ai-community-agent/route.ts');
    const src = fs.readFileSync(file, 'utf8');

    it('writes createdAt, not timestamp, into community_chat add()', () => {
        // Find the `db.collection('community_chat').add({` block and ensure the
        // following object contains `createdAt:` and not `timestamp:`.
        const idx = src.indexOf("db.collection('community_chat').add({");
        expect(idx).toBeGreaterThan(-1);
        const block = src.slice(idx, idx + 400);
        expect(block).toMatch(/createdAt:\s*FieldValue\.serverTimestamp\(\)/);
        expect(block).not.toMatch(/timestamp:\s*FieldValue\.serverTimestamp\(\)/);
    });

    it('reads recent community_chat ordered by createdAt (cooldown alignment)', () => {
        // All orderBy on community_chat should use createdAt, not timestamp.
        const orderTimestampRefs = src.match(/community_chat[\s\S]{0,200}orderBy\(['"]timestamp['"]/g) || [];
        expect(orderTimestampRefs).toEqual([]);
    });
});
