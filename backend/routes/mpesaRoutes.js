const express = require('express');
const router = express.Router();
const pool = require('../config/db');

async function getDarajaAccessToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  const authUrl =
    process.env.MPESA_ENV === 'production'
      ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
      : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

  if (!key || !secret) {
    throw new Error('MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET must be configured');
  }

  const basicAuth = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await fetch(authUrl, {
    headers: { Authorization: `Basic ${basicAuth}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Daraja token: ${res.status}`);
  }

  const data = await res.json();
  return data.access_token;
}

function normalizeKenyanPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  return digits;
}

router.post('/job-cards/:id/mpesa/stk-push', async (req, res) => {
  const jobCardId = Number(req.params.id);
  const { phone_number, amount } = req.body;
  const normalizedPhone = normalizeKenyanPhone(phone_number);
  const numericAmount = Number(amount);

  if (!normalizedPhone || !numericAmount || numericAmount <= 0) {
    return res.status(400).json({ error: 'Valid phone_number and positive amount are required' });
  }

  try {
    const jobRes = await pool.query('SELECT id, job_number FROM job_cards WHERE id = $1', [jobCardId]);
    if (jobRes.rowCount === 0) {
      return res.status(404).json({ error: 'Job card not found' });
    }

    const shortCode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;

    if (!shortCode || !passkey || !callbackUrl) {
      return res.status(500).json({
        error: 'MPESA_SHORTCODE, MPESA_PASSKEY, and MPESA_CALLBACK_URL must be configured',
      });
    }

    const token = await getDarajaAccessToken();
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14);
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

    const stkUrl =
      process.env.MPESA_ENV === 'production'
        ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
        : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

    const stkRes = await fetch(stkUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(numericAmount),
        PartyA: normalizedPhone,
        PartyB: shortCode,
        PhoneNumber: normalizedPhone,
        CallBackURL: callbackUrl,
        AccountReference: jobRes.rows[0].job_number,
        TransactionDesc: `Deposit for ${jobRes.rows[0].job_number}`,
      }),
    });

    const stkData = await stkRes.json();
    if (!stkRes.ok || !stkData.CheckoutRequestID) {
      return res.status(502).json({ error: 'Daraja STK Push rejected', details: stkData });
    }

    const { rows } = await pool.query(
      `INSERT INTO mpesa_payments (
         job_card_id, checkout_request_id, phone_number, amount, status, raw_payload
       )
       VALUES ($1, $2, $3, $4, 'PENDING', $5::jsonb)
       RETURNING *`,
      [jobCardId, stkData.CheckoutRequestID, normalizedPhone, numericAmount, JSON.stringify(stkData)]
    );

    return res.status(201).json({
      payment: rows[0],
      daraja_response: stkData,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/mpesa/callback', async (req, res) => {
  const stkCallback = req.body?.Body?.stkCallback;
  if (!stkCallback?.CheckoutRequestID) {
    return res.status(400).json({ error: 'Invalid Daraja callback payload' });
  }

  const checkoutRequestId = stkCallback.CheckoutRequestID;
  const resultCode = Number(stkCallback.ResultCode);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const payRes = await client.query(
      `SELECT id, job_card_id, amount, status
       FROM mpesa_payments
       WHERE checkout_request_id = $1
       FOR UPDATE`,
      [checkoutRequestId]
    );

    if (payRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment record not found' });
    }

    const payment = payRes.rows[0];
    if (payment.status === 'PAID') {
      await client.query('COMMIT');
      return res.json({ status: 'already_reconciled' });
    }

    if (resultCode !== 0) {
      await client.query(
        `UPDATE mpesa_payments
         SET status = 'FAILED', raw_payload = $2::jsonb
         WHERE id = $1`,
        [payment.id, JSON.stringify(stkCallback)]
      );
      await client.query('COMMIT');
      return res.json({ status: 'marked_failed' });
    }

    const items = stkCallback.CallbackMetadata?.Item || [];
    const receiptItem = items.find((i) => i.Name === 'MpesaReceiptNumber');
    const paidAmountItem = items.find((i) => i.Name === 'Amount');
    const receiptNumber = receiptItem?.Value || null;
    const paidAmount = Number(paidAmountItem?.Value ?? payment.amount);

    await client.query(
      `UPDATE mpesa_payments
       SET status = 'PAID',
           mpesa_receipt_number = $2,
           amount = $3,
           raw_payload = $4::jsonb,
           paid_at = NOW()
       WHERE id = $1`,
      [payment.id, receiptNumber, paidAmount, JSON.stringify(stkCallback)]
    );

    const jobRes = await client.query(
      `SELECT id, status, deposit_required, deposit_paid, approved_at
       FROM job_cards
       WHERE id = $1
       FOR UPDATE`,
      [payment.job_card_id]
    );

    if (jobRes.rowCount > 0) {
      const job = jobRes.rows[0];
      const newDepositPaid = Number((Number(job.deposit_paid || 0) + paidAmount).toFixed(2));
      const depositRequired = Number(job.deposit_required || 0);
      const shouldAdvanceToRepair =
        job.status === 'AWAITING_APPROVAL' && newDepositPaid >= depositRequired;

      await client.query(
        `UPDATE job_cards
         SET deposit_paid = $2,
             approved_at = COALESCE(approved_at, NOW()),
             status = CASE WHEN $3 THEN 'IN_REPAIR' ELSE status END
         WHERE id = $1`,
        [job.id, newDepositPaid, shouldAdvanceToRepair]
      );
    }

    await client.query('COMMIT');
    return res.json({ status: 'reconciled', receipt: receiptNumber });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;