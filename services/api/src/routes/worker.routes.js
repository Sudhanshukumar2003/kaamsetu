const express = require('express');
const { body, param, query: qv } = require('express-validator');
const router  = express.Router();

const { query, transaction } = require('../db/pool');
const { authenticate, requireWorker } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const kycService  = require('../services/kyc.service');
const res  = require('../utils/response');
const logger = require('../utils/logger');

// ── GET /workers/me ──────────────────────────────────────────────────
router.get('/me', authenticate, requireWorker, async (req, resp) => {
  try {
    const { rows } = await query(
      `SELECT wp.*, u.phone, u.full_name, u.email, u.profile_photo_url,
              u.preferred_lang, u.whatsapp_optin,
              t.name_en AS trade_name, t.slug AS trade_slug,
              wbd.upi_id
       FROM worker_profiles wp
       JOIN users u ON u.id = wp.user_id
       LEFT JOIN trades t ON t.id = wp.trade_id
       LEFT JOIN worker_bank_details wbd ON wbd.worker_id = wp.id
       WHERE wp.user_id = $1`,
      [req.user.id]
    );
    if (!rows.length) return res.notFound(resp, 'Worker profile not found');
    return res.success(resp, rows[0]);
  } catch (err) {
    logger.error('GET /workers/me', { err: err.message });
    return res.error(resp);
  }
});

// ── PUT /workers/me ── update profile ───────────────────────────────
router.put('/me',
  authenticate, requireWorker,
  body('fullName').optional().isString().trim().isLength({ min: 2, max: 200 }),
  body('tradeSlug').optional().isString(),
  body('skillLevel').optional().isIn(['beginner', 'intermediate', 'expert', 'master']),
  body('yearsExperience').optional().isInt({ min: 0, max: 50 }),
  body('bio').optional().isString().isLength({ max: 500 }),
  body('lat').optional().isFloat({ min: 8, max: 37 }),
  body('lng').optional().isFloat({ min: 68, max: 97 }),
  body('city').optional().isString().trim(),
  body('state').optional().isString().trim(),
  body('pincode').optional().matches(/^\d{6}$/),
  body('preferredLang').optional().isIn(['hi', 'en', 'mr', 'ta', 'te', 'kn', 'bn']),
  validate,
  async (req, resp) => {
    const { fullName, tradeSlug, skillLevel, yearsExperience, bio,
            lat, lng, city, state, pincode, preferredLang } = req.body;
    try {
      await transaction(async (client) => {
        if (fullName || preferredLang) {
          await client.query(
            `UPDATE users SET
               full_name      = COALESCE($2, full_name),
               preferred_lang = COALESCE($3, preferred_lang),
               updated_at     = NOW()
             WHERE id = $1`,
            [req.user.id, fullName || null, preferredLang || null]
          );
        }

        let tradeId = null;
        if (tradeSlug) {
          const tr = await client.query('SELECT id FROM trades WHERE slug = $1', [tradeSlug]);
          if (!tr.rows.length) throw Object.assign(new Error('Invalid trade'), { statusCode: 400 });
          tradeId = tr.rows[0].id;
        }

        const baseParams = [
          req.user.id,
          tradeId,
          skillLevel    || null,
          yearsExperience !== undefined ? yearsExperience : null,
          bio           || null,
          city          || null,
          state         || null,
          pincode       || null,
        ];

        const geoSet = (lat && lng)
          ? `, location = ST_SetSRID(ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)}), 4326)::geography`
          : '';

        await client.query(
          `UPDATE worker_profiles SET
             trade_id         = COALESCE($2, trade_id),
             skill_level      = COALESCE($3::skill_level, skill_level),
             years_experience = COALESCE($4, years_experience),
             bio              = COALESCE($5, bio),
             city             = COALESCE($6, city),
             state            = COALESCE($7, state),
             pincode          = COALESCE($8, pincode)
             ${geoSet},
             updated_at       = NOW()
           WHERE user_id = $1`,
          baseParams
        );
      });

      return res.success(resp, {}, 'Profile updated');
    } catch (err) {
      if (err.statusCode === 400) return res.badRequest(resp, err.message);
      logger.error('PUT /workers/me', { err: err.message });
      return res.error(resp);
    }
  }
);

// ── POST /workers/me/availability ────────────────────────────────────
router.post('/me/availability',
  authenticate, requireWorker,
  body('isAvailable').isBoolean(),
  body('availableFrom').optional().isISO8601(),
  validate,
  async (req, resp) => {
    const { isAvailable, availableFrom } = req.body;
    try {
      await query(
        `UPDATE worker_profiles
         SET is_available   = $2,
             available_from = COALESCE($3::date, available_from),
             updated_at     = NOW()
         WHERE user_id = $1`,
        [req.user.id, isAvailable, availableFrom || null]
      );
      return res.success(resp, { isAvailable }, 'Availability updated');
    } catch (err) {
      logger.error('availability update', { err: err.message });
      return res.error(resp);
    }
  }
);

