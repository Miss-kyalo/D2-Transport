const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const ALLOWED_TRANSITIONS = {
  INTAKE: ['DIAGNOSING', 'AWAITING_APPROVAL', 'CLOSED'],
  DIAGNOSING: ['AWAITING_APPROVAL', 'IN_REPAIR', 'CLOSED'],
  AWAITING_APPROVAL: ['IN_REPAIR', 'CLOSED'],
  IN_REPAIR: ['READY', 'CLOSED'],
  READY: ['INVOICED', 'IN_REPAIR'],
  INVOICED: ['CLOSED'],
  CLOSED: [],
};

const JOB_STATUSES = new Set(Object.keys(ALLOWED_TRANSITIONS));
const UNIT_TYPES = new Set(['TRACTOR', 'TRAILER']);
const PIN_STAGES = new Set(['INTAKE', 'DIAGNOSIS', 'COMPLETION']);
const PIN_SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const JOB_CARD_SELECT = `
  SELECT jc.*,
         c.name AS client_name,
         c.phone_whatsapp,
         tractor.plate_number AS tractor_plate,
         tractor.make AS tractor_make,
         tractor.model AS tractor_model,
         trailer.plate_number AS trailer_plate,
         trailer.make AS trailer_make,
         trailer.model AS trailer_model
  FROM job_cards jc
  JOIN clients c ON c.id = jc.client_id
  LEFT JOIN vehicles tractor ON tractor.id = jc.tractor_id
  LEFT JOIN vehicles trailer ON trailer.id = jc.trailer_id
`;

router.use(verifyToken, requireRole('Admin', 'Mechanic'));

function positiveId(value) {
  const parsed = numericInput(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function positiveQuantity(value) {
  const parsed = numericInput(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function nonNegativeAmount(value) {
  const parsed = numericInput(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function numericInput(value) {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !value.trim())
  ) {
    return Number.NaN;
  }
  return Number(value);
}

function httpError(status, message, details = {}) {
  return Object.assign(new Error(message), { status, details });
}

function parseIdempotencyKey(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > 200) {
    return false;
  }
  return value.trim();
}

async function findExistingMovement(client, key, jobCardId, itemId, type, quantity, photoUrl = null) {
  if (!key) return null;
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
  const { rows } = await client.query(
    'SELECT * FROM stock_movements WHERE idempotency_key = $1',
    [key]
  );
  const movement = rows[0];
  if (!movement) return null;

  const sameRequest =
    Number(movement.job_card_id) === jobCardId &&
    Number(movement.item_id) === itemId &&
    movement.movement_type === type &&
    Number(movement.qty) === quantity &&
    (type !== 'ISSUED' || (movement.batch_photo_url || null) === photoUrl);
  if (!sameRequest) {
    throw httpError(409, 'This idempotency key was already used for a different stock action.');
  }
  return movement;
}

async function inTransaction(work) {
  let client;
  let transactionStarted = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;
    const result = await work(client);
    await client.query('COMMIT');
    transactionStarted = false;
    return result;
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Failed to roll back garage transaction:', rollbackError);
      }
    }
    throw error;
  } finally {
    if (client) client.release();
  }
}

function sendError(res, error, message) {
  if (error.status) {
    return res.status(error.status).json({ error: error.message, ...error.details });
  }
  console.error(`${message}:`, error);
  if (error.code === '23505') {
    return res.status(409).json({ error: 'A garage record with that unique value already exists.' });
  }
  if (error.code === '23503') {
    return res.status(400).json({ error: 'A referenced garage record does not exist.' });
  }
  if (error.code === '23514') {
    return res.status(400).json({ error: 'A garage record contains values that are not allowed.' });
  }
  return res.status(500).json({ error: message });
}

async function releaseOutstandingReservations(client, jobCardId, actorName) {
  const reservations = await client.query(
    `SELECT item_id,
            SUM(CASE movement_type
              WHEN 'RESERVED' THEN qty
              WHEN 'RELEASED' THEN -qty
              WHEN 'ISSUED' THEN -qty
              ELSE 0
            END) AS qty
     FROM stock_movements
     WHERE job_card_id = $1
     GROUP BY item_id
     HAVING SUM(CASE movement_type
       WHEN 'RESERVED' THEN qty
       WHEN 'RELEASED' THEN -qty
       WHEN 'ISSUED' THEN -qty
       ELSE 0
     END) > 0
     ORDER BY item_id`,
    [jobCardId]
  );

  for (const reservation of reservations.rows) {
    const quantity = Number(reservation.qty);
    const item = await client.query(
      `UPDATE inventory_items
       SET qty_reserved = qty_reserved - $1
       WHERE id = $2 AND qty_reserved >= $1
       RETURNING id`,
      [quantity, reservation.item_id]
    );
    if (item.rowCount === 0) {
      throw httpError(409, 'Inventory reservation totals are inconsistent; the job status was not changed.');
    }
    await client.query(
      `INSERT INTO stock_movements (item_id, job_card_id, movement_type, qty, actor_name)
       VALUES ($1, $2, 'RELEASED', $3, $4)`,
      [reservation.item_id, jobCardId, quantity, actorName]
    );
  }
}

