const { verifyToken } = require('../services/jwt.service');
const { query }       = require('../db/pool');
const res             = require('../utils/response');
const logger          = require('../utils/logger');

// Attach user to req.user
const authenticate = async (req, resp, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.unauthorized(resp, 'No token provided');
    }

    const token = header.split(' ')[1];
    const decoded = verifyToken(token);

    const result = await query(
      `SELECT id, phone, role, full_name, is_active, is_suspended
       FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (!result.rows.length) return res.unauthorized(resp, 'User not found');

    const user = result.rows[0];
    if (!user.is_active)   return res.unauthorized(resp, 'Account deactivated');
    if (user.is_suspended) return res.forbidden(resp, 'Account suspended');

    req.user = user;
    next();
  } catch (err) {
    logger.debug('Auth failed', { err: err.message });
    return res.unauthorized(resp, 'Invalid or expired token');
  }
};

// Role guard — use after authenticate
const requireRole = (...roles) => (req, resp, next) => {
  if (!roles.includes(req.user.role)) {
    return res.forbidden(resp, `Requires role: ${roles.join(' or ')}`);
  }
  next();
};

const requireWorker   = requireRole('worker');
const requireHirer    = requireRole('hirer');
const requireAdmin    = requireRole('admin');
const requireFieldAgent = requireRole('field_agent', 'admin');

module.exports = { authenticate, requireRole, requireWorker, requireHirer, requireAdmin, requireFieldAgent };
