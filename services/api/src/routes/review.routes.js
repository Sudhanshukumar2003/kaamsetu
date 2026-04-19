const express = require('express');
const { body, param } = require('express-validator');
const router  = express.Router();

const { query, transaction } = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { validate }     = require('../middleware/validate');
const res    = require('../utils/response');
const logger = require('../utils/logger');

// POST /reviews
router.post('/',
  authenticate,
  body('gigId').isUUID(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().isString().trim().isLength({ max: 1000 }),
  body('punctuality').optional().isInt({ min: 1, max: 5 }),
  body('quality').optional().isInt({ min: 1, max: 5 }),
  body('communication').optional().isInt({ min: 1, max: 5 }),
  validate,
  async (req, resp) => {
    const { gigId, rating, comment, punctuality, quality, communication } = req.body;
    try {
      const gig = (await query(
        `SELECT g.*, hp.user_id AS hirer_user_id, wp.user_id AS worker_user_id
         FROM gigs g
         JOIN hirer_profiles hp ON hp.id = g.hirer_id
         LEFT JOIN worker_profiles wp ON wp.id = g.worker_id
         WHERE g.id = $1`,
        [gigId]
      )).rows[0];

      if (!gig) return res.notFound(resp, 'Gig not found');
      if (gig.status !== 'completed') return res.badRequest(resp, 'Can only review completed gigs');

      const isHirer  = req.user.id === gig.hirer_user_id;
      const isWorker = req.user.id === gig.worker_user_id;
      if (!isHirer && !isWorker) return res.forbidden(resp, 'Not part of this gig');

      const revieweeId = isHirer ? gig.worker_user_id : gig.hirer_user_id;
      if (!revieweeId) return res.badRequest(resp, 'No worker assigned to this gig');

      const existing = (await query(
        'SELECT id FROM reviews WHERE gig_id = $1 AND reviewer_id = $2',
        [gigId, req.user.id]
      )).rows[0];
      if (existing) return res.conflict(resp, 'Already reviewed');

      await transaction(async (client) => {
        await client.query(
          `INSERT INTO reviews (gig_id, reviewer_id, reviewee_id, reviewer_role, rating, comment, punctuality, quality, communication)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [gigId, req.user.id, revieweeId, req.user.role, rating,
           comment || null, punctuality || null, quality || null, communication || null]
        );
        // Recompute avg
        const table = isHirer ? 'worker_profiles' : 'hirer_profiles';
        await client.query(
          `UPDATE ${table} SET
             avg_rating   = (SELECT AVG(rating) FROM reviews WHERE reviewee_id = $1),
             rating_count = (SELECT COUNT(*)    FROM reviews WHERE reviewee_id = $1),
             updated_at   = NOW()
           WHERE user_id = $1`,
          [revieweeId]
        );
      });

      return res.created(resp, {}, 'Review submitted');
    } catch (err) {
      logger.error('POST /reviews', { err: err.message });
      return res.error(resp);
    }
  }
);

// GET /reviews/user/:userId
router.get('/user/:userId',
  param('userId').isUUID(),
  validate,
  async (req, resp) => {
    try {
      const { rows } = await query(
        `SELECT r.rating, r.comment, r.punctuality, r.quality, r.communication,
                r.reviewer_role, r.created_at,
                u.full_name AS reviewer_name,
                g.title AS gig_title, g.start_date
         FROM reviews r
         JOIN users u ON u.id = r.reviewer_id
         JOIN gigs  g ON g.id = r.gig_id
         WHERE r.reviewee_id = $1 AND r.is_public = true
         ORDER BY r.created_at DESC LIMIT 20`,
        [req.params.userId]
      );
      return res.success(resp, rows);
    } catch (err) {
      return res.error(resp);
    }
  }
);

module.exports = router;
