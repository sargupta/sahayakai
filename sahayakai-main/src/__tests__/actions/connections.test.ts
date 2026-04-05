/**
 * Server action contract tests for src/app/actions/connections.ts
 */

const mockHeadersMap = new Map<string, string>([['x-user-id', 'user-a']]);
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockHeadersMap),
}));

const store: Record<string, Record<string, any>> = {};

function getCol(path: string) {
    if (!store[path]) store[path] = {};
    return store[path];
}

function makeMockDb() {
    const collection = (colName: string) => ({
        doc: (id: string) => ({
            id,
            get: jest.fn(async () => {
                const data = getCol(colName)[id];
                return { exists: !!data, data: () => data, id };
            }),
            set: jest.fn(async (data: any) => { getCol(colName)[id] = data; }),
            update: jest.fn(async (data: any) => {
                getCol(colName)[id] = { ...getCol(colName)[id], ...data };
            }),
            delete: jest.fn(async () => { delete getCol(colName)[id]; }),
        }),
        where: jest.fn(function (this: any) { return this; }),
        get: jest.fn(async () => {
            const entries = Object.entries(getCol(colName));
            return {
                empty: entries.length === 0,
                docs: entries.map(([id, data]) => ({
                    id,
                    data: () => data,
                })),
            };
        }),
    });

    return {
        collection,
        batch: jest.fn(() => ({
            set: jest.fn(),
            delete: jest.fn(),
            commit: jest.fn(async () => {}),
        })),
    };
}

const mockDb = makeMockDb();
jest.mock('@/lib/firebase-admin', () => ({
    getDb: () => Promise.resolve(mockDb),
}));

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: { serialize: jest.fn((data: any) => data) },
}));

jest.mock('@/app/actions/notifications', () => ({
    createNotification: jest.fn(async () => {}),
}));

import {
    sendConnectionRequestAction,
    acceptConnectionRequestAction,
    declineConnectionRequestAction,
    disconnectAction,
    getMyConnectionDataAction,
} from '@/app/actions/connections';

describe('connections server actions', () => {
    beforeEach(() => {
        Object.keys(store).forEach(k => delete store[k]);
        mockHeadersMap.set('x-user-id', 'user-a');
    });

    describe('auth', () => {
        it('throws Unauthorized when x-user-id missing', async () => {
            mockHeadersMap.delete('x-user-id');
            await expect(sendConnectionRequestAction('user-b')).rejects.toThrow('Unauthorized');
        });
    });

    describe('sendConnectionRequestAction', () => {
        it('creates a connection request', async () => {
            getCol('users')['user-a'] = { displayName: 'Test User', photoURL: null };
            const result = await sendConnectionRequestAction('user-b');
            expect(result.status).toBe('sent');
            expect(getCol('connection_requests')['user-a_user-b']).toBeDefined();
        });

        it('returns already_connected when connection exists', async () => {
            getCol('connections')['user-a_user-b'] = { uids: ['user-a', 'user-b'] };
            const result = await sendConnectionRequestAction('user-b');
            expect(result.status).toBe('already_connected');
        });

        it('returns already_pending when request exists', async () => {
            getCol('connection_requests')['user-a_user-b'] = { fromUid: 'user-a', toUid: 'user-b' };
            const result = await sendConnectionRequestAction('user-b');
            expect(result.status).toBe('already_pending');
        });

        it('throws when connecting with yourself', async () => {
            await expect(sendConnectionRequestAction('user-a')).rejects.toThrow('Cannot connect with yourself');
        });
    });

    describe('acceptConnectionRequestAction', () => {
        it('throws when request not found', async () => {
            await expect(acceptConnectionRequestAction('nonexistent')).rejects.toThrow('Request not found');
        });

        it('throws when caller is not recipient', async () => {
            getCol('connection_requests')['user-a_user-b'] = { fromUid: 'user-b', toUid: 'user-c' };
            await expect(acceptConnectionRequestAction('user-a_user-b')).rejects.toThrow('Unauthorized');
        });

        it('accepts when caller is recipient', async () => {
            getCol('connection_requests')['user-a_user-b'] = { fromUid: 'user-b', toUid: 'user-a' };
            getCol('users')['user-a'] = { displayName: 'Test User' };
            await acceptConnectionRequestAction('user-a_user-b');
            expect(mockDb.batch).toHaveBeenCalled();
        });
    });

    describe('declineConnectionRequestAction', () => {
        it('deletes request when caller is recipient', async () => {
            getCol('connection_requests')['user-a_user-b'] = { fromUid: 'user-b', toUid: 'user-a' };
            await declineConnectionRequestAction('user-a_user-b');
            expect(getCol('connection_requests')['user-a_user-b']).toBeUndefined();
        });

        it('deletes request when caller is sender (withdraw)', async () => {
            getCol('connection_requests')['user-a_user-b'] = { fromUid: 'user-a', toUid: 'user-b' };
            await declineConnectionRequestAction('user-a_user-b');
            expect(getCol('connection_requests')['user-a_user-b']).toBeUndefined();
        });

        it('is idempotent when request not found', async () => {
            await expect(declineConnectionRequestAction('nonexistent')).resolves.toBeUndefined();
        });

        it('throws when caller is neither party', async () => {
            getCol('connection_requests')['user-x_user-y'] = { fromUid: 'user-x', toUid: 'user-y' };
            await expect(declineConnectionRequestAction('user-x_user-y')).rejects.toThrow('Unauthorized');
        });
    });

    describe('disconnectAction', () => {
        it('deletes the connection', async () => {
            getCol('connections')['user-a_user-b'] = { uids: ['user-a', 'user-b'] };
            await disconnectAction('user-b');
            expect(getCol('connections')['user-a_user-b']).toBeUndefined();
        });

        it('is idempotent when not found', async () => {
            await expect(disconnectAction('user-b')).resolves.toBeUndefined();
        });

        it('throws when caller not in connection', async () => {
            getCol('connections')['user-a_user-b'] = { uids: ['user-x', 'user-y'] };
            await expect(disconnectAction('user-b')).rejects.toThrow('Unauthorized');
        });
    });

    describe('getMyConnectionDataAction', () => {
        it('returns empty data when no connections', async () => {
            const result = await getMyConnectionDataAction();
            expect(result).toEqual({ connectedUids: [], sentRequestUids: [], receivedRequests: [] });
        });

        it('returns connected uids', async () => {
            getCol('connections')['user-a_user-b'] = { uids: ['user-a', 'user-b'] };
            const result = await getMyConnectionDataAction();
            expect(result.connectedUids).toContain('user-b');
        });
    });
});
