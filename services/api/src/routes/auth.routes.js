const express = require('express');
const { body } = require('express-validator');
const router  = express.Router();

const { query, transaction } = require('../db/pool');
const { sendOTP, verifyOTP } = require('../services/otp.service');
const { signToken, signRefreshToken, verifyRefreshToken } = require('../services/jwt.service');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const res     = require('../utils/response');
const logger  = require('../utils/logger');

// ── POST /auth/send-otp ──────────────────────────────────────────────
router.post('/send-otp',
  body('phone').matches(/^[6-9]\d{9}$/).withMessage('Invalid Indian mobile number'),
  body('role').optional().isIn(['worker', 'hirer']),
  validate,
  async (req, resp) => {
    const { phone, role } = req.body;
    try {
      // Check if user already exists
      const existing = await query('SELECT id, role FROM users WHERE phone = $1', [phone]);
      const isNewUser = existing.rows.length === 0;

      if (isNewUser && !role) {
        return res.badRequest(resp, 'role required for new registration (worker or hirer)');
      }

      await sendOTP(phone, 'login');
      return res.success(resp, { isNewUser, phone }, 'OTP sent successfully');
    } catch (err) {
      logger.error('send-otp error', { err: err.message });
      return res.error(resp, 'Failed to send OTP');
    }
  }
);

// ── POST /auth/verify-otp ────────────────────────────────────────────
router.post('/verify-otp',
  body('phone').matches(/^[6-9]\d{9}$/).withMessage('Invalid Indian mobile number'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  body('role').optional().isIn(['worker', 'hirer']),
  body('fullName').optional().isString().trim(),
  validate,
  async (req, resp) => {
    const { phone, code, role, fullName } = req.body;
    try {
      const { valid, reason } = await verifyOTP(phone, code, 'login');
      if (!valid) return res.badRequest(resp, reason || 'Invalid OTP');

      let user = (await query('SELECT * FROM users WHERE phone = $1', [phone])).rows[0];

      // Auto-register if new user
      if (!user) {
        if (!role) return res.badRequest(resp, 'role required for registration');

        user = await transaction(async (client) => {
          const u = (await client.query(
            `INSERT INTO users (phone, phone_verified, role, full_name)
             VALUES ($1, true, $2, $3) RETURNING *`,
            [phone, role, fullName || null]
          )).rows[0];

          // Create role-specific profile
          if (role === 'worker') {
            await client.query(
              'INSERT INTO worker_profiles (user_id) VALUES ($1)',
              [u.id]
            );
          } else if (role === 'hirer') {
            await client.query(
              'INSERT INTO hirer_profiles (user_id) VALUES ($1)',
              [u.id]
            );
          }
          return u;
        });
      } else {
        // Mark phone verified
        await query('UPDATE users SET phone_verified = true, last_seen_at = NOW() WHERE id = $1', [user.id]);
      }

      const tokenPayload = { userId: user.id, role: user.role };
      const token        = signToken(tokenPayload);
      const refreshToken = signRefreshToken(tokenPayload);

      logger.info('User authenticated', { userId: user.id, role: user.role });

      return res.success(resp, {
        token,
        refreshToken,
        user: {
          id:       user.id,
          phone:    user.phone,
          role:     user.role,
          fullName: user.full_name,
          isNewUser: !user.full_name,
        },
      }, 'Authenticated successfully');
    } catch (err) {
      logger.error('verify-otp error', { err: err.message, stack: err.stack });
      return res.error(resp, 'Authentication failed');
    }
  }
);

// ── POST /auth/refresh ───────────────────────────────────────────────
router.post('/refresh',
  body('refreshToken').notEmpty(),
  validate,
  async (req, resp) => {
    try {
      const decoded = verifyRefreshToken(req.body.refreshToken);
      const user = (await query('SELECT id, role, is_active FROM users WHERE id = $1', [decoded.userId])).rows[0];
      if (!user || !user.is_active) return res.unauthorized(resp, 'User not found');

      const token = signToken({ userId: user.id, role: user.role });
      return res.success(resp, { token }, 'Token refreshed');
    } catch {
      return res.unauthorized(resp, 'Invalid refresh token');
    }
  }
);

// ── GET /auth/me ─────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, resp) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.phone, u.email, u.full_name, u.role, u.profile_photo_url,
              u.preferred_lang, u.whatsapp_optin, u.created_at,
              CASE WHEN u.role = 'worker' THEN row_to_json(wp.*)
                   WHEN u.role = 'hirer'  THEN row_to_json(hp.*)
                   ELSE NULL END AS profile
       FROM users u
       LEFT JOIN worker_profiles wp ON wp.user_id = u.id AND u.role = 'worker'
       LEFT JOIN hirer_profiles  hp ON hp.user_id = u.id AND u.role = 'hirer'
       WHERE u.id = $1`,
      [req.user.id]
    );
    return res.success(resp, rows[0]);
  } catch (err) {
    logger.error('/me error', { err: err.message });
    return res.error(resp);
  }
});

module.exports = router;
