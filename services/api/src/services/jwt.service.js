const jwt    = require('jsonwebtoken');
const config = require('../config');

const signToken = (payload) =>
  jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

const signRefreshToken = (payload) =>
  jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpires });

const verifyToken = (token) =>
  jwt.verify(token, config.jwt.secret);

const verifyRefreshToken = (token) =>
  jwt.verify(token, config.jwt.refreshSecret);

const decodeToken = (token) =>
  jwt.decode(token);

module.exports = { signToken, signRefreshToken, verifyToken, verifyRefreshToken, decodeToken };
