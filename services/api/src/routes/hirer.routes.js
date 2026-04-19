const express = require('express');
const { body } = require('express-validator');
const router  = express.Router();
const { query } = require('../db/pool');
const { authenticate, requireHirer } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const res    = require('../utils/response');
const logger = require('../utils/logger');

router.get('/me', authenticate, requireHirer, async (req, resp) => {
  try {
    const { rows } = await query(
      `SELECT hp.*, u.phone, u.full_name, u.email, u.profile_photo_url
       FROM hirer_profiles hp JOIN users u ON u.id = hp.user_id WHERE hp.user_id = $1`,
      [req.user.id]
    );
    if (!rows.length) return res.notFound(resp);
    return res.success(resp, rows[0]);
  } catch (err) { return res.error(resp); }
});

router.put('/me',
  authenticate, requireHirer,
  body('fullName').optional().isString().trim(),
  body('businessName').optional().isString().trim(),
  body('businessType').optional().isIn(['housing_society','factory','individual','smb']),
  body('lat').optional().isFloat({ min: 8, max: 37 }),
  body('lng').optional().isFloat({ min: 68, max: 97 }),
  body('city').optional().isString().trim(),
  body('pincode').optional().matches(/^\d{6}$/),
  validate,
  async (req, resp) => {
    const { fullName, businessName, businessType, lat, lng, city, pincode } = req.body;
    try {
      if (fullName) await query('UPDATE users SET full_name=$2 WHERE id=$1', [req.user.id, fullName]);
      await query(
        `UPDATE hirer_profiles SET
           business_name = COALESCE($2, business_name),
           business_type = COALESCE($3, business_type),
           city          = COALESCE($4, city),
           pincode       = COALESCE($5, pincode),
           location      = CASE WHEN $6 IS NOT NULL THEN ST_SetSRID(ST_MakePoint($7,$6),4326) ELSE location END,
           updated_at    = NOW()
         WHERE user_id = $1`,
        [req.user.id, businessName||null, businessType||null, city||null, pincode||null, lat||null, lng||null]
      );
      return res.success(resp, {}, 'Profile updated');
    } catch (err) { logger.error('PUT /hirers/me', { err: err.message }); return res.error(resp); }
  }
);

module.exports = router;