router.get('/clients', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clients ORDER BY name, id');
    return res.json(rows);
  } catch (error) {
    return sendError(res, error, 'Failed to load garage clients.');
  }
});

router.post('/clients', async (req, res) => {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const phone = typeof body.phone_whatsapp === 'string' ? body.phone_whatsapp.trim() : '';
  const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null;
  const creditLimit = body.credit_limit === undefined ? 0 : nonNegativeAmount(body.credit_limit);
  if (!name || !phone || creditLimit === null) {
    return res.status(400).json({ error: 'A client name, WhatsApp phone number, and valid credit limit are required.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO clients (name, phone_whatsapp, email, credit_limit)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, phone, email, creditLimit]
    );
    return res.status(201).json(rows[0]);
  } catch (error) {
    return sendError(res, error, 'Failed to create garage client.');
  }
});

router.get('/vehicles', async (req, res) => {
  const values = [];
  let where = '';
  if (req.query.client_id !== undefined) {
    const clientId = positiveId(req.query.client_id);
    if (!clientId) return res.status(400).json({ error: 'A valid client_id is required.' });
    values.push(clientId);
    where = 'WHERE v.client_id = $1';
  }

  try {
    const { rows } = await pool.query(
      `SELECT v.*, c.name AS client_name
       FROM vehicles v
       JOIN clients c ON c.id = v.client_id
       ${where}
       ORDER BY v.plate_number, v.id`,
      values
    );
    return res.json(rows);
  } catch (error) {
    return sendError(res, error, 'Failed to load garage vehicles.');
  }
});

router.post('/vehicles', async (req, res) => {
  const body = req.body || {};
  const clientId = positiveId(body.client_id);
  const plateNumber = typeof body.plate_number === 'string' ? body.plate_number.trim().toUpperCase() : '';
  const unitType = body.unit_type;
  const make = typeof body.make === 'string' ? body.make.trim() : '';
  const model = typeof body.model === 'string' ? body.model.trim() : '';
  const vin = typeof body.vin_chassis === 'string' && body.vin_chassis.trim()
    ? body.vin_chassis.trim()
    : null;
  if (!clientId || !plateNumber || !UNIT_TYPES.has(unitType) || !make || !model) {
    return res.status(400).json({ error: 'A valid client, plate number, unit type, make, and model are required.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO vehicles (client_id, plate_number, unit_type, make, model, vin_chassis)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [clientId, plateNumber, unitType, make, model, vin]
    );
    return res.status(201).json(rows[0]);
  } catch (error) {
    return sendError(res, error, 'Failed to create garage vehicle.');
  }
});

router.get('/inventory', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT *, qty_on_hand - qty_reserved AS qty_available
       FROM inventory_items
       ORDER BY category, part_name, id`
    );
    return res.json(rows);
  } catch (error) {
    return sendError(res, error, 'Failed to load garage inventory.');
  }
});

router.get('/job-cards', async (req, res) => {
  const filters = [];
  const values = [];
  if (req.query.client_id !== undefined) {
    const clientId = positiveId(req.query.client_id);
    if (!clientId) return res.status(400).json({ error: 'A valid client_id is required.' });
    values.push(clientId);
    filters.push(`jc.client_id = $${values.length}`);
  }
  if (req.query.status !== undefined) {
    if (!JOB_STATUSES.has(req.query.status)) {
      return res.status(400).json({ error: 'Invalid job card status.' });
    }
    values.push(req.query.status);
    filters.push(`jc.status = $${values.length}`);
  }

  try {
    const { rows } = await pool.query(
      `${JOB_CARD_SELECT}
       ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
       ORDER BY jc.created_at DESC, jc.id DESC`,
      values
    );
    return res.json(rows);
  } catch (error) {
    return sendError(res, error, 'Failed to load garage job cards.');
  }
});

router.post('/job-cards', async (req, res) => {
  const {
    job_number,
    client_id,
    tractor_id = null,
    trailer_id = null,
    deposit_required = 0,
  } = req.body || {};
  const normalizedJobNumber = typeof job_number === 'string' ? job_number.trim() : '';
  const clientId = positiveId(client_id);
  const tractorId = tractor_id === null || tractor_id === '' ? null : positiveId(tractor_id);
  const trailerId = trailer_id === null || trailer_id === '' ? null : positiveId(trailer_id);
  const deposit = nonNegativeAmount(deposit_required);

  if (
    !normalizedJobNumber ||
    !clientId ||
    (!tractorId && !trailerId) ||
    (tractor_id !== null && tractor_id !== '' && !tractorId) ||
    (trailer_id !== null && trailer_id !== '' && !trailerId) ||
    (tractorId && tractorId === trailerId) ||
    deposit === null
  ) {
    return res.status(400).json({
      error: 'A job number, valid client, at least one valid vehicle, and a non-negative deposit are required.',
    });
  }

  try {
    const job = await inTransaction(async (client) => {
      const clientResult = await client.query('SELECT id FROM clients WHERE id = $1', [clientId]);
      if (clientResult.rowCount === 0) throw httpError(404, 'Client not found.');

      const vehicleIds = [tractorId, trailerId].filter(Boolean);
      const vehicleResult = await client.query(
        'SELECT id, client_id, unit_type FROM vehicles WHERE id = ANY($1::bigint[]) FOR KEY SHARE',
        [vehicleIds]
      );
      const vehiclesById = new Map(vehicleResult.rows.map((vehicle) => [Number(vehicle.id), vehicle]));

      for (const [vehicleId, unitType] of [[tractorId, 'TRACTOR'], [trailerId, 'TRAILER']]) {
        if (!vehicleId) continue;
        const vehicle = vehiclesById.get(vehicleId);
        if (!vehicle || Number(vehicle.client_id) !== clientId || vehicle.unit_type !== unitType) {
          throw httpError(400, `The selected ${unitType.toLowerCase()} must belong to this client.`);
        }
      }

      const { rows } = await client.query(
        `INSERT INTO job_cards (job_number, client_id, tractor_id, trailer_id, status, deposit_required)
         VALUES ($1, $2, $3, $4, 'INTAKE', $5)
         RETURNING *`,
        [normalizedJobNumber, clientId, tractorId, trailerId, deposit]
      );
      return rows[0];
    });
    return res.status(201).json(job);
  } catch (error) {
    return sendError(res, error, 'Failed to create garage job card.');
  }
});

router.get('/job-cards/:id', async (req, res) => {
  const jobCardId = positiveId(req.params.id);
  if (!jobCardId) return res.status(400).json({ error: 'A valid job card id is required.' });

  try {
    const [jobResult, pinsResult, movementsResult] = await Promise.all([
      pool.query(`${JOB_CARD_SELECT} WHERE jc.id = $1`, [jobCardId]),
      pool.query(
        'SELECT * FROM inspection_pins_3d WHERE job_card_id = $1 ORDER BY created_at ASC',
        [jobCardId]
      ),
      pool.query(
        'SELECT * FROM stock_movements WHERE job_card_id = $1 ORDER BY created_at ASC',
        [jobCardId]
      ),
    ]);
    if (jobResult.rowCount === 0) return res.status(404).json({ error: 'Job card not found.' });
    return res.json({
      ...jobResult.rows[0],
      inspection_pins: pinsResult.rows,
      stock_movements: movementsResult.rows,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to load garage job card.');
  }
});

router.post('/job-cards/:id/reserve-part', async (req, res) => {
  const jobCardId = positiveId(req.params.id);
  const body = req.body || {};
  const itemId = positiveId(body.item_id);
  const quantity = positiveQuantity(body.qty);
  const key = parseIdempotencyKey(body.idempotency_key);
  if (!jobCardId || !itemId || !quantity || key === false) {
    return res.status(400).json({ error: 'A valid job card, item, and positive whole-number quantity are required.' });
  }

  try {
    const result = await inTransaction(async (client) => {
      const existing = await findExistingMovement(
        client, key, jobCardId, itemId, 'RESERVED', quantity
      );
      if (existing) {
        const item = await client.query('SELECT * FROM inventory_items WHERE id = $1', [itemId]);
        return { inventory_item: item.rows[0], movement: existing, duplicate: true };
      }

      const job = await client.query('SELECT status FROM job_cards WHERE id = $1 FOR UPDATE', [jobCardId]);
      if (job.rowCount === 0) throw httpError(404, 'Job card not found.');
      if (!['INTAKE', 'DIAGNOSING', 'AWAITING_APPROVAL', 'IN_REPAIR'].includes(job.rows[0].status)) {
        throw httpError(409, 'Parts cannot be reserved for a completed job card.');
      }

      const itemResult = await client.query(
        'SELECT id, qty_on_hand, qty_reserved FROM inventory_items WHERE id = $1 FOR UPDATE',
        [itemId]
      );
      if (itemResult.rowCount === 0) throw httpError(404, 'Inventory item not found.');

      const item = itemResult.rows[0];
      const availableQty = Number(item.qty_on_hand) - Number(item.qty_reserved);
      if (quantity > availableQty) {
        throw httpError(409, 'Insufficient available stock to reserve.', { available_qty: availableQty });
      }

      const updatedItem = await client.query(
        'UPDATE inventory_items SET qty_reserved = qty_reserved + $1 WHERE id = $2 RETURNING *',
        [quantity, itemId]
      );
      const movement = await client.query(
        `INSERT INTO stock_movements (
           item_id, job_card_id, movement_type, qty, actor_name, idempotency_key
         )
         VALUES ($1, $2, 'RESERVED', $3, $4, $5) RETURNING *`,
        [itemId, jobCardId, quantity, req.user.username, key]
      );
      return { inventory_item: updatedItem.rows[0], movement: movement.rows[0], duplicate: false };
    });
    return res.status(result.duplicate ? 200 : 201).json({
      inventory_item: result.inventory_item,
      movement: result.movement,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to reserve garage stock.');
  }
});

router.post('/job-cards/:id/issue-part', async (req, res) => {
  const jobCardId = positiveId(req.params.id);
  const body = req.body || {};
  const itemId = positiveId(body.item_id);
  const quantity = positiveQuantity(body.qty);
  const batchPhotoUrl = body.batch_photo_url ?? null;
  const key = parseIdempotencyKey(body.idempotency_key);
  if (
    !jobCardId ||
    !itemId ||
    !quantity ||
    key === false ||
    (batchPhotoUrl !== null && (typeof batchPhotoUrl !== 'string' || batchPhotoUrl.length > 2000))
  ) {
    return res.status(400).json({ error: 'A valid job card, item, positive whole-number quantity, and optional batch photo are required.' });
  }

  try {
    const result = await inTransaction(async (client) => {
      const existing = await findExistingMovement(
        client, key, jobCardId, itemId, 'ISSUED', quantity, batchPhotoUrl
      );
      if (existing) {
        const item = await client.query('SELECT * FROM inventory_items WHERE id = $1', [itemId]);
        return { inventory_item: item.rows[0], movement: existing, duplicate: true };
      }

      const job = await client.query('SELECT status FROM job_cards WHERE id = $1 FOR UPDATE', [jobCardId]);
      if (job.rowCount === 0) throw httpError(404, 'Job card not found.');
      if (!['INTAKE', 'DIAGNOSING', 'AWAITING_APPROVAL', 'IN_REPAIR'].includes(job.rows[0].status)) {
        throw httpError(409, 'Parts cannot be issued for a completed job card.');
      }

      const itemResult = await client.query(
        'SELECT id, qty_on_hand, qty_reserved FROM inventory_items WHERE id = $1 FOR UPDATE',
        [itemId]
      );
      if (itemResult.rowCount === 0) throw httpError(404, 'Inventory item not found.');

      const reservedResult = await client.query(
        `SELECT COALESCE(SUM(CASE movement_type
           WHEN 'RESERVED' THEN qty
           WHEN 'RELEASED' THEN -qty
           WHEN 'ISSUED' THEN -qty
           ELSE 0
         END), 0) AS reserved_qty
         FROM stock_movements
         WHERE job_card_id = $1 AND item_id = $2`,
        [jobCardId, itemId]
      );
      const reservedForJob = Number(reservedResult.rows[0].reserved_qty);
      if (quantity > reservedForJob) {
        throw httpError(409, 'The job card does not have enough reserved quantity for this issue.', {
          reserved_qty: reservedForJob,
        });
      }

      const item = itemResult.rows[0];
      if (quantity > Number(item.qty_on_hand) || quantity > Number(item.qty_reserved)) {
        throw httpError(409, 'Inventory quantities are insufficient for this issue.');
      }
      const updatedItem = await client.query(
        `UPDATE inventory_items
         SET qty_on_hand = qty_on_hand - $1, qty_reserved = qty_reserved - $1
         WHERE id = $2 RETURNING *`,
        [quantity, itemId]
      );
      const movement = await client.query(
        `INSERT INTO stock_movements (
           item_id, job_card_id, movement_type, qty, batch_photo_url, actor_name, idempotency_key
         )
         VALUES ($1, $2, 'ISSUED', $3, $4, $5, $6) RETURNING *`,
        [itemId, jobCardId, quantity, batchPhotoUrl, req.user.username, key]
      );
      return { inventory_item: updatedItem.rows[0], movement: movement.rows[0], duplicate: false };
    });
    return res.status(result.duplicate ? 200 : 201).json({
      inventory_item: result.inventory_item,
      movement: result.movement,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to issue garage stock.');
  }
});

router.post('/job-cards/:id/return-core', async (req, res) => {
  const jobCardId = positiveId(req.params.id);
  const body = req.body || {};
  const itemId = positiveId(body.item_id);
  const quantity = positiveQuantity(body.qty);
  const key = parseIdempotencyKey(body.idempotency_key);
  if (!jobCardId || !itemId || !quantity || key === false) {
    return res.status(400).json({ error: 'A valid job card, item, and positive whole-number quantity are required.' });
  }

  try {
    const result = await inTransaction(async (client) => {
      const existing = await findExistingMovement(
        client, key, jobCardId, itemId, 'CORE_RETURNED', quantity
      );
      if (existing) return { movement: existing, duplicate: true };

      const job = await client.query('SELECT id FROM job_cards WHERE id = $1 FOR UPDATE', [jobCardId]);
      if (job.rowCount === 0) throw httpError(404, 'Job card not found.');
      const item = await client.query(
        'SELECT requires_core_return FROM inventory_items WHERE id = $1 FOR UPDATE',
        [itemId]
      );
      if (item.rowCount === 0) throw httpError(404, 'Inventory item not found.');
      if (!item.rows[0].requires_core_return) {
        throw httpError(400, 'This inventory item does not require a core return.');
      }

      const quantities = await client.query(
        `SELECT
           COALESCE(SUM(CASE WHEN movement_type = 'ISSUED' THEN qty ELSE 0 END), 0) AS issued_qty,
           COALESCE(SUM(CASE WHEN movement_type = 'CORE_RETURNED' THEN qty ELSE 0 END), 0) AS returned_qty
         FROM stock_movements
         WHERE job_card_id = $1 AND item_id = $2`,
        [jobCardId, itemId]
      );
      const issuedQty = Number(quantities.rows[0].issued_qty);
      const remainingQty = issuedQty - Number(quantities.rows[0].returned_qty);
      if (quantity > remainingQty) {
        throw httpError(409, 'Core return quantity exceeds the outstanding issued quantity.', {
          outstanding_qty: Math.max(remainingQty, 0),
        });
      }

      const { rows } = await client.query(
        `INSERT INTO stock_movements (
           item_id, job_card_id, movement_type, qty, actor_name, idempotency_key
         )
         VALUES ($1, $2, 'CORE_RETURNED', $3, $4, $5) RETURNING *`,
        [itemId, jobCardId, quantity, req.user.username, key]
      );
      return { movement: rows[0], duplicate: false };
    });
    return res.status(result.duplicate ? 200 : 201).json({ movement: result.movement });
  } catch (error) {
    return sendError(res, error, 'Failed to record garage core return.');
  }
});

router.patch('/job-cards/:id/status', async (req, res) => {
  const jobCardId = positiveId(req.params.id);
  const { next_status } = req.body || {};
  if (!jobCardId || !JOB_STATUSES.has(next_status)) {
    return res.status(400).json({ error: 'A valid job card id and status are required.' });
  }

  try {
    const updatedJob = await inTransaction(async (client) => {
      const jobResult = await client.query(
        'SELECT id, status FROM job_cards WHERE id = $1 FOR UPDATE',
        [jobCardId]
      );
      if (jobResult.rowCount === 0) throw httpError(404, 'Job card not found.');

      const currentStatus = jobResult.rows[0].status;
      if (!ALLOWED_TRANSITIONS[currentStatus]?.includes(next_status)) {
        throw httpError(409, `Invalid status transition from ${currentStatus} to ${next_status}.`);
      }

      if (next_status === 'READY' || next_status === 'INVOICED') {
        const pendingCores = await client.query(
          `WITH issued_cores AS (
             SELECT sm.item_id, SUM(sm.qty) AS issued_qty
             FROM stock_movements sm
             JOIN inventory_items ii ON ii.id = sm.item_id
             WHERE sm.job_card_id = $1
               AND sm.movement_type = 'ISSUED'
               AND ii.requires_core_return = TRUE
             GROUP BY sm.item_id
           ),
           returned_cores AS (
             SELECT item_id, SUM(qty) AS returned_qty
             FROM stock_movements
             WHERE job_card_id = $1 AND movement_type = 'CORE_RETURNED'
             GROUP BY item_id
           )
           SELECT ic.item_id, ii.sku, ii.part_name, ic.issued_qty,
                  COALESCE(rc.returned_qty, 0) AS returned_qty
           FROM issued_cores ic
           JOIN inventory_items ii ON ii.id = ic.item_id
           LEFT JOIN returned_cores rc ON rc.item_id = ic.item_id
           WHERE COALESCE(rc.returned_qty, 0) < ic.issued_qty`,
          [jobCardId]
        );
        if (pendingCores.rowCount > 0) {
          throw httpError(409, 'Core parts must be returned before this job can be marked ready or invoiced.', {
            missing_cores: pendingCores.rows,
          });
        }
      }

      if (['READY', 'INVOICED', 'CLOSED'].includes(next_status)) {
        await releaseOutstandingReservations(client, jobCardId, req.user.username);
      }

      const { rows } = await client.query(
        `UPDATE job_cards
         SET status = $1, approved_at = CASE WHEN $1 = 'IN_REPAIR' THEN COALESCE(approved_at, NOW()) ELSE approved_at END
         WHERE id = $2 RETURNING *`,
        [next_status, jobCardId]
      );
      return rows[0];
    });
    return res.json(updatedJob);
  } catch (error) {
    return sendError(res, error, 'Failed to update garage job card status.');
  }
});

router.post('/job-cards/:id/pins', async (req, res) => {
  const jobCardId = positiveId(req.params.id);
  const {
    stage,
    vehicle_role,
    mesh_zone,
    pos_x,
    pos_y,
    pos_z,
    severity,
    notes = null,
    media_url = null,
    ai_notes = null,
  } = req.body || {};
  const key = parseIdempotencyKey((req.body || {}).idempotency_key);
  const coordinates = [pos_x, pos_y, pos_z].map(numericInput);
  const optionalTextIsValid = [notes, media_url, ai_notes].every(
    (value) => value === null || (typeof value === 'string' && value.length <= 4000)
  );
  const normalizedMeshZone = typeof mesh_zone === 'string' ? mesh_zone.trim() : '';

  if (
    !jobCardId ||
    !PIN_STAGES.has(stage) ||
    !UNIT_TYPES.has(vehicle_role) ||
    !normalizedMeshZone ||
    normalizedMeshZone.length > 200 ||
    !coordinates.every(Number.isFinite) ||
    !PIN_SEVERITIES.has(severity) ||
    key === false ||
    !optionalTextIsValid
  ) {
    return res.status(400).json({ error: 'The inspection pin contains invalid or missing values.' });
  }

  try {
    const result = await inTransaction(async (client) => {
      if (key) {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
        const existing = await client.query(
          'SELECT * FROM inspection_pins_3d WHERE idempotency_key = $1',
          [key]
        );
        if (existing.rowCount > 0) {
          const pin = existing.rows[0];
          const sameRequest =
            Number(pin.job_card_id) === jobCardId &&
            pin.stage === stage &&
            pin.vehicle_role === vehicle_role &&
            pin.mesh_zone === normalizedMeshZone &&
            Number(pin.pos_x) === Number(coordinates[0].toFixed(4)) &&
            Number(pin.pos_y) === Number(coordinates[1].toFixed(4)) &&
            Number(pin.pos_z) === Number(coordinates[2].toFixed(4)) &&
            pin.severity === severity &&
            pin.notes === notes &&
            pin.media_url === media_url &&
            pin.ai_notes === ai_notes;
          if (!sameRequest) {
            throw httpError(409, 'This idempotency key was already used for a different inspection pin.');
          }
          return { pin, repeatHistory: [], duplicate: true };
        }
      }

      const jobRes = await client.query(
        'SELECT id, tractor_id, trailer_id FROM job_cards WHERE id = $1',
        [jobCardId]
      );
      if (jobRes.rowCount === 0) throw httpError(404, 'Job card not found.');

      const job = jobRes.rows[0];
      const targetVehicleId = vehicle_role === 'TRAILER' ? job.trailer_id : job.tractor_id;
      if (!targetVehicleId) {
        throw httpError(400, `This job card has no ${vehicle_role.toLowerCase()} to attach a pin to.`);
      }

      const priorRes = await client.query(
        `SELECT p.id, p.job_card_id, jc.job_number, p.stage, p.severity, p.notes, p.created_at
         FROM inspection_pins_3d p
         JOIN job_cards jc ON jc.id = p.job_card_id
         WHERE p.job_card_id <> $1
           AND p.mesh_zone = $2
           AND p.created_at >= NOW() - INTERVAL '30 days'
           AND (
             ($3 = 'TRACTOR' AND jc.tractor_id = $4)
             OR ($3 = 'TRAILER' AND jc.trailer_id = $4)
           )
         ORDER BY p.created_at DESC`,
        [jobCardId, normalizedMeshZone, vehicle_role, targetVehicleId]
      );

      const { rows } = await client.query(
        `INSERT INTO inspection_pins_3d (
           job_card_id, stage, vehicle_role, mesh_zone,
           pos_x, pos_y, pos_z, severity, notes, media_url, ai_notes, idempotency_key
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          jobCardId,
          stage,
          vehicle_role,
          normalizedMeshZone,
          coordinates[0],
          coordinates[1],
          coordinates[2],
          severity,
          notes,
          media_url,
          ai_notes,
          key,
        ]
      );
      return { pin: rows[0], repeatHistory: priorRes.rows, duplicate: false };
    });
    return res.status(result.duplicate ? 200 : 201).json({
      pin: result.pin,
      repeat_fault_warning: result.repeatHistory.length > 0,
      prior_30d_pins_in_zone: result.repeatHistory,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to save inspection pin.');
  }
});

