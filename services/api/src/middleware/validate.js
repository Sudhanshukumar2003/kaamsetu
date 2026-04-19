const { validationResult } = require('express-validator');
const res = require('../utils/response');

const validate = (req, resp, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.badRequest(resp, 'Validation failed', errors.array());
  }
  next();
};

module.exports = { validate };
