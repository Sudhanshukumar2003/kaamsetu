const express = require('express');
const { body, param, query: qv } = require('express-validator');
const router  = express.Router();

const { query, transaction } = require('../db/pool');
const { authenticate, requireWorker, requireHirer, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const notificationService = require('../services/notification.service');
const paymentService      = require('../services/payment.service');
const res    = require('../utils/response');
const logger = require('../utils/logger');
const config = require('../config');

// ── POST /gigs — hirer creates a gig ─────────────────────────────────
router.post('/',
  authenticate, requireHirer,
  body('tradeSlug').notEmpty(),
  body('title').isString().trim().isLength({ min: 5, max: 255 }),
  body('description').optional().isString().isLength({ max: 2000 }),
  body('requiredSkillLevel').optional().isIn(['beginner', 'intermediate', 'expert', 'master']),
  body('address').isString().trim().notEmpty(),
  body('city').isString().trim().notEmpty(),
  body('lat').isFloat({ min: 8, max: 37 }),
  body('lng').isFloat({ min: 68, max: 97 }),
  body('startDate').isISO8601(),
  body('startTime').optional().matches(/^\d{2}:\d{2}$/),
  body('estimatedHours').optional().isFloat({ min: 0.5, max: 24 }),
  body('budgetMin').isInt({ min: 10000 }),   // in paise → ₹100 minimum
  body('budgetMax').isInt({ min: 10000 }),
  body('isUrgent').optional().isBoolean(),
  validate,
  async (req, resp) => {
    const {
      tradeSlug, title, description, requiredSkillLevel,
      address, city, lat, lng, startDate, startTime,
      estimatedHours, budgetMin, budgetMax, isUrgent,
    } = req.body;

    if (budgetMax < budgetMin) {
      return res.badRequest(resp, 'budgetMax must be >= budgetMin');
    }

    try {
      const trade = (await query('SELECT id FROM trades WHERE slug = $1 AND is_active = true', [tradeSlug])).rows[0];
      if (!trade) return res.badRequest(resp, 'Invalid trade');

      const hirer = (await query('SELECT id FROM hirer_profiles WHERE user_id = $1', [req.user.id])).rows[0];
      if (!hirer) return res.notFound(resp, 'Hirer profile not found');

      const gig = (await query(
        `INSERT INTO gigs (
           hirer_id, trade_id, title, description, required_skill_level,
           address, city, location, start_date, start_time,
           estimated_hours, budget_min, budget_max, is_urgent
         ) VALUES ($1,$2,$3,$4,$5::skill_level,$6,$7,
                   ST_SetSRID(ST_MakePoint($9,$8),4326),
                   $10,$11,$12,$13,$14,$15)
         RETURNING id, title, status, start_date, budget_min, budget_max`,
        [
          hirer.id, trade.id, title, description || null,
          requiredSkillLevel || 'intermediate',
          address, city,
          lat, lng,
          startDate, startTime || null,
          estimatedHours || null,
          budgetMin, budgetMax,
          isUrgent || false,
        ]
      )).rows[0];

      // Update hirer stats
      await query('UPDATE hirer_profiles SET total_gigs_posted = total_gigs_posted + 1 WHERE id = $1', [hirer.id]);

      logger.info('Gig created', { gigId: gig.id, hirerId: hirer.id });
      return res.created(resp, gig, 'Gig posted successfully');
    } catch (err) {
      logger.error('POST /gigs', { err: err.message });
      return res.error(resp);
    }
  }
);

// ── GET /gigs/matches — worker sees matched gigs ──────────────────────
router.get('/matches',
  authenticate, requireWorker,
  qv('limit').optional().isInt({ min: 1, max: 50 }),
  qv('page').optional().isInt({ min: 1 }),
  validate,
  async (req, resp) => {
    const limit = parseInt(req.query.limit || '10');
    const page  = parseInt(req.query.page  || '1');
    const offset = (page - 1) * limit;

    try {
      const worker = (await query(
        `SELECT wp.id, wp.trade_id, wp.skill_level, wp.location, wp.kyc_status
         FROM worker_profiles wp WHERE wp.user_id = $1`,
        [req.user.id]
      )).rows[0];

      if (!worker) return res.notFound(resp, 'Worker profile not found');
      if (worker.kyc_status !== 'verified') {
        return res.forbidden(resp, 'Complete KYC to see gig matches');
      }
      if (!worker.location) {
        return res.badRequest(resp, 'Update your location to see nearby gigs');
      }

      const radiusM = config.geo.maxMatchRadiusKm * 1000;

      const { rows } = await query(
        `SELECT g.id, g.title, g.description, g.address, g.city,
                g.start_date, g.start_time, g.estimated_hours,
                g.budget_min, g.budget_max, g.is_urgent,
                g.required_skill_level,
                t.name_en AS trade_name, t.slug AS trade_slug,
                u.full_name AS hirer_name,
                hp.avg_rating AS hirer_rating,
                hp.business_type AS hirer_type,
                ROUND(CAST(ST_Distance(g.location, $2::geography) / 1000 AS NUMERIC), 1) AS distance_km
         FROM gigs g
         JOIN trades t          ON t.id = g.trade_id
         JOIN hirer_profiles hp ON hp.id = g.hirer_id
         JOIN users u           ON u.id = hp.user_id
         WHERE g.status = 'open'
           AND g.trade_id = $1
           AND ST_DWithin(g.location, $2::geography, $3)
           AND g.start_date >= CURRENT_DATE
           AND g.required_skill_level = ANY($4::skill_level[])
         ORDER BY g.is_urgent DESC, distance_km ASC, g.start_date ASC
         LIMIT $5 OFFSET $6`,
        [
          worker.trade_id,
          worker.location,
          radiusM,
          getEligibleLevels(worker.skill_level),
          limit,
          offset,
        ]
      );

      const total = rows.length; // approximate for now
      return res.paginated(resp, rows, total, page, limit);
    } catch (err) {
      logger.error('GET /gigs/matches', { err: err.message });
      return res.error(resp);
    }
  }
);

// ── GET /gigs — hirer sees their gigs ────────────────────────────────
router.get('/',
  authenticate,
  qv('status').optional().isIn(['open', 'matched', 'accepted', 'in_progress', 'completed', 'cancelled', 'disputed']),
  validate,
  async (req, resp) => {
    try {
      let profileId, profileTable;
      if (req.user.role === 'hirer') {
        const h = (await query('SELECT id FROM hirer_profiles WHERE user_id = $1', [req.user.id])).rows[0];
        if (!h) return res.notFound(resp);
        profileId    = h.id;
        profileTable = 'hirer';
      } else if (req.user.role === 'worker') {
        const w = (await query('SELECT id FROM worker_profiles WHERE user_id = $1', [req.user.id])).rows[0];
        if (!w) return res.notFound(resp);
        profileId    = w.id;
        profileTable = 'worker';
      } else {
        return res.forbidden(resp);
      }

      const statusFilter = req.query.status ? `AND g.status = '${req.query.status}'` : '';
      const whereClause  = profileTable === 'hirer'
        ? `g.hirer_id = $1`
        : `g.worker_id = $1`;

      const { rows } = await query(
        `SELECT g.id, g.title, g.status, g.start_date, g.city,
                g.budget_min, g.budget_max, g.agreed_amount,
                g.checkin_at, g.completed_at, g.is_urgent,
                t.name_en AS trade_name,
                CASE WHEN $2 = 'hirer'
                  THEN (SELECT u.full_name FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE wp.id = g.worker_id)
                  ELSE (SELECT u.full_name FROM hirer_profiles  hp JOIN users u ON u.id = hp.user_id WHERE hp.id = g.hirer_id)
                END AS counterpart_name,
                p.status AS payment_status
         FROM gigs g
         JOIN trades t ON t.id = g.trade_id
         LEFT JOIN payments p ON p.gig_id = g.id
         WHERE ${whereClause} ${statusFilter}
         ORDER BY g.created_at DESC
         LIMIT 50`,
        [profileId, profileTable]
      );

      return res.success(resp, rows);
    } catch (err) {
      logger.error('GET /gigs', { err: err.message });
      return res.error(resp);
    }
  }
);

// ── GET /gigs/:id ─────────────────────────────────────────────────────
router.get('/:id',
  authenticate,
  param('id').isUUID(),
  validate,
  async (req, resp) => {
    try {
      const { rows } = await query(
        `SELECT g.*,
                t.name_en AS trade_name, t.slug AS trade_slug,
                -- hirer info
                hu.full_name   AS hirer_name,
                hp.business_type, hp.avg_rating AS hirer_rating,
                -- worker info (if matched)
                wu.full_name   AS worker_name,
                wp.work_id, wp.avg_rating AS worker_rating,
                wp.total_gigs  AS worker_total_gigs,
                -- payment
                p.status        AS payment_status,
                p.gross_amount, p.worker_amount, p.platform_fee,
                p.escrow_held_at, p.escrow_released_at
         FROM gigs g
         JOIN trades t          ON t.id = g.trade_id
         JOIN hirer_profiles hp ON hp.id = g.hirer_id
         JOIN users hu          ON hu.id = hp.user_id
         LEFT JOIN worker_profiles wp ON wp.id = g.worker_id
         LEFT JOIN users wu          ON wu.id = wp.user_id
         LEFT JOIN payments p        ON p.gig_id = g.id
         WHERE g.id = $1`,
        [req.params.id]
      );
      if (!rows.length) return res.notFound(resp);
      return res.success(resp, rows[0]);
    } catch (err) {
      logger.error('GET /gigs/:id', { err: err.message });
      return res.error(resp);
    }
  }
);

// ── POST /gigs/:id/accept — worker accepts ────────────────────────────
router.post('/:id/accept',
  authenticate, requireWorker,
  param('id').isUUID(),
  body('agreedAmount').isInt({ min: 10000 }),
  validate,
  async (req, resp) => {
    const { agreedAmount } = req.body;
    try {
      const worker = (await query(
        'SELECT id, kyc_status FROM worker_profiles WHERE user_id = $1', [req.user.id]
      )).rows[0];
      if (!worker) return res.notFound(resp);
      if (worker.kyc_status !== 'verified') return res.forbidden(resp, 'KYC required to accept gigs');

      const updated = await transaction(async (client) => {
        const gig = (await client.query(
          'SELECT * FROM gigs WHERE id = $1 FOR UPDATE', [req.params.id]
        )).rows[0];

        if (!gig)                   throw Object.assign(new Error('Gig not found'), { code: 404 });
        if (gig.status !== 'open')  throw Object.assign(new Error('Gig no longer available'), { code: 409 });
        if (agreedAmount < gig.budget_min || agreedAmount > gig.budget_max) {
          throw Object.assign(new Error(`Agreed amount must be between ₹${gig.budget_min/100} and ₹${gig.budget_max/100}`), { code: 400 });
        }

        await client.query(
          `UPDATE gigs SET
             worker_id     = $2,
             status        = 'accepted',
             agreed_amount = $3,
             accepted_at   = NOW(),
             updated_at    = NOW()
           WHERE id = $1`,
          [gig.id, worker.id, agreedAmount]
        );

        return gig;
      });

      // Notify hirer
      await notificationService.notifyGigAccepted(req.params.id, req.user.id);

      return res.success(resp, { gigId: req.params.id, agreedAmount }, 'Gig accepted');
    } catch (err) {
      if (err.code === 404) return res.notFound(resp, err.message);
      if (err.code === 409) return res.conflict(resp, err.message);
      if (err.code === 400) return res.badRequest(resp, err.message);
      logger.error('POST /gigs/:id/accept', { err: err.message });
      return res.error(resp);
    }
  }
);

// ── POST /gigs/:id/checkin — worker geo check-in ──────────────────────
router.post('/:id/checkin',
  authenticate, requireWorker,
  param('id').isUUID(),
  body('lat').isFloat({ min: 8, max: 37 }),
  body('lng').isFloat({ min: 68, max: 97 }),
  validate,
  async (req, resp) => {
    const { lat, lng } = req.body;
    try {
      const worker = (await query('SELECT id FROM worker_profiles WHERE user_id = $1', [req.user.id])).rows[0];
      if (!worker) return res.notFound(resp);

      const gig = (await query(
        'SELECT id, status, location FROM gigs WHERE id = $1 AND worker_id = $2',
        [req.params.id, worker.id]
      )).rows[0];

      if (!gig) return res.notFound(resp, 'Gig not found or not assigned to you');
      if (!['accepted', 'matched'].includes(gig.status)) {
        return res.badRequest(resp, 'Gig is not in a state that allows check-in');
      }

      const payment = (await query(
        'SELECT status FROM payments WHERE gig_id = $1',
        [gig.id]
      )).rows[0];

      if (!payment || payment.status !== 'escrow_held') {
        return res.badRequest(resp, 'Payment not in escrow. Ask the hirer to deposit before check-in.');
      }

      // Calculate distance from gig location
      const distResult = await query(
        `SELECT ROUND(ST_Distance(
           $1::geography,
           ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography
         )) AS distance_m`,
        [gig.location, lat, lng]
      );
      const distanceM = parseInt(distResult.rows[0].distance_m);

      await query(
        `UPDATE gigs SET
           status           = 'in_progress',
           checkin_at       = NOW(),
           checkin_location = ST_SetSRID(ST_MakePoint($3, $2), 4326),
           checkin_distance_m = $4,
           updated_at       = NOW()
         WHERE id = $1`,
        [gig.id, lat, lng, distanceM]
      );

      if (distanceM > config.geo.checkinMaxDistanceM) {
        logger.warn('Worker checked in far from gig', { gigId: gig.id, distanceM });
      }

      await notificationService.notifyCheckin(gig.id, distanceM);

      return res.success(resp, {
        checkedIn: true,
        distanceFromSite: `${distanceM}m`,
        withinRange: distanceM <= config.geo.checkinMaxDistanceM,
      });
    } catch (err) {
      logger.error('POST /gigs/:id/checkin', { err: err.message });
      return res.error(resp);
    }
  }
);

// ── POST /gigs/:id/complete — worker marks complete ───────────────────
router.post('/:id/complete',
  authenticate, requireWorker,
  param('id').isUUID(),
  body('notes').optional().isString().isLength({ max: 500 }),
  validate,
  async (req, resp) => {
    try {
      const worker = (await query('SELECT id FROM worker_profiles WHERE user_id = $1', [req.user.id])).rows[0];

      const gig = (await query(
        'SELECT id, status, hirer_id FROM gigs WHERE id = $1 AND worker_id = $2',
        [req.params.id, worker.id]
      )).rows[0];

      if (!gig) return res.notFound(resp, 'Gig not found');
      if (gig.status !== 'in_progress') return res.badRequest(resp, 'Gig is not in progress');

      const payment = (await query(
        'SELECT status FROM payments WHERE gig_id = $1',
        [gig.id]
      )).rows[0];

      if (!payment || payment.status !== 'escrow_held') {
        return res.badRequest(resp, 'Payment not in escrow. Ask the hirer to deposit before completion.');
      }

      await query(
        `UPDATE gigs SET status = 'completed', completed_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [gig.id]
      );

      // Notify hirer to confirm and release payment
      await notificationService.notifyWorkerComplete(gig.id);

      return res.success(resp, {}, 'Job marked complete. Awaiting hirer confirmation.');
    } catch (err) {
      logger.error('POST /gigs/:id/complete', { err: err.message });
      return res.error(resp);
    }
  }
);

// ── POST /gigs/:id/confirm — hirer confirms completion ────────────────
router.post('/:id/confirm',
  authenticate, requireHirer,
  param('id').isUUID(),
  validate,
  async (req, resp) => {
    try {
      const hirer = (await query('SELECT id FROM hirer_profiles WHERE user_id = $1', [req.user.id])).rows[0];

      const gig = (await query(
        'SELECT g.*, p.id AS payment_id FROM gigs g LEFT JOIN payments p ON p.gig_id = g.id WHERE g.id = $1 AND g.hirer_id = $2',
        [req.params.id, hirer.id]
      )).rows[0];

      if (!gig)                        return res.notFound(resp, 'Gig not found');
      if (gig.status !== 'completed')  return res.badRequest(resp, 'Job not yet marked complete by worker');

      // Trigger payment release (Razorpay payout)
      await paymentService.releaseEscrow(gig.payment_id);

      // Update worker stats
      await query(
        `UPDATE worker_profiles SET
           total_gigs     = total_gigs + 1,
           total_earnings = total_earnings + $2,
           updated_at     = NOW()
         WHERE id = $1`,
        [gig.worker_id, gig.agreed_amount]
      );

      return res.success(resp, {}, 'Payment released to worker. Please leave a review.');
    } catch (err) {
      logger.error('POST /gigs/:id/confirm', { err: err.message });
      return res.error(resp);
    }
  }
);

// ── POST /gigs/:id/dispute ────────────────────────────────────────────
router.post('/:id/dispute',
  authenticate,
  param('id').isUUID(),
  body('reason').isString().notEmpty().isLength({ max: 100 }),
  body('description').isString().isLength({ min: 20, max: 1000 }),
  validate,
  async (req, resp) => {
    try {
      const gig = (await query('SELECT * FROM gigs WHERE id = $1', [req.params.id])).rows[0];
      if (!gig) return res.notFound(resp);

      // Figure out who is being disputed against
      const hirer  = (await query('SELECT user_id FROM hirer_profiles  WHERE id = $1', [gig.hirer_id])).rows[0];
      const worker = gig.worker_id
        ? (await query('SELECT user_id FROM worker_profiles WHERE id = $1', [gig.worker_id])).rows[0]
        : null;

      const againstUserId = req.user.id === hirer.user_id
        ? worker?.user_id
        : hirer.user_id;

      if (!againstUserId) return res.badRequest(resp, 'Cannot raise dispute on unmatched gig');

      const dispute = (await query(
        `INSERT INTO disputes (gig_id, raised_by, against, reason, description)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [gig.id, req.user.id, againstUserId, req.body.reason, req.body.description]
      )).rows[0];

      // Freeze payment
      if (gig.worker_id) {
        await query(
          `UPDATE payments SET status = 'disputed' WHERE gig_id = $1`,
          [gig.id]
        );
      }

      await query(
        `UPDATE gigs SET status = 'disputed', updated_at = NOW() WHERE id = $1`,
        [gig.id]
      );

      return res.created(resp, { disputeId: dispute.id }, 'Dispute raised. Our team will review within 24 hours.');
    } catch (err) {
      logger.error('POST /gigs/:id/dispute', { err: err.message });
      return res.error(resp);
    }
  }
);

// Helper: workers with higher skill can take lower-level gigs
const getEligibleLevels = (level) => {
  const hierarchy = ['beginner', 'intermediate', 'expert', 'master'];
  const idx = hierarchy.indexOf(level);
  return hierarchy.slice(0, idx + 1);
};

module.exports = router;
