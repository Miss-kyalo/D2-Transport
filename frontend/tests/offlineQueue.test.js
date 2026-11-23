import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueAction, flushOfflineQueue, readOfflineQueue, writeOfflineQueue } from '../src/lib/offlineQueue.js';

function createStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: (key) => values.delete(key)
    };
}

test('garage offline actions sync only under the account that created them', async (t) => {
    const originalWindow = globalThis.window;
    const originalFetch = globalThis.fetch;
    const storage = createStorage({
        user: JSON.stringify({ id: 21 }),
        token: 'user-21-token'
    });
    globalThis.window = { localStorage: storage };
    let fetchCalls = 0;
    globalThis.fetch = async () => {
        fetchCalls += 1;
        return { ok: true };
    };
    t.after(() => {
        globalThis.window = originalWindow;
        globalThis.fetch = originalFetch;
    });

    enqueueAction({ url: '/api/garage/job-cards/1/pins', payload: { notes: 'brake leak' } });
    assert.equal(readOfflineQueue()[0].userId, 21);

    storage.setItem('user', JSON.stringify({ id: 22 }));
    storage.setItem('token', 'user-22-token');
    const foreign = await flushOfflineQueue();
    assert.equal(fetchCalls, 0);
    assert.equal(foreign.accountMismatch, 1);
    assert.equal(foreign.remaining, 1);

    storage.setItem('user', JSON.stringify({ id: 21 }));
    const owner = await flushOfflineQueue();
    assert.equal(fetchCalls, 1);
    assert.equal(owner.synced, 1);
    assert.equal(owner.remaining, 0);
});

test('offline queue rejects unsigned users, invalid actions, and unbounded growth', () => {
    const originalWindow = globalThis.window;
    const storage = createStorage();
    globalThis.window = { localStorage: storage };
    try {
        assert.throws(() => enqueueAction({ url: '/api/garage', payload: {} }), /Sign in/);
        storage.setItem('user', JSON.stringify({ id: 21 }));
        assert.throws(() => enqueueAction({ url: '/api/garage', payload: null }), /invalid garage action/);
        writeOfflineQueue(Array.from({ length: 500 }, (_, id) => ({ id })));
        assert.throws(() => enqueueAction({ url: '/api/garage', payload: {} }), /queue is full/);
    } finally {
        globalThis.window = originalWindow;
    }
});
