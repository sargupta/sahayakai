import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createCrmServer } from '../src/server';
import { loadOrCreateState, loadState } from '../src/store';
import { API_KEY, closeServer, submitDemo } from './helpers';
import type { AddressInfo } from 'node:net';

test('state is created from the seed if missing, mutations persist atomically, and survive a restart', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'mock-crm-'));
    try {
        const file = path.join(dir, 'nested', 'state.json');
        const first = await loadOrCreateState(file);
        assert.equal(first.created, true);
        const { server, app } = createCrmServer({ state: first.state, statePath: file, apiKey: API_KEY });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        const studentId = first.state.planted.attendance.absenceStreak.studentId;
        await submitDemo(base, 'closure', { when: 'today', reason: 'heavy_rain' });
        await submitDemo(base, 'hpc', { studentId, respondentType: 'librarian', sentiment: 'positive', note: 'Finished a Nepali storybook.' });
        const res = await fetch(`${base}/v1/communications`, {
            method: 'POST',
            headers: { authorization: `Bearer ${API_KEY}`, 'content-type': 'application/json' },
            body: JSON.stringify({ externalId: 'persist-1', channel: 'voice_call', guardianId: 'gdn_0001', purpose: 'emergency_closure', outcome: 'answered', occurredAt: '2026-10-01T01:00:00Z' }),
        });
        assert.equal(res.status, 201);
        await app.flushSaves();
        await closeServer(server);

        const files = await readdir(path.dirname(file));
        assert.deepEqual(files, ['state.json'], 'no temp files left behind');
        const reloaded = await loadState(file);
        assert.equal(reloaded.events.length, first.state.events.length);
        assert.ok(reloaded.events.some((e) => e.kind === 'closure' && e.closure?.reason === 'heavy_rain'));
        assert.equal(reloaded.hpcEntries.at(-1)?.note, 'Finished a Nepali storybook.');
        assert.equal(reloaded.communications.at(-1)?.externalId, 'persist-1');
        const again = await loadOrCreateState(file);
        assert.equal(again.created, false);
        assert.equal(again.state.communications.length, 1);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});