router.get('/job-cards/:id/pins', async (req, res) => {
  const jobCardId = positiveId(req.params.id);
  if (!jobCardId) return res.status(400).json({ error: 'A valid job card id is required.' });

  try {
    const job = await pool.query('SELECT id FROM job_cards WHERE id = $1', [jobCardId]);
    if (job.rowCount === 0) return res.status(404).json({ error: 'Job card not found.' });
    const { rows } = await pool.query(
      `SELECT *
       FROM inspection_pins_3d
       WHERE job_card_id = $1
       ORDER BY created_at ASC`,
      [jobCardId]
    );
    return res.json({ pins: rows });
  } catch (error) {
    return sendError(res, error, 'Failed to load inspection pins.');
  }
});

router.post('/job-cards/:id/quote-preview', async (req, res) => {
  const jobCardId = positiveId(req.params.id);
  const { labor_items = [], snapshot_url = null, currency = 'KES' } = req.body || {};
  if (
    !jobCardId ||
    !Array.isArray(labor_items) ||
    labor_items.length > 100 ||
    typeof currency !== 'string' ||
    !/^[A-Z]{3}$/.test(currency) ||
    (snapshot_url !== null && (typeof snapshot_url !== 'string' || snapshot_url.length > 2000))
  ) {
    return res.status(400).json({ error: 'The quote preview contains invalid values.' });
  }

  const normalizedLabor = [];
  for (const item of labor_items) {
    const description = typeof item?.description === 'string' ? item.description.trim() : '';
    const amount = nonNegativeAmount(item?.amount);
    if (!description || description.length > 500 || amount === null) {
      return res.status(400).json({ error: 'Each labor item needs a description and non-negative amount.' });
    }
    normalizedLabor.push({ description, amount: Number(amount.toFixed(2)) });
  }

  try {
    const jobRes = await pool.query(
      `SELECT jc.*,
              c.name AS client_name,
              c.phone_whatsapp,
              t.plate_number AS tractor_plate,
              t.make AS tractor_make,
              t.model AS tractor_model,
              tr.plate_number AS trailer_plate,
              tr.make AS trailer_make,
              tr.model AS trailer_model
       FROM job_cards jc
       JOIN clients c ON c.id = jc.client_id
       LEFT JOIN vehicles t ON t.id = jc.tractor_id
       LEFT JOIN vehicles tr ON tr.id = jc.trailer_id
       WHERE jc.id = $1`,
      [jobCardId]
    );

    if (jobRes.rowCount === 0) {
      return res.status(404).json({ error: 'Job card not found' });
    }

    const job = jobRes.rows[0];

    const pinsRes = await pool.query(
      `SELECT id, stage, vehicle_role, mesh_zone, severity, notes, media_url, ai_notes
       FROM inspection_pins_3d
       WHERE job_card_id = $1 AND stage IN ('INTAKE', 'DIAGNOSIS')
       ORDER BY created_at ASC`,
      [jobCardId]
    );

    const partsRes = await pool.query(
      `SELECT sm.item_id,
              ii.sku,
              ii.part_name,
              ii.oem_number,
              ii.selling_price,
              SUM(CASE WHEN sm.movement_type = 'RESERVED' THEN sm.qty ELSE 0 END) AS reserved_qty,
              SUM(CASE WHEN sm.movement_type = 'RELEASED' THEN sm.qty ELSE 0 END) AS released_qty,
              SUM(CASE WHEN sm.movement_type = 'ISSUED' THEN sm.qty ELSE 0 END) AS issued_qty
       FROM stock_movements sm
       JOIN inventory_items ii ON ii.id = sm.item_id
       WHERE sm.job_card_id = $1
       GROUP BY sm.item_id, ii.sku, ii.part_name, ii.oem_number, ii.selling_price`,
      [jobCardId]
    );

    const partLines = partsRes.rows
      .map((p) => {
        const netQty = Math.max(
          0,
          Number(p.reserved_qty) - Number(p.released_qty) - Number(p.issued_qty)
        );
        const unitPrice = Number(p.selling_price);
        return {
          item_id: p.item_id,
          sku: p.sku,
          part_name: p.part_name,
          oem_number: p.oem_number,
          qty: netQty,
          unit_price: unitPrice,
          line_total: Number((netQty * unitPrice).toFixed(2)),
        };
      })
      .filter((line) => line.qty > 0);

    const partsTotal = partLines.reduce((sum, l) => sum + l.line_total, 0);
    const laborTotal = normalizedLabor.reduce((sum, l) => sum + l.amount, 0);
    const grandTotal = Number((partsTotal + laborTotal).toFixed(2));
    const depositRequired = Number(job.deposit_required || 0);

    const rigLabel = [
      job.tractor_plate ? `Tractor ${job.tractor_plate} (${job.tractor_make} ${job.tractor_model})` : null,
      job.trailer_plate ? `Trailer ${job.trailer_plate} (${job.trailer_make} ${job.trailer_model})` : null,
    ]
      .filter(Boolean)
      .join(' + ');

    const pinSummary =
      pinsRes.rows.length > 0
        ? pinsRes.rows
            .map((p) => `- [${p.severity}] ${p.vehicle_role} / ${p.mesh_zone}: ${p.notes || 'Inspection pin'}`)
            .join('\n')
        : '- No pins logged yet';

    const partSummary =
      partLines.length > 0
        ? partLines
            .map((p) => `- ${p.part_name} (${p.sku}) x${p.qty} @ ${currency} ${p.unit_price.toLocaleString()} = ${currency} ${p.line_total.toLocaleString()}`)
            .join('\n')
        : '- Parts pending allocation';

    const laborSummary =
      normalizedLabor.length > 0
        ? normalizedLabor
            .map((l) => `- ${l.description}: ${currency} ${l.amount.toLocaleString()}`)
            .join('\n')
        : '- Labor to be confirmed';

    const whatsappMessage = [
      `Hello ${job.client_name}, here is your inspection & repair quote for *${job.job_number}*.`,
      `*Rig:* ${rigLabel}`,
      snapshot_url ? `*3D Inspection Snapshot:* ${snapshot_url}` : null,
      `\n*Findings / Pins:*\n${pinSummary}`,
      `\n*Parts:*\n${partSummary}`,
      `\n*Labor:*\n${laborSummary}`,
      `\n*Estimated Total:* ${currency} ${grandTotal.toLocaleString()}`,
      depositRequired > 0 ? `*Required Deposit:* ${currency} ${depositRequired.toLocaleString()}` : null,
      `\nReply *APPROVE ${job.job_number}* to confirm or ask for M-PESA deposit details.`,
    ]
      .filter(Boolean)
      .join('\n');

    return res.json({
      job_number: job.job_number,
      client_name: job.client_name,
      phone_whatsapp: job.phone_whatsapp,
      rig: rigLabel,
      snapshot_url,
      pins: pinsRes.rows,
      parts: partLines,
      labor: normalizedLabor,
      totals: {
        parts_total: Number(partsTotal.toFixed(2)),
        labor_total: Number(laborTotal.toFixed(2)),
        grand_total: grandTotal,
        deposit_required: depositRequired,
        deposit_paid: Number(job.deposit_paid || 0),
      },
      whatsapp_message: whatsappMessage,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to generate garage quote preview.');
  }
});

module.exports = router;