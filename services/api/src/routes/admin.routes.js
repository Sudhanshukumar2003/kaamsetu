const express = require('express');
const { param, body } = require('express-validator');
const router = express.Router();
const { query } = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const res    = require('../utils/response');
const logger = require('../utils/logger');

router.use(authenticate, requireAdmin);

router.get('/stats', async (req, resp) => {
  try {
    const [users, workers, gigs, payments, disputes] = await Promise.all([
      query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS last_7d FROM users WHERE role != 'admin'`),
      query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE kyc_status = 'verified') AS verified, COUNT(*) FILTER (WHERE is_available = true) AS available FROM worker_profiles`),
      query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='open') AS open, COUNT(*) FILTER (WHERE status='completed') AS completed FROM gigs`),
      query(`SELECT COALESCE(SUM(gross_amount) FILTER (WHERE status='escrow_released'),0) AS total_gmv_paise, COALESCE(SUM(platform_fee) FILTER (WHERE status='escrow_released'),0) AS total_revenue_paise FROM payments`),
      query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='open') AS open FROM disputes`),
    ]);
    return res.success(resp, {
      users: users.rows[0], workers: workers.rows[0], gigs: gigs.rows[0],
      payments: { ...payments.rows[0], gmv_rs: Math.round(payments.rows[0].total_gmv_paise/100) },
      disputes: disputes.rows[0],
    });
  } catch (err) { logger.error('admin/stats', { err: err.message }); return res.error(resp); }
});

router.get('/disputes', async (req, resp) => {
  const status = req.query.status || 'open';
  try {
    const { rows } = await query(
      `SELECT d.id, d.reason, d.description, d.status, d.created_at,
              g.title AS gig_title, g.agreed_amount,
              rb.full_name AS raised_by_name, ag.full_name AS against_name
       FROM disputes d
       JOIN gigs g ON g.id = d.gig_id
       JOIN users rb ON rb.id = d.raised_by
       JOIN users ag ON ag.id = d.against
       WHERE d.status = $1 ORDER BY d.created_at ASC LIMIT 50`,
      [status]
    );
    return res.success(resp, rows);
  } catch (err) { return res.error(resp); }
});

router.put('/disputes/:id/resolve',
  param('id').isUUID(),
  body('resolution').isIn(['resolved_worker', 'resolved_hirer', 'closed']),
  body('note').isString().isLength({ min: 10 }),
  validate,
  async (req, resp) => {
    const { resolution, note } = req.body;
    try {
      const dispute = (await query('SELECT * FROM disputes WHERE id = $1', [req.params.id])).rows[0];
      if (!dispute) return res.notFound(resp);
      await query(
        `UPDATE disputes SET status=$2, resolution_note=$3, assigned_to=$4, resolved_at=NOW(), updated_at=NOW() WHERE id=$1`,
        [req.params.id, resolution, note, req.user.id]
      );
      if (resolution === 'resolved_worker') {
        const p = (await query('SELECT id FROM payments WHERE gig_id = $1', [dispute.gig_id])).rows[0];
        if (p) await require('../services/payment.service').releaseEscrow(p.id);
      } else if (resolution === 'resolved_hirer') {
        await query(`UPDATE payments SET status='refunded', refunded_at=NOW(), refund_reason=$2 WHERE gig_id=$1`, [dispute.gig_id, note]);
      }
      logger.info('Dispute resolved', { id: req.params.id, resolution });
      return res.success(resp, {}, 'Dispute resolved');
    } catch (err) { logger.error('resolve dispute', { err: err.message }); return res.error(resp); }
  }
);

router.get('/workers', async (req, resp) => {
  const page = parseInt(req.query.page || '1'), limit = parseInt(req.query.limit || '20');
  try {
    const { rows } = await query(
      `SELECT u.id, u.phone, u.full_name, u.created_at, wp.work_id, wp.kyc_status, wp.skill_level, wp.avg_rating, wp.total_gigs, t.name_en AS trade_name, wp.city
       FROM users u JOIN worker_profiles wp ON wp.user_id = u.id LEFT JOIN trades t ON t.id = wp.trade_id
       WHERE u.role = 'worker' ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, (page-1)*limit]
    );
    return res.success(resp, rows);
  } catch (err) { return res.error(resp); }
});

router.put('/users/:id/suspend', param('id').isUUID(), body('reason').isString(), validate, async (req, resp) => {
  try {
    await query(`UPDATE users SET is_suspended=true, suspension_reason=$2, updated_at=NOW() WHERE id=$1`, [req.params.id, req.body.reason]);
    return res.success(resp, {}, 'User suspended');
  } catch (err) { return res.error(resp); }
});

module.exports = router;
