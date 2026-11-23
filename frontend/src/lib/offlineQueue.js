const QUEUE_KEY = 'garage_offline_queue_v1';
const MAX_QUEUE_SIZE = 500;

function currentUserId() {
  try {
    const user = JSON.parse(window.localStorage.getItem('user') || 'null');
    return Number.isSafeInteger(user?.id) && user.id > 0 ? user.id : null;
  } catch {
    return null;
  }
}

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
  const userId = currentUserId();
  if (!userId) throw new Error('Sign in before saving a garage action offline.');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Cannot save an invalid garage action offline.');
  }

  const idempotencyKey = payload.idempotency_key ||
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const entry = {
    id: idempotencyKey,
    url,
    method,
    payload: { ...payload, idempotency_key: idempotencyKey },
    userId,
    createdAt: new Date().toISOString(),
  };

  const current = readOfflineQueue();
  if (current.length >= MAX_QUEUE_SIZE) {
    throw new Error('The offline garage queue is full. Reconnect and sync before adding more actions.');
  }
  writeOfflineQueue([...current, entry]);
  return entry;
}

export async function flushOfflineQueue() {
  const queue = readOfflineQueue();
  if (queue.length === 0) return { synced: 0, remaining: 0, accountMismatch: 0 };
  const token = window.localStorage.getItem('token');
  const userId = currentUserId();
  if (!token || !userId) return { synced: 0, remaining: queue.length, accountMismatch: 0 };

  const remaining = [];
  let synced = 0;
  let accountMismatch = 0;

  for (const item of queue) {
    if (item.userId !== userId) {
      remaining.push(item);
      accountMismatch += 1;
      continue;
    }

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
  return { synced, remaining: remaining.length, accountMismatch };
}