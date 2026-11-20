const QUEUE_KEY = 'garage_offline_queue_v1';

export function readOfflineQueue() {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(QUEUE_KEY);
  if (!raw) return [];

  const queue = JSON.parse(raw);
  if (!Array.isArray(queue)) throw new Error('Garage offline queue has an invalid format.');
  return queue;
}

export function writeOfflineQueue(items) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export function enqueueAction({ url, method = 'POST', payload }) {
  const idempotencyKey = payload.idempotency_key ||
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const entry = {
    id: idempotencyKey,
    url,
    method,
    payload: { ...payload, idempotency_key: idempotencyKey },
    createdAt: new Date().toISOString(),
  };

  const current = readOfflineQueue();
  writeOfflineQueue([...current, entry]);
  return entry;
}

export async function flushOfflineQueue() {
  const queue = readOfflineQueue();
  if (queue.length === 0) return { synced: 0, remaining: 0 };
  const token = window.localStorage.getItem('token');
  if (!token) return { synced: 0, remaining: queue.length };

  const remaining = [];
  let synced = 0;

  for (const item of queue) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(item.payload),
      });

      if (res.ok) {
        synced += 1;
      } else {
        remaining.push(item);
      }
    } catch (error) {
      console.error(`Failed to sync queued garage action ${item.id}:`, error);
      remaining.push(item);
    }
  }

  writeOfflineQueue(remaining);
  return { synced, remaining: remaining.length };
}