// ── POST /workers/me/kyc/initiate ────────────────────────────────────
router.post('/me/kyc/initiate',
  authenticate, requireWorker,
  body('aadhaarNumber').matches(/^\d{12}$/).withMessage('Aadhaar must be 12 digits'),
  validate,
  async (req, resp) => {
    const { aadhaarNumber } = req.body;
    try {
      // Check current KYC status
      const { rows } = await query(
        'SELECT kyc_status FROM worker_profiles WHERE user_id = $1',
        [req.user.id]
      );
      if (!rows.length) return res.notFound(resp, 'Worker profile not found');
      if (rows[0].kyc_status === 'verified') {
        return res.conflict(resp, 'KYC already verified');
      }

      // Initiate Aadhaar OTP via IDfy
      const result = await kycService.initiateAadhaarOTP(aadhaarNumber);

      // Mark as submitted
      await query(
        `UPDATE worker_profiles
         SET kyc_status = 'submitted',
             aadhaar_last4 = $2,
             updated_at = NOW()
         WHERE user_id = $1`,
        [req.user.id, aadhaarNumber.slice(-4)]
      );

      return res.success(resp, {
        requestId: result.requestId,
        message:   'OTP sent to Aadhaar-linked mobile',
      });
    } catch (err) {
      logger.error('KYC initiate', { err: err.message });
      return res.error(resp, 'KYC initiation failed');
    }
  }
);

// ── POST /workers/me/kyc/verify ──────────────────────────────────────
router.post('/me/kyc/verify',
  authenticate, requireWorker,
  body('requestId').notEmpty(),
  body('otp').isLength({ min: 6, max: 6 }),
  body('selfieBase64').notEmpty().withMessage('Selfie image required'),
  validate,
  async (req, resp) => {
    const { requestId, otp, selfieBase64 } = req.body;
    try {
      const profile = (await query(
        'SELECT id, aadhaar_last4 FROM worker_profiles WHERE user_id = $1',
        [req.user.id]
      )).rows[0];
      if (!profile) return res.notFound(resp, 'Profile not found');

      // Verify OTP with IDfy + face match
      const kycResult = await kycService.verifyAadhaarOTP(requestId, otp, selfieBase64);

      if (!kycResult.success) {
        return res.badRequest(resp, kycResult.error || 'KYC verification failed');
      }

      // Generate Work ID: KS-YYYY-XXXXX
      const year = new Date().getFullYear();
      const seq  = (await query('SELECT COUNT(*) FROM worker_profiles WHERE kyc_status = $1', ['verified'])).rows[0].count;
      const workId = `KS-${year}-${String(parseInt(seq) + 1).padStart(5, '0')}`;

      await query(
        `UPDATE worker_profiles SET
           kyc_status          = 'verified',
           aadhaar_name        = $2,
           aadhaar_dob         = $3,
           aadhaar_verified_at = NOW(),
           face_match_score    = $4,
           work_id             = $5,
           updated_at          = NOW()
         WHERE user_id = $1`,
        [
          req.user.id,
          kycResult.name,
          kycResult.dob || null,
          kycResult.faceMatchScore || null,
          workId,
        ]
      );

      logger.info('Worker KYC verified', { userId: req.user.id, workId });
      return res.success(resp, { workId, name: kycResult.name }, 'KYC verified successfully');
    } catch (err) {
      logger.error('KYC verify', { err: err.message });
      return res.error(resp, 'KYC verification failed');
    }
  }
);

// ── PUT /workers/me/bank-details ─────────────────────────────────────
router.put('/me/bank-details',
  authenticate, requireWorker,
  body('upiId').optional().matches(/^[\w.\-]+@[\w]+$/).withMessage('Invalid UPI ID'),
  validate,
  async (req, resp) => {
    const { upiId } = req.body;
    try {
      const wp = (await query(
        'SELECT id FROM worker_profiles WHERE user_id = $1', [req.user.id]
      )).rows[0];
      if (!wp) return res.notFound(resp);

      await query(
        `INSERT INTO worker_bank_details (worker_id, upi_id)
         VALUES ($1, $2)
         ON CONFLICT (worker_id) DO UPDATE SET upi_id = $2, updated_at = NOW()`,
        [wp.id, upiId]
      );
      return res.success(resp, { upiId }, 'Bank details saved');
    } catch (err) {
      logger.error('bank-details', { err: err.message });
      return res.error(resp);
    }
  }
);

// ── GET /workers/:workId/profile (public) ────────────────────────────
router.get('/:workId/profile',
  param('workId').matches(/^KS-\d{4}-\d{5}$/),
  validate,
  async (req, resp) => {
    try {
      const { rows } = await query(
        `SELECT wp.work_id, wp.skill_level, wp.years_experience, wp.bio,
                wp.total_gigs, wp.avg_rating, wp.rating_count,
                wp.city, wp.state, wp.is_available,
                u.full_name, u.profile_photo_url,
                t.name_en AS trade_name, t.slug AS trade_slug
         FROM worker_profiles wp
         JOIN users u ON u.id = wp.user_id
         LEFT JOIN trades t ON t.id = wp.trade_id
         WHERE wp.work_id = $1 AND wp.kyc_status = 'verified' AND u.is_active = true`,
        [req.params.workId]
      );
      if (!rows.length) return res.notFound(resp, 'Worker not found');
      return res.success(resp, rows[0]);
    } catch (err) {
      return res.error(resp);
    }
  }
);

module.exports = router;
