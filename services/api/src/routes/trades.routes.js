const express = require('express');
const router  = express.Router();
const { query } = require('../db/pool');
const res = require('../utils/response');

router.get('/', async (req, resp) => {
  try {
    const { rows } = await query('SELECT id, slug, name_en, name_hi, category FROM trades WHERE is_active = true ORDER BY name_en');
    return res.success(resp, rows);
  } catch (err) { return res.error(resp); }
});

module.exports = router;
