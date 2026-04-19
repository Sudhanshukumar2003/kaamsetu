const express = require('express');
const { body, param } = require('express-validator');
const router  = express.Router();

const { query } = require('../db/pool');
const { authenticate, requireHirer } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const paymentService = require('../services/payment.service');
const res    = require('../utils/response');
const logger = require('../utils/logger');
const config = require('../config');

// ── POST /payments/initiate ──────────────────────────────────────────
// Hirer initiates escrow after selecting a worker
router.post('/initiate',
  authenticate, requireHirer,
  body('gigId').isUUID(),
  body('agreedAmountPaise').isInt({ min: 10000 }),
  validate,
  async (req, resp) => {
    const { gigId, agreedAmountPaise } = req.body;
    try {
      const hirer = (await query('SELECT id FROM hirer_profiles WHERE user_id = $1', [req.user.id])).rows[0];
      if (!hirer) return res.notFound(resp);

      const gig = (await query(
        `SELECT g.*, wp.id AS worker_profile_id
         FROM gigs g
         JOIN worker_profiles wp ON wp.id = g.worker_id
         WHERE g.id = $1 AND g.hirer_id = $2`,
        [gigId, hirer.id]
      )).rows[0];

      if (!gig) return res.notFound(resp, 'Gig not found or not yours');
      if (gig.status !== 'accepted') return res.badRequest(resp, 'Gig must be accepted before payment');

      // Check no existing payment
      const existing = (await query('SELECT id FROM payments WHERE gig_id = $1', [gigId])).rows[0];
      if (existing) return res.conflict(resp, 'Payment already initiated for this gig');

      const result = await paymentService.createEscrowOrder(
        gigId, hirer.id, gig.worker_profile_id, agreedAmountPaise
      );

      return res.created(resp, result, 'Payment order created. Complete payment to hold in escrow.');
    } catch (err) {
      logger.error('POST /payments/initiate', { err: err.message });
      return res.error(resp);
    }
  }
);

// ── POST /payments/webhook — Razorpay webhook ────────────────────────
router.post('/webhook',
  express.raw({ type: 'application/json' }),
  async (req, resp) => {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;

    try {
      const isValid = paymentService.verifyWebhookSignature(
        body, signature, process.env.RAZORPAY_WEBHOOK_SECRET
      );
      if (!isValid && config.env === 'production') {
        logger.warn('Invalid Razorpay webhook signature');
        return resp.status(400).json({ error: 'Invalid signature' });
      }

      const event = typeof body === 'string' ? JSON.parse(body) : body;
      logger.info('Razorpay webhook received', { event: event.event });

      if (event.event === 'payment.captured') {
        const paymentEntity = event.payload.payment.entity;
        const orderId = paymentEntity.order_id;

        const payment = (await query(
          'SELECT id FROM payments WHERE razorpay_order_id = $1', [orderId]
        )).rows[0];

        if (payment) {
          await paymentService.confirmEscrow(payment.id, paymentEntity.id);
          logger.info('Escrow confirmed via webhook', { paymentId: payment.id });
        }
      }

      return resp.status(200).json({ status: 'ok' });
    } catch (err) {
      logger.error('Webhook processing error', { err: err.message });
      return resp.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

// ── GET /payments/history ─────────────────────────────────────────────
router.get('/history', authenticate, async (req, resp) => {
  try {
    let profileId, role;
    if (req.user.role === 'worker') {
      const w = (await query('SELECT id FROM worker_profiles WHERE user_id = $1', [req.user.id])).rows[0];
      profileId = w?.id; role = 'worker';
    } else if (req.user.role === 'hirer') {
      const h = (await query('SELECT id FROM hirer_profiles WHERE user_id = $1', [req.user.id])).rows[0];
      profileId = h?.id; role = 'hirer';
    } else {
      return res.forbidden(resp);
    }

    if (!profileId) return res.notFound(resp);

    const whereClause = role === 'worker' ? 'p.worker_id = $1' : 'p.hirer_id = $1';

    const { rows } = await query(
      `SELECT p.id, p.gross_amount, p.worker_amount, p.platform_fee,
              p.status, p.escrow_held_at, p.escrow_released_at,
              g.title AS gig_title, g.start_date,
              CASE WHEN $2 = 'worker'
                THEN hu.full_name
                ELSE wu.full_name
              END AS counterpart_name
       FROM payments p
       JOIN gigs g ON g.id = p.gig_id
       JOIN hirer_profiles hp  ON hp.id = p.hirer_id
       JOIN users hu           ON hu.id = hp.user_id
       LEFT JOIN worker_profiles wp ON wp.id = p.worker_id
       LEFT JOIN users wu           ON wu.id = wp.user_id
       WHERE ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT 50`,
      [profileId, role]
    );

    return res.success(resp, rows);
  } catch (err) {
    logger.error('GET /payments/history', { err: err.message });
    return res.error(resp);
  }
});

module.exports = router;
