const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.TEST_API_URL || `http://localhost:${process.env.PORT || 5000}/api/garage`;
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';

async function api(path, { method = 'GET', body = null } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  return { status: res.status, data };
}

test('rejects over-reserving available stock with 409', async () => {
  const { status, data } = await api('/job-cards/1/reserve-part', {
    method: 'POST',
    body: {
      item_id: 2,
      qty: 99999,
      actor_name: 'Automated Test',
    },
  });

  assert.equal(status, 409);
  assert.ok(data.error);
});

test('blocks READY transition when core part is issued without core return, then allows after return', async () => {
  const uniqueSuffix = Date.now();
  const created = await api('/job-cards', {
    method: 'POST',
    body: {
      job_number: `JC-TEST-${uniqueSuffix}`,
      client_id: 1,
      tractor_id: 1,
      trailer_id: 2,
      deposit_required: 10000,
    },
  });
  assert.equal(created.status, 201);
  const jobId = created.data.id;

  const toRepair = await api(`/job-cards/${jobId}/status`, {
    method: 'PATCH',
    body: { next_status: 'IN_REPAIR' },
  });
  assert.equal(toRepair.status, 200);

  const reserved = await api(`/job-cards/${jobId}/reserve-part`, {
    method: 'POST',
    body: { item_id: 3, qty: 1 },
  });
  assert.equal(reserved.status, 201);

  const issued = await api(`/job-cards/${jobId}/issue-part`, {
    method: 'POST',
    body: {
      item_id: 3,
      qty: 1,
      batch_photo_url: 'https://storage.example.com/batches/test-starter.jpg',
      actor_name: 'Storekeeper Test',
    },
  });
  assert.equal(issued.status, 201);

  const blockedReady = await api(`/job-cards/${jobId}/status`, {
    method: 'PATCH',
    body: { next_status: 'READY' },
  });
  assert.equal(blockedReady.status, 409);
  assert.ok(Array.isArray(blockedReady.data.missing_cores));
  assert.equal(blockedReady.data.missing_cores.length, 1);

  const returnedCore = await api(`/job-cards/${jobId}/return-core`, {
    method: 'POST',
    body: {
      item_id: 3,
      qty: 1,
      actor_name: 'Mechanic Test',
    },
  });
  assert.equal(returnedCore.status, 201);

  const allowedReady = await api(`/job-cards/${jobId}/status`, {
    method: 'PATCH',
    body: { next_status: 'READY' },
  });
  assert.equal(allowedReady.status, 200);
  assert.equal(allowedReady.data.status, 'READY');
});

test('flags repeat fault when pin is placed on a recently pinned zone', async () => {
  const res = await api('/job-cards/2/pins', {
    method: 'POST',
    body: {
      stage: 'DIAGNOSIS',
      vehicle_role: 'TRACTOR',
      mesh_zone: 'front_bumper_left',
      pos_x: -1.1,
      pos_y: 0.6,
      pos_z: 3.3,
      severity: 'MEDIUM',
      notes: 'Follow-up check on front bumper area',
    },
  });

  assert.equal(res.status, 201);
  assert.equal(typeof res.data.repeat_fault_warning, 'boolean');
});